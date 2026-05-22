---
outline: deep
---

# usePython Hook & Backend Events

The `openchad-react/components/usePython` module is the primary engine driving **Inter-Process Communication (IPC)** in OpenChad. It provides unified, dual-mode interfaces that seamlessly switch between desktop environments (desktop app via native Tauri plugin channels) and web browser wrappers (web interface via WebSockets and HTTP fallbacks).

> [!NOTE]
> For a complete catalog of all commands and parameters you can dispatch through this interface, refer to the [pyInvoke Command Reference](./pyinvoke-commands.md).

---

## TypeScript API Definitions

Here are the complete typings exported by the `openchad-react` Python integration layer:

```typescript
export type EventHandler<T = any> = (data: T) => void;

export interface UsePythonReturn {
  /** 
   * Asynchronously triggers a Python backend command.
   * Seamlessly resolves with either a standard promise response OR an AsyncGenerator
   * yielding real-time stream updates.
   */
  pyInvoke: <T = any>(
    label: string,
    data?: Record<string, unknown> | ArrayBufferLike | Blob | ArrayBufferView,
    timeout?: number
  ) => Promise<T | void | AsyncGenerator<T, void, unknown>>;

  /** Reactive boolean indicating whether the communication pipe is established and ready. */
  isStreamReady: boolean;
}
```

---

## Direct IPC Bridge: `usePython`

The core `usePython` hook returns reactive connection states and the `pyInvoke` executor, which is highly optimized to handle JSON RPC commands, binary media streaming, and real-time chunk streaming.

```typescript
import { usePython } from 'openchad-react';

const { pyInvoke, isStreamReady } = usePython();
```

### Return Values

#### `isStreamReady` (`boolean`)
A reactive boolean state indicating if the communication pipe is active. 
* **Tauri Desktop Mode**: Always `true` instantly upon component mounting.
* **WebSocket Browser Mode**: Set to `true` after the front-end completes a network handshake. The component sends a specialized system request `{ api: "stream_ready" }` over the socket; once resolved, `isStreamReady` turns `true`.

---


### Structured JSON Commands
Passing a standard JavaScript object will send a structured JSON packet to the Python command engine.

* **API Auto-Routing**: If the `label` starts with `api/` (e.g. `api/transcribe`), the hook automatically rewrites the packet under the hood. It dispatches a call to the generic `"api"` runner with parameter `{ api: "transcribe", ...data }` to match the Python commands registrar.

```typescript
const result = await pyInvoke<{ success: boolean }>(
  "workspace/create_folder", 
  { folderName: "MyWork" }
);
```


```typescript
const streamRes = await pyInvoke("v1/chat/completions", {
    id: activeId,
    query: query,
    stream: true,
    model: model.id,
    tab_id: AppInfo.tabId,
    branch_id: branchId,
    index: index,
    response_branch: response_branch,
    tb: targetTable,
    workspace: workspace,
    app_name: AppInfo.appname,
    pipeline: AppInfo.settings["Others/app_settings/string.pipeline"]?.value || "openchad/chat"
});
if (streamRes && typeof streamRes === 'object' && Symbol.asyncIterator in streamRes) {
    var iter = 0;
    for await (const _ of streamRes as any) {
        iter++;
    }
}
```

---

## Backend Event Subscriptions

### `usePythonEvent`
A React hook that subscribes to real-time events published asynchronously by the Python backend. It handles all setup and teardown, converting native Tauri event emitters or WebSocket channels transparently.

```typescript
function usePythonEvent<T = any>(event: string, handler: EventHandler<T>): void;
```

> [!IMPORTANT]
> **Performance Optimization**: `usePythonEvent` wraps your handler callback inside a React `useRef`. This means parent component re-renders will *never* tear down or cause redundant sub/unsub network overhead unless the `event` name string itself changes.

```tsx
import { usePythonEvent } from 'openchad-react';

usePythonEvent<{ progress: number }>("index_progress", (payload) => {
  console.log(`System indexing progress: ${payload.progress}%`);
});
```

### `oncePythonEvent`
Subscribes to an event exactly **once** and resolves a Promise with the first payload, instantly tearing down the network listener afterwards.

```typescript
function oncePythonEvent<T = any>(event: string): Promise<T>;
```

```typescript
import { oncePythonEvent } from 'openchad-react';

async function waitForStartup() {
  const status = await oncePythonEvent<{ ready: boolean }>("python_boot_complete");
  console.log("Python backend is ready: ", status.ready);
}
```

---
