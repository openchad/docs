---
outline: deep
---

# Creating Custom Tools

OpenChad's plugin architecture lets you write **Python tools** that run inside the backend server, interact with local databases and AI models, and are callable from the React frontend via the `useTool` hook — or from any MCP-compatible client.

---

## Architecture Overview

```
┌─────────────────────────────────────────┐
│          React Frontend                 │
│   const tool = useTool<T>()            │
│   await tool("counter", { action })    │
└─────────────┬───────────────────────────┘
              │  pyInvoke("tools/execute", ...)
              ▼
┌─────────────────────────────────────────┐
│        Python Backend Router            │
│   case "tools/execute":                 │
│     tool_manager.execute_tool(...)      │
└─────────────┬───────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────┐
│     Your Custom Tool (ToolBase)         │
│   async def execute(**kwargs) → dict    │
│   self.tab_db.get / sync               │
│   self.llm_tool(query)                 │
└─────────────────────────────────────────┘
```

Every custom tool is a Python class that:
1. **Inherits from `ToolBase`** — the OpenChad plugin base class.
2. **Declares metadata** — a `name`, `description`, and JSON Schema `input_schema`.
3. **Implements `execute()`** — your core async business logic.
4. **Exports `Tool = YourClass`** — so OpenChad can auto-discover and load it.

---

## Step 1 — Create Your Tool File

Tools live inside the `Tools/` directory, organized in named subfolders. OpenChad automatically scans these directories on startup and hot-reloads them when you call `tools/reload`.

```
Tools/
└── {{publisher}}/
    └── counter/
        └── main.py   ← Your tool file
```

> [!IMPORTANT]
> The file **must** be named `main.py` and **must** export `Tool = YourClass` at the bottom. This is what the tool loader uses to instantiate your class.

---

## Step 2 — Subclass `ToolBase`

Here is the full `CounterTool` example — a practical, real-world tool demonstrating state persistence, action routing, and database synchronization:

```python
"""
Counter Tool - Example demonstrating OpenChad Programmatic Tool Calling.
"""
from openchadpy.tool_base import ToolBase
from typing import Any, Dict
import logging

logger = logging.getLogger(__name__)


class CounterTool(ToolBase):
    """A counter tool demonstrating programmatic tool calling."""

    # ─── Required Metadata ────────────────────────────────────────────────
    name = "counter"
    description = (
        "Increment, decrement, reset, or get a counter value. "
        "Useful for counting operations in loops."
    )

    # ─── JSON Schema — defines accepted parameters ─────────────────────────
    input_schema = {
        "type": "object",
        "properties": {
            "action": {
                "type": "string",
                "enum": ["increment", "decrement", "reset", "get"],
                "description": "The action to perform on the counter"
            },
            "value": {
                "type": "integer",
                "description": "Amount to change by (for increment/decrement). Default is 1.",
                "default": 1
            }
        },
        "required": ["action"]
    }

    # ─── Caller Permissions ────────────────────────────────────────────────
    # Controls which callers can invoke this tool.
    # "direct"         → pyInvoke("tools/execute", ...) from the React frontend
    # "code_execution" → Called programmatically from other Python tools
    # "mcp_client"     → Exposed over MCP protocol to external AI clients
    allowed_callers = ["direct", "code_execution", "mcp_client"]

    # ─── Lifecycle Hooks ───────────────────────────────────────────────────
    def on_register(self) -> None:
        """Called once when OpenChad loads this tool."""
        print(f"[{self.name}] Registered and ready!")

    def on_unregister(self) -> None:
        """Called once when OpenChad unloads or reloads this tool."""
        print(f"[{self.name}] Unregistered.")

    # ─── Core Logic ────────────────────────────────────────────────────────
    async def execute(self, **kwargs) -> Dict[str, Any]:
        """
        Execute counter action.

        Args:
            action: One of "increment", "decrement", "reset", "get"
            value:  Amount to change the counter by (default: 1)

        Returns:
            {"count": int, "action": str}
        """
        action: str = kwargs.get("action", "")
        value: int = kwargs.get("value", 1)

        # Read current value from the tab-scoped database
        count = await self.tab_db.get("counter", "currentValue") or 0

        match action:
            case "increment":
                count += value
            case "decrement":
                count -= value
            case "reset":
                count = 0
            case "get":
                pass  # Just return current value
            case _:
                return {"error": f"Unknown action: {action}", "count": count}

        # Persist the updated value back to the database
        await self.tab_db.sync("counter", {"currentValue": count})

        return {"count": count, "action": action}


# ─── Required Export ──────────────────────────────────────────────────────────
Tool = CounterTool
```

---

## ToolBase Reference

### Required Class Attributes

| Attribute | Type | Description |
|:---|:---|:---|
| `name` | `str` | Unique tool identifier used in `pyInvoke` calls. Must be non-empty. |
| `description` | `str` | Human-readable description exposed to AI LLMs and MCP clients as tool context. |
| `input_schema` | `dict` | JSON Schema object defining accepted parameters (`properties`, `required`, `type`). |

