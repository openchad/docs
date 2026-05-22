---
outline: deep
---

# Package Core & Global APIs

The root of the `openchad-react` package (exported via `index.ts`) provides the core bootstrapping component `Container` along with global-scoped hooks. 

Unlike the tab-scoped hooks provided within the `AppInfo` context, these root hooks operate within a **global workspace scope**, making them ideal for high-level widgets, sidebars, dashboard states, and cross-tab synchronizations.

---

## The Bootstrapping Shell: `Container`

The `Container` component is the main shell of the OpenChad workspace. It initializes the platform theme, monitors the keyboard state globally, manages multi-view grid splitters, and renders the default sidebar and window controls (minimizing, maximizing, and closing windows tailored to Windows or macOS presentation).

### Usage

```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { Container, type AppsProps } from 'openchad-react'
import MyChatApp from './apps/Chat'
import MySettingsApp from './apps/Settings'

const appsConfig: AppsProps = {
  defaultTab: {
    layout: 'single', // 'single' | 'horizontal' | 'vertical' | 'grid2x2' | 'triple' ...
    icon: 'message-square',
    tabs: [
      {
        appname: 'Chat',
        data: null,
        App: MyChatApp
      }
    ]
  },
  appRegistry: {
    'Chat': MyChatApp,
    'Settings': MySettingsApp
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Container Apps={appsConfig} />
  </React.StrictMode>
)
```

### Layout Types

```tsx
export type LayoutType =
  | "horizontal"    // Side by side (1x2)
  | "vertical"      // Top and bottom (2x1)
  | "grid2x2"       // 2x2 grid (4 views) 
  | "triple"        // 3 views: 3 horizontal stacked
  | "triple-left"   // 3 views: 1 left, 2 right stacked
  | "triple-right"  // 3 views: 2 left stacked, 1 right
  | "triple-top"    // 3 views: 1 top, 2 bottom side by side
  | "triple-bottom" // 3 views: 2 top side by side, 1 bottom
  | "single";       // Single view (no split)
```
### Type Definitions

#### `AppsProps`
Configuration passed to the `Container` shell to configure default tabs and register sub-apps.
```typescript
interface AppsProps {
  defaultTab: DefaultTab;                             // Initial tab(s) to load
  appRegistry?: Record<string, React.ComponentType<AppInfo>>; // Map of app names to React components
  iconRegistry?: Record<string, LucideIcon>;          // Optional custom Lucide icons mapping
  size?: number[];                                    // Initial panel percentage sizes
}
```

#### `DefaultTab`
```typescript
interface DefaultTab {
  layout: LayoutType;  // Multi-view layout name ('single', 'horizontal', 'vertical', ...)
  icon: string;        // Fallback default icon name
  tabs: Tab[];         // Pre-loaded list of tabs
}
```

#### `Tab`
```typescript
interface Tab {
  appname: string;                   // Registered app name
  data: any;                         // Optional initial state data passed to the app
  App: React.ComponentType<AppInfo> // App react component expecting AppInfo context
}
```

---

## Global React Hooks

These hooks are imported directly from `openchad-react` and represent workspace-wide features.

### `useDatabase`
Creates or connects to a **global-scoped** reactive database. Unlike `AppInfo.useTabDatabase` which isolates data per-tab, `useDatabase` shares data workspace-wide under the same key.

It automatically generates a consistent 32-character ID hash of the name prefixed by `tb_` to store it securely in the SQLite backend.

* **Signature**: `useDatabase<T>(tb: string, options?: { initialValue?: T })`
* **Example**:
  ```tsx
  import { useDatabase } from 'openchad-react'

  function App() {
    const [colsDb, setColsDb, {ready}] = useDatabase("cols", { initialValue: { currentCols: ["name", "age", "", ""] } });

    if (!ready) return <div>Loading cols...</div>;

    return (
      <div>
        {JSON.stringfy(colsDb)}
      </div>
    );
  }
  ```

### `useGlobal`
Creates or accesses a global-scoped reactive key-value state shared across tabs and components.
* **Signature**: `useGlobal<T>(tb: string, options?: { initialValue?: T })`
* **Example**:
  ```tsx
  import { useGlobal } from 'openchad-react'

  const [count, setCount] = useGlobal<number>('global_counter', { initialValue: 0 });
  ```

### `useTool`
Invokes and executes system or AI tools globally.
* **Signature**: `useTool<T>()`
* **Returns**: `(tool: string, parameters: Record<string, any>) => Promise<T>`
* **Example**:
  ```tsx
  import { useTool } from 'openchad-react'

  const executeTool = useTool<string>();
  const searchResults = await executeTool('web_search', { query: 'Top 10 Programming Language' });
  ```

### `useFile`
Binds reactively to a file in the global workspace storage context. It permits reading, writing, and synchronization of files.
* **Signature**: `useFile(filename: string, options?: FileOptions)`
* **Example**:
  ```tsx
  import { useFile } from 'openchad-react'

  const { content, write } = useFile('global_notes.txt', { initialValue: 'Shared notes...' });
  ```

### `useFolder`
Reactive binding to list, query, and monitor directories inside the global workspace storage directory.
* **Signature**: `useFolder(path: string, options?: FolderOptions)`

---

## Utility APIs

### `useElementSize`
A highly useful layout hook that reactively tracks and measures a DOM element's visual dimensions and styles.

* **Signature**: `useElementSize<T extends HTMLElement>()`
* **Returns**: 
  ```typescript
  [
    React.RefObject<T | null>,
    {
      width: number;
      height: number;
      overflowX: string;
      overflowY: string;
      aspectRatio: number;
    }
  ]
  ```
* **Example**:
  ```tsx
  import { useElementSize } from 'openchad-react'

  function ResizableBox() {
    const [boxRef, { width, height }] = useElementSize<HTMLDivElement>();

    return (
      <div ref={boxRef} className="w-full h-64 border resize overflow-auto">
        <p>Width: {width}px</p>
        <p>Height: {height}px</p>
      </div>
    );
  }
  ```

### `generateIdFromString`
A cryptographic helper to generate consistent 32-character hexadecimal IDs from string labels. Under the hood, it hashes the string using SHA-256 and slices it, adding a `tb_` prefix. This is primarily used to generate stable SQLite table names.

* **Signature**: `generateIdFromString(input: string): string`
* **Example**:
  ```typescript
  import { generateIdFromString } from 'openchad-react'

  const tableId = generateIdFromString("global/my_table");
  console.log(tableId); // Output: "tb_f3c80a2b0e..."
  ```
