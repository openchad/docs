---
outline: deep
---

# Creating a Custom App

An **App** is the React UI that lives alongside the chat panel in OpenChad. Every app is a standard React component — you receive a set of framework hooks through props, and the framework handles mounting, database scope, and communication with the Python backend for you.

The starter template (`src/App.tsx`) is itself a fully working app. It demonstrates a reactive counter stored in the database, a tool call, and responsive layout — everything you need to understand the lifecycle before building your own.

---

## Architecture Overview

```
src/main.tsx
  └─ <Container Apps={Apps} />        ← registers your apps & sets the layout split
        └─ defaultTab.tabs[]
              └─ { App: YourComponent }   ← your React component, mounted per tab
                    │
                    │  AppInfo props (injected by the framework)
                    ├─ useTool()          ← call Python tools
                    ├─ useTabDatabase()   ← per-tab reactive key-value store
                    └─ ...               ← other hooks from openchad-react
```

The `Container` reads `AppsProps`, renders the split-pane shell (chat on one side, your app on the other), and injects live hooks into your component as plain props.

---

## Step 1 — Edit `src/App.tsx`

Your app is a default-exported React function that accepts `AppInfo` as its argument:

```tsx
// src/App.tsx
import type { AppInfo } from "openchad-react"

export default function App(appInfo: AppInfo) {
  const { useTool, useTabDatabase } = appInfo

  return <div>Hello, OpenChad!</div>
}
```

> [!TIP]
> `AppInfo` is destructured from the single props argument, not from React props in the usual sense. The framework calls `<App {...appInfo} />` internally, so every hook arrives as a named property.

---

## Step 2 — Register Your App in `src/main.tsx`

`main.tsx` is the single place where you declare which components to mount, how the panel splits, and what the layout looks like.

```tsx
// src/main.tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import './globals.css'
import App from './App'
import { Container, type AppsProps } from "openchad-react"

const Apps: AppsProps = {
  defaultTab: {
    layout: "horizontal",   // "horizontal" = chat left, app right
    icon: "default",
    tabs: [
      {
        appname: "main-app",  // unique identifier for this tab
        data: {},             // static data forwarded to the component
        App: App,             // your React component
      },
    ],
  },
  size: [80, 20],            // [chat%, app%] — how the split is sized
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Container Apps={Apps} />
  </React.StrictMode>,
)
```

### `AppsProps` Fields

| Field | Type | Description |
|:---|:---|:---|
| `defaultTab` | `object` | The tab configuration shown by default. |
| `defaultTab.layout` | `"horizontal"` | Panel orientation. `"horizontal"` places chat and app side-by-side. |
| `defaultTab.icon` | `string` | Icon key used in the tab bar. |
| `defaultTab.tabs` | `TabDef[]` | One entry per app tab (see below). |
| `size` | `[number, number]` | Percentage split between chat and app panels. Must sum to 100. |

### `TabDef` Fields

| Field | Type | Description |
|:---|:---|:---|
| `appname` | `string` | Unique identifier for the tab. Used for scoping and routing. |
| `data` | `object` | Arbitrary static data injected into the component alongside `AppInfo`. |
| `App` | `React.ComponentType<AppInfo>` | The React component to mount. |

---

## `AppInfo` — Hooks Injected by the Framework

These arrive as props on your component. Destructure what you need.

```tsx
export default function App({ useTool, useTabDatabase, useFile, useFolder, useGlobal, useElementSize }: AppInfo) {
  // ...
}
```

---

### `useTabDatabase<T>(key, options?)`

Reactive key-value storage scoped to the **current tab**. Changes persist across sessions and sync in real time.

```tsx
const [state, setState] = useTabDatabase("my-key", { initialValue: { count: 0 } })

// Read
console.log(state.count)

// Write (merges with existing value)
setState({ count: state.count + 1 })
```

| Parameter | Type | Description |
|:---|:---|:---|
| `key` | `string` | Storage key, scoped to this tab. |
| `options.initialValue` | `T` | Value written on first use if none exists. |

Returns `[value, setValue]` — the same shape as `useState`, but backed by the persistent database.

---

### `useTool<T>()`

Returns a function that calls any registered Python tool. Under the hood this is `pyInvoke("tools/execute", ...)`.

```tsx
const tool = useTool()

// Call a Python tool by name
const result = await tool("counter", {
  action: "increment",
  value:  1,
})
```

```tsx
// Typed return value
const tool = useTool<{ result: number }>()
const { result } = await tool("my-tool", { input: "hello" })
```

