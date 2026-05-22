---
outline: deep
---

# pyInvoke Command Reference

The `openchad-react` IPC architecture delegates high-performance computing, heavy filesystem monitoring, and local AI execution to a fast, asynchronous Python backend. These routines are triggered from React via the `pyInvoke` executor returned by the `usePython` hook.

Below is the complete API catalog for all **36+ commands** registered in the Python commands router. 

---

## 1. Database & Persistence

These commands enable transactional SQLite operations, table-level reactive bindings, and real-time syncing.

### `sqlite`
Executes direct database queries against core SQLite engines. Automatically manages connection pooling and notifies reactive frontend listeners when database mutations occur.

* **Reactive Sync Hook**: If the `command` field in the request is set to `"sync_table"` and the database query executes successfully, the Python engine triggers a dynamic update signal (`trigger_table_update(db, table)`). This refreshes all reactive hooks (such as `useDatabase`) bound to that specific database and table.
* **Request Structure**:
  ```typescript
  interface SqliteRequest {
    db: string;          // Database name/path
    command?: string;    // Action type (e.g. "sync_table")
    table?: string;      // Target table (required for sync_table triggers)
    query: string;       // SQL Query string
    params?: any[];      // Query placeholders
  }
  ```
* **Usage**:
  ```typescript
  const result = await pyInvoke("sqlite", {
    db: "workspace.db",
    command: "sync_table",
    table: "notes",
    query: "INSERT INTO notes (title, content) VALUES (?, ?)",
    params: ["My Title", "Dynamic Content"]
  });
  ```

### `db_subscribe`
Registers a persistent websocket/Tauri listener bound to updates in a specific table. Any subsequent writes to this table on the backend will trigger a state broadcast to the frontend.

* **Request Structure**:
  ```typescript
  interface DbSubscribeRequest {
    db: string;    // Database name
    table: string; // Table name
  }
  ```
* **Response**:
  ```typescript
  type DbSubscribeResponse = { success: true } | { error: string };
  ```

### `db_unsubscribe`
Tears down a reactive table listener subscription, freeing network resources.

* **Request Structure**: Same as `db_subscribe`.

---

## 2. File & Folder Operations

Handles file read/write buffers, recursive directory synchronization, and hooks into hot-reloading directory watchers.

| Command Label | Parameters | Return Type | Description |
|:---|:---|:---|:---|
| **`file`** | `{ path: string, ... }` | `any` | Dispatches file operations (reads, writes, attributes, metadata) to the backend `file_handler`. |
| **`file_subscribe`** | `{ filename: string, base_dir?: string }` | `{ success: boolean }` | Subscribes to changes for a specific file. Triggers local hot-reload events. |
| **`file_unsubscribe`** | `{ filename: string, base_dir?: string }` | `{ success: boolean }` | Removes the active change subscription watcher from a file. |
| **`folder`** | `{ path: string, ... }` | `any` | Dispatches folder listing, deletion, and creation requests to `folder_handler`. |
| **`folder_subscribe`** | `{ path: string, base_dir?: string }` | `{ success: boolean }` | Recursively watches a folder for new, renamed, or deleted files. |
| **`folder_unsubscribe`**| `{ path: string, base_dir?: string }` | `{ success: boolean }` | Disables recursive directory change notifications on the target path. |

> [!TIP]
> **Path Resolutions**: Both `file_subscribe` and `folder_subscribe` resolve files relative to the optional `base_dir` parameter. If `base_dir` is omitted, the project root `"."` is used as the workspace anchor.

---

## 3. Large Language Model (LLM) & Chat Services

These commands power local LLM orchestration, model unloading, directory-wide model scanning, and real-time streaming chat completions.

### `v1/chat/completions`
Standard OpenAI-compatible endpoint that initializes a local chat task in the background. The generation is ran as a fire-and-forget task asynchronously inside the Python event loop to prevent blocking network pipelines.
* **Token Streaming Protocol**: To stream tokens in real-time, pass `stream: true` and supply a unique `id` string in the request. The backend spawns a generator that pushes tokens into an active listener stream channel labeled **`chat_stream:${id}`**.
* **Request Structure**:
  ```typescript
  interface ChatCompletionRequest {
    id: string;               // Unique message identifier
    messages: Array<{ role: 'user' | 'assistant' | 'system', content: string }>;
    stream?: boolean;         // Triggers token chunk generator stream
    temperature?: number;
    max_tokens?: number;
  }
  ```
* **Response**:
  ```typescript
  interface ChatCompletionResponse {
    status: "processing";
    id: string;
    stream_end: false;
  }
  ```

### `v1/chat/stop`
Forces the generation loop for an active streaming message ID to stop immediately, releasing local LLM context.
* **Request Structure**: `{ id: string }`
* **Response**: `{ success: boolean, id: string }`

### `v1/chat/status`
Checks if a particular token streaming process is actively computing.
* **Request Structure**: `{ id: string }`
* **Response**: `{ active: boolean, id: string }`

### `v1/check`
Returns a unified global state showing if any streaming generations are running.
* **Request Structure**: `{}`
* **Response**: `{ result: boolean }` — Returns `true` if there are **zero** active generation tasks in the queue, indicating the backend is completely idle.

### `v1/models/unload`
Releases a specific model from high-performance VRAM/RAM storage.
* **Request Structure**: `{ model_id: string }`
* **Response**: `{ success: boolean, model_id: string }`

