---
outline: deep
---

# Creating Custom Pipelines

A **Pipeline** is OpenChad's most powerful extension point. While [Custom Tools](/customization/custom-tools) handle discrete, stateless function calls, a Pipeline sits **between the user's message and the LLM**, controlling the entire generation lifecycle — building the prompt, processing every streamed chunk, persisting content, executing tool calls in a loop, and finalizing the response.

The built-in `Chat` pipeline (located at `Pipeline/openchad/chat/main.py`) is itself a pipeline — everything OpenChad does out of the box is built on the same API you use to create custom ones.

## Architecture Overview

```
User sends a message
        │
        ▼
┌───────────────────────────────────────┐
│          _setup_pipeline()            │  ← loads & instantiates your Pipeline class
│          pipeline.setup()             │  ← async DB init, history loading
└───────────────┬───────────────────────┘
                │
        ┌───────▼──────────────────────────────────────┐
        │  while is_continue:          (agentic loop)   │
        │                                               │
        │    pipeline.start()          ← build messages │
        │    LLM streams chunks…                        │
        │      pipeline.process_chunk()  ← per chunk    │
        │    pipeline.end()            ← tool routing   │
        │    pipeline.attempt += 1                      │
        └───────────────────────────────────────────────┘
                │
                ▼
        pipeline.finalize()           ← flush parser, write final content
        pipeline.stop()               ← mark done, generate title
```

The loop continues as long as your `end()` implementation calls `self.set_continue(True)` — for example when the model returned tool calls that need to be executed before the next LLM turn.

---

## Step 1 — Create Your Pipeline File

Pipelines live inside the `Pipeline/` directory, in named subfolders:

```
Pipeline/
└── {{publisher}}/
    └── my_pipeline/
        └── main.py   ← your custom pipeline
```

> [!IMPORTANT]
> The file **must** be named `main.py` and **must** export `Pipeline = YourClass` at the bottom.

---

## Step 2 — Subclass `PipelineBase`

```python
from openchadpy.pipeline_base import PipelineBase
from typing import Any, Dict, List, Optional
import logging

logger = logging.getLogger(__name__)


class MyPipeline(PipelineBase):

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        # Any sync initialization goes here
        self.prompt = "You are a helpful assistant."
        self.accumulated_text = ""

    # ── Lifecycle hooks (override what you need) ──────────────────────────

    async def setup(self) -> None:
        """Called once after instantiation. Use for async DB reads, history loading."""
        pass

    async def start(self, **kwargs) -> None:
        """Called at the beginning of each loop iteration.
        Build self.messages here, or handle tool-call results."""
        if not self.messages:
            history = await self.get_history()
            self.messages = (
                [{"role": "system", "content": self.prompt}]
                + history
                + [{"role": "user", "content": self.query}]
            )

    async def process_chunk(self, chunk, **kwargs) -> Any:
        """Called for every streamed chunk. Return a chunk to pass it downstream,
        or return None to suppress it."""
        if isinstance(chunk, dict):
            delta = chunk.get("choices", [{}])[0].get("delta", {})
            self.accumulated_text += delta.get("content", "")
        return chunk

    async def finalize(self, **kwargs) -> Any:
        """Called after the stream ends normally (not on stop/cancel).
        Return any remaining content to be emitted, or None."""
        return None

    async def response(self, res, **kwargs) -> Any:
        """Non-streaming path equivalent of process_chunk + finalize."""
        return res

    async def end(self, **kwargs) -> None:
        """Called at the end of each loop iteration.
        Call self.set_continue(True) to loop again (e.g. after tool calls)."""
        if self.set_continue:
            self.set_continue(False)   # Don't loop again

    async def stop(self, **kwargs) -> None:
        """Called once when the entire generation finishes (stream or cancel)."""
        logger.info("Pipeline done. Full text: %s", self.accumulated_text)


# Required export
Pipeline = MyPipeline
```

---

## PipelineBase Reference

### Attributes Available in Every Hook

These are set by the framework before any hook is called. You can read and write them freely.

#### Identity & Routing

| Attribute | Type | Description |
|:---|:---|:---|
| `self.query` | `str \| None` | The raw user query string. |
| `self.workspace` | `str \| None` | Current workspace identifier. |
| `self.tab_id` | `str \| None` | Current tab identifier. |
| `self.branch_id` | `str \| None` | Current message branch hash. |
| `self.response_branch` | `int \| None` | Which response variant is being written. |
| `self.index` | `int \| None` | Message index in the conversation chain. |
| `self.tb` | `str \| None` | Full table key for the current message record (`msg_{branch}_{index}`). |
| `self.attempt` | `int` | How many loop iterations have completed (0-based, incremented by the runner). |
| `self.model_id` | `str \| None` | The model ID requested by the frontend. |
| `self.model_name` | `str \| None` | Human-readable model name. |
| `self.pricing` | `dict \| None` | Per-token pricing dict (`prompt`, `completion`, etc.). |