### Optional Class Attributes

| Attribute | Type | Default | Description |
|:---|:---|:---|:---|
| `allowed_callers` | `List[CallerType]` | `["direct"]` | Restricts which subsystems can invoke this tool. See [Caller Types](#caller-types) below. |
| `app_name` | `str \| None` | `None` | Optional namespace for multi-app deployments. |

### Caller Types

| Value | Description |
|:---|:---|
| `"direct"` | Invoked via `pyInvoke("tools/execute", ...)` from the React UI. |
| `"code_execution"` | Called programmatically by other Python tools using `tool_manager`. |
| `"mcp_client"` | Exposed as an MCP tool — callable by any compatible AI client (Claude, etc.). |

---

## Built-in Database Access

Every tool has built-in reactive database accessors that sync state directly to the frontend via the OpenChad subscription system.

### `self.tab_db` — Tab-Scoped Database
Reads and writes data scoped to the **current workspace + tab** context. Ideal for per-session state that should be isolated per user tab.

```python
# Read a value
count = await self.tab_db.get("my_table", "my_key")

# Write / sync values (triggers reactive frontend hooks)
await self.tab_db.sync("my_table", {
    "key1": "value1",
    "key2": 42
})
```

### `self.db` — Global Database
Reads and writes to the **global shared** workspace, accessible across all tabs.

```python
config = await self.db.get("app_config", "theme")
await self.db.sync("app_config", {"theme": "dark"})
```

> [!TIP]
> After calling `self.tab_db.sync(...)`, the OpenChad subscription system automatically broadcasts a change event to all React hooks subscribed via `useDatabase` in the same workspace/tab context. This means your UI updates **reactively** without polling.

---

## Lifecycle Methods

| Method | When Called | Use Case |
|:---|:---|:---|
| `on_register(self)` | When the tool is first loaded or hot-reloaded. | Initialize connections, load config, warm up caches. |
| `on_unregister(self)` | When the tool is removed or before a hot-reload. | Close connections, flush state, cleanup resources. |

---

## Built-in LLM Access

Tools can call the active local LLM model directly via the `llm_tool` helper. This is useful when you want the AI model to pick a sub-action using natural language.

```python
async def tool_func(**kwargs):
    title = kwargs.get("title", None)
    if title:
        await self.tab_db.set("message_state", "title", title)
    return {"result":"OK"}      
update_title = ToolRegistry(call=tool_func, schema={
    "type": "function",
    "function": {
        "name": "update_title",
        "description": "Generate a title based on its content",
        "parameters": {
            "type": "object",
            "properties": {
              "title": {
                  "type": "string",
                  "description": "1-5 word title"
              }
            },
            "required": ["title"]
        }
    }
})
query = (
    "Generate a concise, 1-5 word title."
    "### Guidelines:"
    "- The title should clearly represent the main theme or subject of the conversation."
    "- Write the title in the chat's primary language; default to English if multilingual."
    "- Prioritize accuracy over excessive creativity; keep it clear and simple."
    "- Ensure no conversational text, affirmations, or explanations precede"
    "### Chat History:"
    f"{json.dumps(self.r)}"
            )
try:
    res = await self.llm_tool(query, "update_title", tool_registry={"update_title": update_title})
    logger.info(f"[{self.__class__.__name__}] Title: {json.dumps(res)}")
except Exception as e:
    logger.error(f"[{self.__class__.__name__}] Error calling LLM: {str(e)}")
```



---

## Step 3 — Call Your Tool from the Frontend

The `useTool` hook from `openchad-react` wraps `pyInvoke("tools/execute", ...)` with a clean, typed executor function.

### TypeScript Signature

```typescript
// useTool returns a typed executor function:
const tool: (
  toolName: string,
  parameters: Record<string, any>
) => Promise<T> = useTool<T>();
```

### Basic Usage

```typescript
import { useTool } from 'openchad-react';

const tool = useTool<{ count: number; action: string }>();

// Call the counter tool directly
const result = await tool("counter", {
  action: "increment",
  value: 1
});

console.log(result.count); // → updated counter value
```

### Passing an LLM Model

You can pass a `model` key alongside your tool parameters to route the invocation through a specific local or cloud LLM model:

```typescript
const summary = await tool("llm_summirizer", {
  model: "litellm/openrouter/openrouter/free",
  query: "summarize this : {{...}}",
});
```

## MCP Integration

When `"mcp_client"` is included in `allowed_callers`, your tool is automatically surfaced through OpenChad's MCP server. External AI clients (Claude Desktop, Cursor, etc.) can discover and call your tool without any extra configuration.

```python
# This single line exposes your tool over MCP
allowed_callers = ["direct", "code_execution", "mcp_client"]
```

## Hot Reloading

When you modify any tool at runtime it automatically reload the tool without restarting OpenChad:
This makes iterative development extremely fast — edit `main.py`, reload, and test immediately.