### `v1/models/unload_all`
Clears VRAM by unloading all active neural models currently managed by the system.
* **Response**: `{ success: boolean }`

### `v1/models/scan`
Triggers a file scanner inside configured local folders to list available models (e.g. `.gguf` files).
* **Response**: `Array<{ model_id: string, name: string, path: string, sizeBytes: number }>`

---

## 4. System Tools & MCP Command Engine

These endpoints power the Model Context Protocol (MCP) client managers and allow custom Python tools to be dynamic, hot-reloaded, and executed directly.

### `tools`
Fetches a list of all registered custom Python tools formatted as standard **OpenAI function schemas**.

* **Response**:
  ```typescript
  interface ToolsResponse {
    tools: Array<{
      type: "function";
      function: {
        name: string;
        description: string;
        parameters: Record<string, any>;
      };
    }>;
  }
  ```

### `tools/claude`
Fetches all active tools formatted inside **Anthropic Claude-compatible** JSON schemas.

* **Response**:
  ```typescript
  interface ClaudeToolsResponse {
    tools: Array<{
      name: string;
      description: string;
      input_schema: Record<string, any>;
    }>;
  }
  ```

### `tools/schemas`
Retrieves raw system tool configuration maps directly from the tool manager context.

### `tools/execute`
Runs a specific Python-registered tool in a specified workspace and tab context.

* **Request Structure**:
  ```typescript
  interface ToolExecuteRequest {
    tool: string;              // Name of tool to execute
    workspace?: string;        // Defaults to "global"
    tabId?: string;            // Defaults to "global"
    model?: string;            // Specific active model ID (optional)
    [arg: string]: any;        // All other key-values are passed as kwargs to the tool
  }
  ```
* **Response**: The dynamic return output of the Python tool or `{ error: string }`.

### `tools/reload`
Dynamically re-scans a specific Python tool's file contents and reloads the module logic on the fly without restarting the application.
* **Request Structure**: `{ tool: string }`
* **Response**: `{ success: boolean, tool: string }`

---

### Model Context Protocol (MCP) Interface

OpenChad connects to external MCP Servers to expose rich integrations like filesystem utilities, search interfaces, and databases.

#### `mcp_tool`
Aggregates and returns OpenAI function schema mappings for all active tools exposed by every connected MCP server.

#### `mcp_tool/reload`
Restarts a specified MCP Server and rebuilds its dynamic tool mappings.
* **Request Structure**: `{ server_name: string }`
* **Response**: `{ result: 'ok' }` or `{ error: string }`

#### `mcp_tool/statuses`
Returns current connection logs, active pipelines, and error codes for all registered MCP servers.
* **Response**:
  ```typescript
  interface McpStatusResponse {
    statuses: Record<string, {
      status: "connected" | "connecting" | "disconnected" | "error";
      active_tools_count: number;
      last_error?: string;
    }>;
  }
  ```

---

## 5. Settings Configuration Engine

These endpoints read, write, and subscribe to application-wide and user configuration registries.

```
                  ┌──────────────┐
                  │ settings/set │
                  └──────┬───────┘
                         ▼
┌──────────────┐   ┌─────────────┐   ┌───────────────────┐
│ settings/get ├──►│ Config File ├──►│ settings/subscribe│──► [React UI Hooks]
└──────────────┘   └─────────────┘   └───────────────────┘
```

| Command Label | Parameters | Return Type | Description |
|:---|:---|:---|:---|
| **`settings/get`** | `{ key: string }` | `{ key: string, value: any }` | Retrieves the value of a key from configuration files. |
| **`settings/get_all`** | `{}` | `{ settings: Record<string, any> }` | Fetches the complete active key-value configuration database. |
| **`settings/set`** | `{ key: string, value: any }` | `{ success: boolean, key: string }` | Saves a configuration setting to files and broadcasts updates. |
| **`settings/reset`** | `{ key: string }` | `{ success: boolean, key: string }` | Resets a specific key back to its default value. |
| **`settings/sources`** | `{}` | `{ sources: Array<{ path: string, type: string }> }` | Lists all configuration layers (e.g. defaults, user config, workspaces). |
| **`settings/subscribe`** | `{}` | `{ success: boolean }` | Subscribes the current connection to live changes. |
| **`settings/unsubscribe`**| `{}` | `{ success: boolean }` | Removes configuration change subscriptions. |

---

## 6. Utilities & System Diagnostics

Diagnostic commands checking host-level configurations and system statuses.

### `get_last_startup_status`
Fetches a detailed dictionary of system boot items, containing logs, loading speeds, and success flags.
* **Response**:
  ```typescript
  interface StartupStatus {
    startup_time_ms: number;
    initialization_steps: Array<{ step: string, status: "completed" | "failed", duration_ms: number }>;
  }
  ```

### `credentials`
Scans local directories and parses secure key configurations for third-party platforms (e.g. OpenAI, Anthropic, HuggingFace).
* **Response**: Returns decrypted credential checks.

### `os`
Dispatches a request to retrieve the host-level operating system name.
* **Response**:
  ```typescript
  interface OsResponse {
    os: "win32" | "linux" | "darwin";
  }
  ```

### `get_plugin_dirs`
Retrieves the list of active local plugin storage folders loaded by OpenChad.
* **Response**: `string[]` (list of directory paths)