#### Messages & Tools

| Attribute | Type | Description |
|:---|:---|:---|
| `self.messages` | `List[dict]` | The messages list sent to the LLM. Set this in `start()`. If empty after `start()`, the runner falls back to a minimal system + user message. |
| `self.args` | `dict` | Extra kwargs forwarded to `model_manager.chat()` (e.g. `tools`, `temperature`). Set in `start()`. |
| `self.tools` | `list` | OpenAI-format tool schemas. Populate in `__init__` from `self.tool_manager`. |
| `self.tool_calls` | `list \| None` | Accumulated tool call objects from the current stream. Populated by `process_chunk`. Reset to `None` by `start()` each iteration. |

#### State & History

| Attribute | Type | Description |
|:---|:---|:---|
| `self.history` | `List[dict]` | Conversation history loaded by `get_history()`. |
| `self.last_response` | `str` | The assistant text from the most recent completed iteration. |
| `self.files` | `list` | File references attached to the current message. |

#### Databases

| Attribute | Type | Description |
|:---|:---|:---|
| `self.tab_db` | `Database` | Scoped to the current workspace + tab. Use for per-session state. |
| `self.db` | `Database` | Global workspace database. |

#### Managers (read-only, framework-injected)

| Attribute | Description |
|:---|:---|
| `self.model_manager` | Run additional LLM calls. |
| `self.tool_manager` | Execute registered tools programmatically. |
| `self.mcp_manager` | Access MCP tool schemas and execution. |
| `self.event_emitter` | Emit custom events to the frontend. |
| `self.settings_manager` | Read application settings. |

#### Control Hooks

| Attribute | Type | Description |
|:---|:---|:---|
| `self.set_continue` | `Callable[[bool], None] \| None` | Call `self.set_continue(True)` inside `end()` to restart the loop (agentic multi-turn). |
| `self.cancel_event` | `asyncio.Event` | Set when the user cancels. Check `self.cancel_event.is_set()` in long operations. |

---

## Lifecycle Methods In Depth

### `setup(self) → None`

Called **once** immediately after instantiation and before the first `start()`. This is the right place for any async work that must complete before the pipeline is used — reading the existing DB record for this message, loading conversation history, etc.

The built-in Chat pipeline uses `setup()` to:
- Load the existing message record from `self.tab_db`
- Parse the JSON `content` field
- Allocate a slot in the `responses` array
- Call `get_history()` to populate `self.history`

```python
async def setup(self) -> None:
    # Load any persistent state needed before the stream begins
    config = await self.tab_db.get("pipeline_config", "settings")
    self.my_setting = config.get("value", "default") if config else "default"
```

---

### `start(self, **kwargs) → None`

Called at the **beginning of every loop iteration** — including the first pass and every subsequent tool-call round-trip.

On the **first call** (`self.attempt == 0`), `self.messages` is empty. Build it here from your system prompt, history, and the user query.

On **subsequent calls**, `self.tool_calls` contains the accumulated tool calls from the previous stream. Execute them and append `tool` role messages before sending the next LLM request.

```python
async def start(self, **kwargs) -> None:
    if not self.messages:
        # First iteration — build full message list
        self.messages = [
            {"role": "system", "content": self.prompt},
            *await self.get_history(),
            {"role": "user", "content": self.query},
        ]
        # Forward tools to the model
        self.args["tools"] = self.tools
    elif self.tool_calls:
        # Subsequent iteration — append tool call + results
        self.messages.append({
            "role": "assistant",
            "tool_calls": self.tool_calls,
            "content": "",
        })
        for tc in self.tool_calls:
            name = tc["function"]["name"]
            args = json.loads(tc["function"].get("arguments", "{}"))
            result = await self.tool_manager.execute_tool(name, **args)
            self.messages.append({
                "role": "tool",
                "tool_call_id": tc["id"],
                "content": json.dumps(result),
            })
        self.tool_calls = None
```

---

### `process_chunk(self, chunk, **kwargs) → Any`

Called for **every streamed chunk**. The `chunk` is a dict in OpenAI response format:

```python
{
  "choices": [{
    "delta": {
      "content": "Hello",          # text delta (may be empty)
      "tool_calls": [...],          # tool call deltas (may be absent)
    }
  }],
  "usage": { ... }                  # only on some providers/final chunk
}
```

