---
outline: deep
---

# AppInfo Context Interface

The `AppInfo` interface defines the complete, strongly-typed context injected into every sub-application and widget running inside OpenChad. It serves as the primary gateway for React components to manage tabs, mutate databases, query filesystem resources, track window parameters, and interact with backend Python pipelines.

---

## Complete Type Definition

Below is the complete, production-ready TypeScript definition for the `AppInfo` context:

```typescript
interface AppInfo {
  /** Registered application display name */
  appname: string;
  /** Unique id representing this application runtime instance */
  appId: string;
  /** Unique id representing the current tab */
  tabId: string;
  /** Key-Value settings record configured for this application workspace */
  settings: Record<string, SettingItem>;
  
  /** Returns the active workspace ID and a modifier function */
  useWorkspace: () => {
    workspace: string;
    setWorkspace: (workspace: string) => void;
  };
  
  /** Retrieves the active tab ID reactively */
  useActiveTabId: () => string;
  
  /** Tab title reactive hooks */
  useTitle: () => string | null;
  setTitle: (title: string) => void;
  
  /** Returns the current raw tab state object */
  useTab: () => ITab;
  
  /** Dynamically opens one or multiple tabs in split configurations */
  addTab: (
    tabs: { app: string; data?: Record<string, any> }[] | { app: string; data?: Record<string, any> }, 
    layout?: string
  ) => string[];
  
  /** Closes the active tab */
  closeTab: () => void;
  /** Detaches the current tab panel into a new system window */
  detachTab: () => void;
  
  /** Returns a boolean indicating if the notch titlebar is displayed */
  useNotchVisible: () => boolean;
  
  /** Returns the current visual theme ('dark' | 'light') and layout layout configuration */
  useTheme: () => {
    theme: string;
    layout: string;
  };

  /** Primary bridge callback to invoke asynchronous Python services */
  pyInvoke: <T = any>(
    label: string,
    data?: Record<string, unknown> | ArrayBufferLike | Blob | ArrayBufferView,
    timeout?: number
  ) => Promise<T | void | AsyncGenerator<T, void, unknown>>;
  
  /** Hook to run configured AI and workspace helper tools */
  useTool: () => (tool: string, parameters: Record<string, any>) => Promise<any>;
  
  /** Hook to retrieve the reactive, tab-isolated SQLite database state */
  useTabDatabase: <T>(tb: string, options?: {
    initialValue?: T | undefined;
  }) => UseDatabaseReturn<T>;
  
  /** Hook to manage the active LLM Model settings */
  useModel: () => UseDatabaseReturn<Model>;
  
  /** Asynchronously fetches a map of all installed LLM/API models */
  getAvailableModels: () => Promise<Model[]>;
  
  /** Accesses global shared key-value database records */
  useGlobal: <T>(name: string, options?: { initialValue?: T }) => UseGlobalReturn<T>;
  
  /** Watches and binds to files in the tab Storage folder (supports media URL mappings) */
  useFile: (filename: string, options?: FileOptions) => UseFileReturn;
  
  /** Watches and lists folder structures inside the tab Storage folder */
  useFolder: (path: string, options?: FolderOptions) => UseFolderReturn;
}
```

---

## Detailed Properties & Hooks

### 🆔 Basic Identifiers & Settings

#### `appname`
* **Type**: `string`
* **Description**: The registered name of the current sub-application (e.g. `'Chat'`, `'Editor'`, `'Dashboard'`).
* **Example**:
  ```tsx
  <h2>Welcome to {appInfo.appname}!</h2>
  ```

#### `appId`
* **Type**: `string`
* **Description**: A unique auto-generated ID representing this specific application runtime instance.
* **Example**:
  ```tsx
  console.log("Current App instance: ", appInfo.appId);
  ```

#### `tabId`
* **Type**: `string`
* **Description**: A unique auto-generated string UUID representing the tab panel in which this application is mounted.

#### `settings`
* **Type**: `Record<string, SettingItem>`
* **Description**: A key-value dictionary containing settings, for specific plugin `Backend`, `Pipeline`, `Tools`, `ModelProvider` and `Settings` parsed form its .toml.
* **Example**:
  ```tsx
  const apiKey = appInfo.settings['Others/app_settings/string.pipeline']?.value;
  ```

---

### 🏛️ Workspace & Tab Hooks

#### `useWorkspace()`
* **Signature**: `() => { workspace: string; setWorkspace: (workspace: string) => void }`
* **Description**: Hook returning the current active workspace directory name and a setter function to switch between workspaces.
* **Example**:
  ```tsx
  const { workspace, setWorkspace } = appInfo.useWorkspace();
  return (
    <div>
      <p>Active Workspace: {workspace}</p>
      <button onClick={() => setWorkspace("ProjectBeta")}>Switch to Beta</button>
    </div>
  );
  ```

#### `useActiveTabId()`
* **Signature**: `() => string`
* **Description**: Reactively returns the ID of the tab that currently has active layout focus in the multi-view grid.

#### `useTitle()` & `setTitle()`
* **Signature**: `useTitle: () => string | null` and `setTitle: (title: string) => void`
* **Description**: Reactive hooks to read and dynamically modify the tab header title.
* **Example**:
  ```tsx
  const title = appInfo.useTitle();
  
  return (
    <input 
      value={title ?? ""} 
      onChange={(e) => appInfo.setTitle(e.target.value)} 
      placeholder="Rename Tab..."
    />
  );
  ```

