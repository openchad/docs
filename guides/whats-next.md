---
outline: deep
---

# Building Your First AI-Powered Application

Once you have OpenChad installed and running, you can begin extending it to build custom interactive applications. This guide will walk you through building a custom **Table Editor** app, creating a corresponding **Python-based custom tool**, and integrating the tool so an LLM can view and edit the table.

---

## 1. Running the Development Environment

Start the development server from the root of your project:

```bash
# Using npm
npm run dev

# Or using pnpm
pnpm dev
```

This will launch the Tauri desktop application and open a local development server with hot-reloading active.

<img src="/images/0.png" alt="OpenChad Default Interface" width="1920">

To modify the default application layout or logic, you will primarily work within the `src/` directory. Edits to `src/App.tsx` will reflect immediately in the running application.

---

## 2. Creating a Custom React App

Let's build a custom data table editor. This application will store its state (columns and rows) in the active tab's database and inject the current table representation as context for the LLM.

### Step A: Implement the Table Editor Component

Create a new file at `src/TableEditor.tsx` and add the following implementation:

```tsx
import type { AppInfo, MessageState } from "openchad-react"
import { useEffect, useState } from "react"

export default function TableEditor({ useTabDatabase }: AppInfo) {
  // 1. Persist the schema (columns) and table data (rows) in the tab-scoped database
  const [colsDb, setColsDb] = useTabDatabase("cols", { 
    initialValue: { currentCols: ["name", "age", "", ""] } 
  })
  const [rowsDb, setRowsDb] = useTabDatabase("rows", { 
    initialValue: { currentRows: [["Alice", "30", "", ""], ["", "", "", ""]] } 
  })
  const [copied, setCopied] = useState(false)

  // 2. Unwrap values with fallback defaults for rendering
  const cols = colsDb?.currentCols || ["name", "age", "question", "answer"]
  const rows = rowsDb?.currentRows || [["Alice", "30", "", ""], ["", "", "", ""]]

  // 3. Helper functions to update database state
  const setCols = (n: string[]) => setColsDb({ currentCols: n })
  const setRows = (n: string[][]) => setRowsDb({ currentRows: n })

  const toCSV = () => [cols, ...rows].map(r => r.join(",")).join("\n")
  const updateCol = (ci: number, v: string) => { const n = [...cols]; n[ci] = v; setCols(n) }
  const updateCell = (ri: number, ci: number, v: string) => { const n = rows.map(r => [...r]); n[ri][ci] = v; setRows(n) }
  const addRow = () => setRows([...rows, Array(cols.length).fill("")])
  const addCol = () => { setCols([...cols, `col${cols.length + 1}`]); setRows(rows.map(r => [...r, ""])) }
  const deleteRow = (ri: number) => setRows(rows.filter((_, i) => i !== ri))
  const deleteCol = (ci: number) => { setCols(cols.filter((_, i) => i !== ci)); setRows(rows.map(r => r.filter((_, i) => i !== ci))) }
  const handleCopy = () => { navigator.clipboard.writeText(toCSV()); setCopied(true); setTimeout(() => setCopied(false), 1500) }

  // 4. Update the LLM Message State with the current CSV representation
  const [_, setMessageState, { ready }] = useTabDatabase<MessageState>("message_state", {
    initialValue: {
      title: null,
      activeId: "",
      errorMsg: "",
      initialized: false,
      isStreaming: false,
      context: "",
    },
  });

  // Automatically sync table contents to the LLM system context when data changes
  useEffect(() => {
    if (ready) {
      setMessageState((prev) => ({
        ...prev,
        initialized: true,
        context: `current table:\`\`\`csv\n${toCSV()}\n\`\`\`\n---\n## Use \`table_editor\` tool \nWhen your task is done please write a readable summary about what you've done \n---\n`,
      }));
    }
  }, [colsDb, rowsDb])

  return (
    <div className="w-full h-full relative flex items-center justify-center">
      <div className="p-4 flex flex-col gap-4 border-accent/5 border rounded-lg min-h-[500px]">
        <div className="flex gap-2">
          <button onClick={addRow} className="px-3 py-1.5 text-sm border border-border rounded hover:bg-muted">+ row</button>
          <button onClick={addCol} className="px-3 py-1.5 text-sm border border-border rounded hover:bg-muted">+ col</button>
          <button onClick={handleCopy} className="ml-auto px-3 py-1.5 text-sm border border-border rounded hover:bg-muted">
            {copied ? "copied!" : "copy CSV"}
          </button>
        </div>
        <table className="border-collapse text-sm">
          <thead>
            <tr>
              <th className="border border-border bg-muted w-8" />
              {cols.map((c, ci) => (
                <th key={ci} className="border border-border bg-muted relative p-0 min-w-[80px]">
                  <input value={c} onChange={e => updateCol(ci, e.target.value)} className="w-full bg-transparent px-2 py-1 font-medium outline-none" />
                  <button onClick={() => deleteCol(ci)} className="text-muted-foreground hover:text-destructive px-1 text-xs absolute right-0">×</button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri} className="hover:bg-muted/40">
                <td className="border border-border text-center text-xs text-muted-foreground">{ri + 1}</td>
                {cols.map((_, ci) => (
                  <td key={ci} className="border border-border p-0">
                    <input value={row[ci] || ""} onChange={e => updateCell(ri, ci, e.target.value)} className="w-full bg-transparent px-2 py-1 font-mono outline-none" />
                  </td>
                ))}
                <td className="px-1">
                  <button onClick={() => deleteRow(ri)} className="text-muted-foreground hover:text-destructive">×</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

> [!NOTE]
> The `useTabDatabase` hook provides tab-scoped state synchronization. It communicates with the Python backend to read and write key-value pairs stored in the active session's SQLite database.

### Step B: Register the Component in the Container Layout

Open `src/main.tsx` (or your layout entrypoint) and replace the default configuration to register `TableEditor` as the main application component:

```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import './globals.css'
import { Container, type AppsProps } from "openchad-react"
import TableEditor from './TableEditor' // Import your new custom component

const Apps: AppsProps = {
  defaultTab: {
    layout: "horizontal",
    icon: "default",
    tabs: [
      {
        appname: "main-app",
        data: {},
        App: TableEditor, // Register the TableEditor component
      },
    ],
  },
  size: [80, 20],
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Container Apps={Apps} />
  </React.StrictMode>,
)
```

The application UI will now update to display the Table Editor:

<img src="/images/1.png" alt="Custom Table Editor Component" width="1920">

---

## 3. Creating a Custom Python Tool

To enable the LLM to inspect and modify the table programmatically, you need to expose a tool. In OpenChad, tools are defined in Python and loaded dynamically.

### Step A: Define the Tool Directory and File

Create the tool script in the custom tools directory:
`Tools/{publisher}/{tool_name}/main.py`

For this example, create `Tools/openchad/table_editor/main.py`:

```python
import csv
import io
import json
from typing import Any, Dict, List, Tuple, Optional
from openchadpy.tool_base import ToolBase

DEFAULT_COLS = ["name", "age"]
DEFAULT_ROWS = [["Alice", "30"], ["", ""]]

class TableEditorTool(ToolBase):
    name = "table_editor"
    description = "Inspect the current table formatted as a CSV markdown block, or update the table content via a CSV string."
    input_schema = {
        "type": "object",
        "properties": {
            "action": {
                "type": "string",
                "enum": ["get", "set"],
                "description": "The action to perform: 'get' to retrieve the current table, or 'set' to overwrite the table."
            },
            "import_csv": {
                "type": "string",
                "description": "A CSV-formatted string to import. Required if action is 'set'.",
              }
          },
        "required": ["action"],
    }
    allowed_callers = ["direct", "code_execution", "mcp_client"]

    def _ensure_list(self, val: Any, default: List) -> List:
        """Utility to ensure a value is a list, parsing JSON string representation if required."""
        if isinstance(val, str):
            try:
                val = json.loads(val)
            except json.JSONDecodeError:
                return default
        return val if isinstance(val, list) else default

    async def _load(self) -> Tuple[List[str], List[List[str]]]:
        """Loads column and row data from the active tab's database."""
        cols_dict = await self.tab_db.get("cols")
        rows_dict = await self.tab_db.get("rows")

        raw_cols = cols_dict.get("currentCols") if isinstance(cols_dict, dict) else None
        raw_rows = rows_dict.get("currentRows") if isinstance(rows_dict, dict) else None

        cols = self._ensure_list(raw_cols, DEFAULT_COLS)
        rows = self._ensure_list(raw_rows, DEFAULT_ROWS)

        return list(cols), [list(r) for r in rows]

    async def _save(self, cols: List[str], rows: List[List[str]]) -> None:
        """Persists column and row data back to the database."""
        # Explicit serialization prevents type resolution issues in the DB driver
        await self.tab_db.set("cols", "currentCols", json.dumps(cols))
        await self.tab_db.set("rows", "currentRows", json.dumps(rows))

    async def execute(self, **kwargs: Any) -> Dict[str, Any]:
        action = kwargs.get("action")

        if action == "get":
            cols, rows = await self._load()
            f = io.StringIO()
            writer = csv.writer(f)
            writer.writerow(cols)
            writer.writerows(rows)
            return {
                "result": f"```csv\n{f.getvalue()}\n```"
            }

        if action == "set":
            import_csv_str = kwargs.get("import_csv")
            if not import_csv_str or not import_csv_str.strip():
                return {"error": "Missing or empty 'import_csv' parameter for 'set' action."}

            csv_data = list(csv.reader(io.StringIO(import_csv_str.strip())))
            if not csv_data:
                return {"error": "Provided 'import_csv' contains no valid rows."}

            cols = [c.strip() for c in csv_data[0]]
            rows = [[cell.strip() for cell in row] for row in csv_data[1:]]
            await self._save(cols, rows)

            return {
                "status": "success",
                "cols": cols,
                "rows": rows,
            }

        return {"error": f"Invalid action: {action}"}

Tool = TableEditorTool
```

> [!TIP]
> OpenChad supports hot-reloading for custom Python tools. Once you save the Python file, OpenChad automatically reloads the tool metadata in the background.

---

## 4. Testing the AI Tool Integration

With the frontend and backend tool configured, test the integration by asking the LLM to structure unstructured data.

**Example Prompt:**

```text
Import CSV from:
Employee Records - Q1 2024
John Smith, age 34, works in Engineering dept. Salary: $92,000/yr. Hired on March 5th 2021. Full-time. Email: j.smith@company.com
Maria Garcia — 28 years old | Department: Marketing | Pay: $67,500 annually | Start Date: 11/14/2022 | Part-time
EMPLOYEE: Kevin O'Brien | AGE: 45 | DEPT: Finance | SALARY: 110,000 USD | HIRE DATE: January 3, 2020 | Status: Full-time | kevin.obrien@company.com
Wu, Lin | 31 | Product | $78,000 | 2023-06-01 | Full-time | l.wu@company.com
Aisha Patel; 39; HR; 85,000; Sep 9 2019; Part-time; a.patel@company.com

---
When you are done, please return a summary of the operation.
```

The LLM will parse the unstructured records, convert them into a CSV payload, call the `table_editor` tool with `action="set"`, and update the UI:

<img src="/images/2.png" alt="Structured Data Populated in UI" width="1920">

---

## 5. Connecting External MCP Clients

OpenChad exposes its tools via the **Model Context Protocol (MCP)** using Server-Sent Events (SSE). This allows external agents (such as Claude Desktop or Cursor) to call your custom tools directly.

### Claude Desktop Integration

To connect Claude Desktop to your local OpenChad session, add the remote MCP server connection to your Claude Desktop configuration file:

* **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
* **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

Add the following to the `mcpServers` block:

```json
{
  "mcpServers": {
    "openchad-mcp": {
      "command": "npx",
      "args": ["mcp-remote", "http://localhost:2048/mcp/sse"]
    }
  }
}
```

Once configured, restart Claude Desktop. You can prompt Claude directly to interact with your application state:

<img src="/images/3.png" alt="Claude Desktop Using OpenChad Tools" width="1920">

---

Congratulations! You have successfully built a custom AI-driven application and exposed it over MCP.