| Parameter | Type | Description |
|:---|:---|:---|
| `tool` | `string` | The registered tool name (matches the Python tool's `name` field). |
| `parameters` | `Record<string, any>` | Arguments forwarded to the Python handler. |


### `useFile(filename, options?)`

Read, write, and watch a file on disk relative to the app's data directory.

```tsx
const [content, setContent, fileInfo] = useFile("notes.txt", {
  initialValue: "# My Notes\n",
})

// Read
console.log(content)

// Write
await setContent("Updated content")
```

Common options:

| Option | Type | Description |
|:---|:---|:---|
| `initialValue` | `string` | Default content if the file doesn't exist. |
| `baseDir` | `string` | Override the base directory. |
| `download` | `boolean` | When `true`, triggers a browser download instead of writing to disk. |
| `width` / `height` | `number` | For image files: resize on read. |
| `quality` | `number` | For image files: JPEG quality (0–100). |


### `useFolder(path, options?)`

Watch a directory and get a live listing of its contents.

```tsx
const [entries, refresh] = useFolder("my-data/", { baseDir: "appData" })

// entries: array of { name, path, isDir, size, ... }
entries.forEach(e => console.log(e.name))
```


### `useGlobal<T>(key, options?)`

Like `useTabDatabase`, but **shared across all tabs and app instances** — useful for app-wide settings or state that must survive tab switches.

```tsx
const [settings, setSettings] = useGlobal("some-settings", {
  initialValue: { enabled: false },
})
```

### `useElementSize<T extends HTMLElement>()`

Returns a ref and a `{ width, height }` object that updates whenever the element resizes. Essential for responsive layouts inside a resizable split pane.

```tsx
const [containerRef, { width, height }] = useElementSize<HTMLDivElement>()

const isMobile = width > 0 && width < 640

return (
  <div ref={containerRef}>
    {isMobile ? <CompactView /> : <FullView />}
  </div>
)
```

## Calling Python Directly: `usePython`

For advanced use cases, you can import `usePython` directly from `openchad-react` to get raw access to `pyInvoke`:

```tsx
import { usePython } from "openchad-react"

export default function App() {
  const { pyInvoke } = usePython()

  async function listTools() {
    const tools = await pyInvoke("tools")
    console.log(tools)
  }

  return <button onClick={listTools}>List tools</button>
}
```

`pyInvoke(command, args?)` maps directly to the Tauri command bridge. All built-in backend commands (`"chat"`, `"tools"`, `"tools/execute"`, etc.) are available this way.

---

## Minimal Working App

A complete, self-contained app that stores and displays a counter:

```tsx
// src/App.tsx
import type { AppInfo } from "openchad-react"

export default function App({ useTabDatabase }: AppInfo) {
  const [data, setData] = useTabDatabase("counter", { initialValue: { n: 0 } })

  return (
    <div className="flex flex-col items-center justify-center h-full gap-4">
      <span className="text-6xl font-bold tabular-nums">{data.n}</span>
      <button
        className="px-6 py-2 rounded-lg border border-accent/50 text-accent"
        onClick={() => setData({ n: data.n + 1 })}
      >
        Increment
      </button>
    </div>
  )
}
```

No changes to `main.tsx` needed — just swap in this component and save.

## Responsive Layout Pattern

The app panel is a resizable pane. Always anchor a `useElementSize` ref to your root element and derive layout decisions from `width`:

```tsx
import { useElementSize, type AppInfo } from "openchad-react"

export default function App({ useTabDatabase }: AppInfo) {
  const [containerRef, { width }] = useElementSize<HTMLDivElement>()
  const isMobile = width > 0 && width < 640

  return (
    <div ref={containerRef} className="w-full h-full p-4">
      <div className={`grid gap-4 ${isMobile ? "grid-cols-1" : "grid-cols-2"}`}>
        {/* content */}
      </div>
    </div>
  )
}
```

## Calling a Tool from the UI

Tools registered in the Python backend are callable from any app component. See [Custom Tools](/customization/custom-tools) for how to write them.

```tsx
export default function App({ useTool }: AppInfo) {
  const tool = useTool<{ summary: string }>()

  async function summarize(text: string) {
    const result = await tool("summarize", {
      model: "litellm/openai/gpt-4o-mini",
      text,
    })
    console.log(result.summary)
  }

  return (
    <textarea
      placeholder="Paste text here…"
      onBlur={(e) => summarize(e.target.value)}
    />
  )
}
```

## Multi-Tab Apps

You can register multiple components as separate tabs in `main.tsx`:

```tsx
import Dashboard from './apps/Dashboard'
import Settings from './apps/Settings'
import { Container, type AppsProps } from "openchad-react"

const Apps: AppsProps = {
  defaultTab: {
    layout: "horizontal",
    icon: "default",
    tabs: [
      { appname: "dashboard", data: {}, App: Dashboard },
      { appname: "settings", data: {}, App: Settings },
    ],
  },
  size: [60, 40],
}
```

Each tab gets its own isolated `useTabDatabase` scope (`appname` is used as part of the key). `useGlobal` state is shared between all tabs.


## Adjusting the Panel Split

The `size` field in `AppsProps` controls how much horizontal space each panel takes:

```tsx
size: [80, 20]   // chat gets 80%, app gets 20%  ← default (chat-heavy)
size: [50, 50]   // even split
```

## File & Directory Reference

```
src/
├── App.tsx          ← your app component (edit this)
├── main.tsx         ← registers apps and sets layout (edit this)
└── globals.css      ← global styles / Tailwind base
```

