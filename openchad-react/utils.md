---
outline: deep
---

# Utilities & Options Reference

The `openchad-react/utils` module exports core interfaces, API contexts, and utilities that manage files, folders, and reactive databases. This page provides a comprehensive reference of all option structures and return types inside the **`AppInfo`** context and **`useDatabase`** hooks.

---

## Database API Reference (`useDatabase` & `useTabDatabase`)

Both the global `useDatabase` hook and the tab-scoped `AppInfo.useTabDatabase` hook provide a reactive, SQLite-backed state management system with a `useState`-like experience.

### Return Type (`UseDatabaseReturn<T>`)
The database hook returns a read-only tuple containing the current state, a React-style state dispatcher, and query utility methods:

```typescript
type UseDatabaseReturn<T> = readonly [
  data: T,
  setData: DatabaseSetter<T>,
  utils: DatabaseUtils
];
```

#### `DatabaseSetter<T>`
An identical type to React's state setter dispatcher. It supports directly setting the state or passing a callback function:
```typescript
type DatabaseSetter<T> = React.Dispatch<React.SetStateAction<T>>;

// Example:
setCount(10);
setCount((prev) => prev + 1);
```

#### `DatabaseUtils`
```typescript
interface DatabaseUtils {
  /** Asynchronously executes a raw SQL statement against the SQLite table */
  query: (sql: string) => Promise<unknown>;
  /** Indicates if the Python SQLite stream and subscription are fully active */
  ready: boolean;
}
```

### Database Options
```typescript
useDatabase<T>(tb: string, options?: { initialValue?: T })
useTabDatabase<T>(tb: string, options?: { initialValue?: T })
```
* **`tb`** (`string`): The name of the SQLite table. (For tab-scoped database, it will automatically prepend the `tabId` to create a secure, isolated namespace).
* **`options.initialValue`** (`T`): The default state to use if the database table has not been initialized or is empty. *Note: Specifying an initial value is highly recommended for primitives to enable proper React type inference.*

### Internal Storage & Behaviors
1. **Primitive Auto-Wrapping**: To store simple types (strings, numbers, booleans) in standard SQL tables, the hook automatically wraps primitives in an object `{ __value__: T }` and writes it to a special row inside the SQLite database using columns `id` (as `"__value__"`) and `_v` (containing the serialized JSON primitive). It is transparently unwrapped for you.
2. **Deep JSON Parsing**: The engine automatically deserializes stored string representations of arrays and objects recursively on load, so that nested React states can be queried reactively as standard Javascript structures.
3. **Type Reconciliation**: If an `initialValue` is provided, the database state automatically reconciles data types fetched from disk against your schema (e.g. converting numeric SQL representations `0` or `1` back into React booleans `false` or `true`).
4. **SQL Command Reactive Refreshing**: When invoking the custom `query()` utility, the hook inspects the command prefix. If it detects a mutating command (`INSERT`, `UPDATE`, `DELETE`, `REPLACE`, `CREATE`, `DROP`), it automatically triggers a table-wide refresh so your React state updates in real-time.

---

## File System API Reference (`useFile` & `useFolder`)

The filesystem hooks provide deep bindings to the local disk, featuring active file-watching (via `watchfiles` on the backend) and media transcoding/optimizations.

### `useFile` Reference
Binds to a file. It returns a state representing the text content or media URL, a dispatcher to modify the file, an existence indicator, and custom utilities.

```typescript
type UseFileReturn = readonly [
  content: string,
  setContent: FileSetter,
  exists: boolean,
  utils: FileUtils
];
```

#### File Utilities (`FileUtils`)
```typescript
interface FileUtils {
  /** Force refetches the file content from the local disk */
  refresh: () => Promise<void>;
  /** Asynchronously fetches the file's last modified time stamp (unix epoch) */
  getMtime: () => Promise<number>;
}
```

#### File Options (`FileOptions`)
Passed to customize the file loading, default values, and asset transformations:

```typescript
interface FileOptions {
  /** Default fallback content to write to disk if the file does not exist */
  initialValue?: string;
  /** Directory path relative to workspace Storage (or absolute path) */
  baseDir?: string;
  
  /* --- Image Rendering & Resizing (Optional) --- */
  /** Target width in pixels; returns optimized thumbnail/image URL */
  width?: number;
  /** Target height in pixels */
  height?: number;
  /** Compression quality percentage (1 to 100) */
  quality?: number;
  
  /* --- Audio Settings (Optional) --- */
  /** Custom compression bitrate (e.g., '128k', '320k') */
  bitrate?: string;
  
  /* --- Video Settings (Optional) --- */
  /** Custom resolution (e.g. '1920x1080', '1280x720') */
  resolution?: string;
  /** Frame rate limit (e.g., 30, 60) */
  fps?: number;
  /** Set to true to extract a static thumbnail image from the video */
  thumbnail?: boolean;
  /** Time frame from which to capture the thumbnail (e.g., '00:00:01') */
  thumb_time?: string;
  
  /* --- Generic Options (Optional) --- */
  /** Target conversion format (e.g., 'webp', 'mp3', 'mp4') */
  format?: string;
  /** Force inclusion of download headers */
  download?: boolean;
}
```

#### Media URL Resolution
When `useFile` detects that a file's mime-type is **not** `text/plain` (e.g. it is an image, audio track, or video clip), the returned `content` string is automatically resolved to a **local streaming API endpoint URL**:
`/file/<encoded_filepath>?t=<timestamp>&width=...&height=...`

This allows you to pass the state variable directly to standard HTML layout tags:
```tsx
const [imageUrl] = appInfo.useFile("avatar.png", { width: 100, height: 100 });

return <img src={imageUrl} alt="User Avatar" />
```

---

### `useFolder` Reference
Watches folder directories reactively and lists their structures.

```typescript
type UseFolderReturn = readonly [
  contents: string[],
  exists: boolean,
  utils: FolderUtils
];
```

#### Folder Utilities (`FolderUtils`)
An object that makes working with directory entries easy:

```typescript
interface FolderUtils {
  /** Creates the specified folder. Pass "/" to create the watched root itself. */
  create: (folder: string) => Promise<void>;
  /** Checks if a specific subfolder path exists */
  isExists: (folder: string) => Promise<boolean>;
  /** Array of paths containing only subdirectories (items ending in '/') */
  folders: string[];
  /** Array of paths containing only files (items NOT ending in '/') */
  files: string[];
  /** Resolved absolute system path representation */
  path: string;
}
```

#### Folder Options (`FolderOptions`)
```typescript
interface FolderOptions {
  /** The base directory path to look up. Defaults to tab Storage folder. */
  baseDir?: string;
}
```

---

## Context Interface (`AppInfo`)

For the full, detailed API reference of every method, hook, and property exposed in the React application context, please check our new dedicated page:

**[AppInfo Context Interface Reference](./appinfo.md)**