**Return value rules:**
- Return the chunk (or a modified version) to pass it downstream to the frontend.
- Return `None` to suppress the chunk entirely.
- You can return a completely different dict if you want to inject synthetic content.

```python
async def process_chunk(self, chunk, **kwargs) -> Any:
    if not isinstance(chunk, dict):
        return chunk

    delta = chunk.get("choices", [{}])[0].get("delta", {})
    content = delta.get("content", "")

    if content:
        self.accumulated_text += content
        # Persist to DB on every chunk so the UI updates live
        await self.tab_db.sync("my_output", {"text": self.accumulated_text})

    return chunk
```

Special delta keys emitted by the framework itself:

| Key | Meaning |
|:---|:---|
| `delta.stop` | A normal stop signal — emit it and break the stream cleanly. |
| `delta.force_stop` | A hard stop — break the stream and prevent any further looping. |

---

### `finalize(self, **kwargs) → Any`

Called **once after the stream ends normally** (not triggered on cancel or early stop). Use this to flush any buffered state, do final DB writes, or return any last piece of content that should still be emitted.

```python
async def finalize(self, **kwargs) -> Any:
    # Write final summary to DB
    await self.tab_db.sync("my_output", {
        "text": self.accumulated_text,
        "done": True,
    })
    return None  # Nothing extra to emit
```

---

### `end(self, **kwargs) → None`

Called at the **end of each loop iteration**, after `finalize`. This is where you decide whether the loop should run again.

Call `self.set_continue(True)` to trigger another iteration (the runner will call `start()` again). The classic use-case is agentic tool calling: if the model returned tool calls, execute them in `start()` on the next iteration.

```python
async def end(self, **kwargs) -> None:
    has_tool_calls = bool(self.tool_calls)
    if self.set_continue:
        self.set_continue(has_tool_calls)   # loop again only if tool calls present
```

> [!WARNING]
> If the stream was stopped externally (user cancelled), `set_continue(True)` is **ignored** by the runner. You don't need to guard against it.

---

### `stop(self, **kwargs) → None`

Called **once when the entire generation finishes**, whether it completed normally, was cancelled, or raised an exception. Use this for final cleanup — marking `isStreaming = False`, closing connections, etc.

```python
async def stop(self, **kwargs) -> None:
    await self.tab_db.set("message_state", "isStreaming", False)
    logger.info("Pipeline complete after %d attempt(s)", self.attempt)
```

---

### `response(self, res, **kwargs) → Any`

The **non-streaming equivalent** of `process_chunk` + `finalize`. Called with the full response dict when the frontend requested `stream: false`. If you only use streaming, you can leave this as a pass-through.

```python
async def response(self, res, **kwargs) -> Any:
    if isinstance(res, dict):
        content = res["choices"][0]["message"]["content"]
        await self.tab_db.sync("my_output", {"text": content})
    return res
```

---

### `get_history(self) → List[dict]`

A helper you can call from `setup()` or `start()` to walk the message chain stored in the DB and return a chronological list of `{"role": ..., "content": ...}` dicts. The default implementation in `PipelineBase` returns `[]` — override it if you need custom history retrieval.

The built-in Chat pipeline's `get_history()` walks the linked message tree using the `self.tb` / `self.branch_id` chain, mirroring the frontend's navigation logic.

---

## Built-in LLM Helper: `llm_tool`

`PipelineBase` exposes `self.llm_tool()` — the same helper available in tools. Use it to make a secondary LLM call (e.g. to generate a title, classify intent, or route to a sub-action) without affecting the main streaming pipeline.

```python
result = await self.llm_tool(
    query="Summarize this in 5 words.",
    tool_name="update_title",          # optional: force a specific tool
    tool_registry={"update_title": my_registry_obj},
)
```

---

## Accessing Tools from a Pipeline

In `__init__`, load all available tool schemas once so the model knows what it can call:

```python
def __init__(self, **kwargs):
    super().__init__(**kwargs)
    self.tools = self.tool_manager.get_openai_schemas() if self.tool_manager else []
    if self.mcp_manager:
        self.tools.extend(self.mcp_manager.get_openai_schemas())
```

Then in `start()`, pass them to the model via `self.args`:

```python
self.args["tools"] = self.tools
```

To execute a tool call result returned by the model, use `self.tool_manager.execute_tool(name, **kwargs)` inside `start()` on the second (and later) iterations.


## Directory Reference

```
Pipeline/
└── {{publisher}}/          ← namespace (can be your app name)
    └── my_pipeline/
        └── main.py    ← must export Pipeline = YourClass
```

The pipeline loader resolves names as `{namespace}/{pipeline_name}`, matching the folder structure under `Pipeline/`. The built-in chat pipeline is at `openchad/chat`.