#### `useTab()`
* **Signature**: `() => ITab`
* **Description**: Returns the active `ITab` state object containing the configuration icon, display parameters, and tab payload.

---

### 📑 Tab Action Methods

#### `addTab()`
* **Signature**: `(tabs: TabConfig | TabConfig[], layout?: string) => string[]`
* **Description**: Dynamically spawns new tab instances into the multi-view layout, returning an array of generated tab IDs.
* **Parameters**:
  * `tabs`: A single tab configuration object `{ app: string, data?: any }` or an array of configurations.
  * `layout` (Optional): Target layout pattern (`'single'`, `'horizontal'`, `'vertical'`, `'grid2x2'`).
* **Example**:
  ```tsx
  const openDoublePreview = () => {
    appInfo.addTab([
      { app: "Editor", data: { file: "index.html" } },
      { app: "Preview", data: { port: 3000 } }
    ], "horizontal");
  };
  ```

#### `closeTab()`
* **Signature**: `() => void`
* **Description**: Asynchronously closes the current active tab and cleans up associated subscriptions.

#### `detachTab()`
* **Signature**: `() => void`
* **Description**: Detaches the current tab panel, launching it into a separate, native OS desktop window.

---

### 🎨 Visual & Layout Hooks

#### `useNotchVisible()`
* **Signature**: `() => boolean`
* **Description**: Returns `true` if the custom header notch/drag region is visible, which dictates whether padding adjustments are necessary for full-height layouts.

#### `useTheme()`
* **Signature**: `() => { theme: string; layout: string }`
* **Description**: Returns the current aesthetic configuration (e.g. `'dark'` or `'light'`) and layout orientation properties (`'leftToRight'` or `'rightToLeft'`).
* **Example**:
  ```tsx
  const { theme, layout } = appInfo.useTheme();
  console.log(`Render Mode: Theme=${theme}, Alignment=${layout}`);
  ```

---

### 🗃️ Reactive Database & State Hooks

#### `useTabDatabase()`
* **Signature**: `<T>(tb: string, options?: { initialValue?: T }) => UseDatabaseReturn<T>`
* **Description**: Creates or accesses an isolated, tab-scoped SQLite database table. Perfect for storing tab-specific local states like chats, documents, or UI scroll indices.
* **Example**:
  ```tsx
  const [messages, setMessages] = appInfo.useTabDatabase<string[]>("chat_history", {
    initialValue: []
  });
  ```

#### `useGlobal()`
* **Signature**: `<T>(name: string, options?: { initialValue?: T }) => UseGlobalReturn<T>`
* **Description**: Creates or accesses a shared workspace-wide reactive database. Useful for shared configurations or states.
* **Example**:
  ```tsx
  const [userToken, setUserToken] = appInfo.useGlobal<string>("session_token");
  ```

#### `useModel()` & `getAvailableModels()`
* **Signature**: `useModel: () => UseDatabaseReturn<Model>` and `getAvailableModels: () => Promise<Model[]>`
* **Description**: Hooks to manage active LLM model configurations and retrieve the full registry of available/installed models on the system.
* **Example**:
  ```tsx
  const [model, setModel] = appInfo.useModel();
  
  useEffect(() => {
    appInfo.getAvailableModels().then((models) => {
      if (models.length > 0) setModel(models[0]);
    });
  }, []);
  ```

---

### 🔗 Python & System Tools Bridge

#### `pyInvoke()`
* **Signature**: `<T = any>(label: string, data?: Record<string, unknown> | ArrayBufferLike | Blob | ArrayBufferView, timeout?: number) => Promise<T>`
* **Description**: The absolute core hook that binds front-end React with back-end Python processes. Sends serialized payloads to backend workers and returns JSON results.
* **Example**:
  ```tsx
  const getTools = async (imageBuffer: ArrayBuffer) => {
    const tools = await appInfo.pyInvoke("tools");
    console.log("tool results:", tools);
  };
  ```

#### `useTool()`
* **Signature**: `() => (tool: string, parameters: Record<string, any>) => Promise<any>`
* **Description**: Connects to the system tools executor, allowing programs to run system tools (like terminal scripts, search tools, or directory manipulation scripts) programmatically.
* **Example**:
  ```tsx
  const executeTool = appInfo.useTool();
  const searchResults = await executeTool("web_search", { query: "OpenChad releases" });
  ```

---

### 📂 Reactive Filesystem Hooks

#### `useFile()`
* **Signature**: `(filename: string, options?: FileOptions) => UseFileReturn`
* **Description**: Binds reactively to a file in the tab Storage folder (or absolute path). Standard text files return raw contents; image/audio/video files automatically transcode and return direct streaming endpoint URLs.
* **Example**:
  ```tsx
  const [notes, setNotes] = appInfo.useFile("scratchpad.txt", { initialValue: "Write here..." });
  ```

#### `useFolder()`
* **Signature**: `(path: string, options?: FolderOptions) => UseFolderReturn`
* **Description**: Monitors and lists directories. Returns directory lists containing pre-filtered arrays of subdirectories and files relative to the folder.
* **Example**:
  ```tsx
  const [contents, exists, { files, folders }] = appInfo.useFolder("exports/");
  ```
