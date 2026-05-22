---
outline: deep
---

# Building OpenChad from Source

This guide covers how to set up the OpenChad monorepo for local development, modify the core libraries (`openchad-react` and `openchadpy`), and build standalone executable binaries for distribution. 

If you just want to build an app *on top* of OpenChad rather than modifying the framework itself, consider using the [Quick Start Setup](../guides/installation#quick-start) instead.

---

## Prerequisites

To build OpenChad from source, you need the following toolchain installed on your system:

### 1. uv (Python Package Manager)
OpenChad uses `uv` for lightning-fast Python dependency resolution and virtual environment management.

* **macOS / Linux:** `curl -LsSf https://astral.sh/uv/install.sh | sh`
* **Windows (PowerShell):** `powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"`

### 2. pnpm (Node Package Manager)
Used to manage the React frontend and Tauri build scripts.

* **Install:** `npm install -g pnpm`

### 3. Rust (Tauri Dependency)
Because OpenChad's desktop application is powered by Tauri, you need the Rust compiler and its associated build tools.

* **Install:** Follow the [official Rust installation guide](https://rustup.rs/).
* **Platform Specifics:** Make sure to install the required C++ build tools for your platform (e.g., Build Tools for Visual Studio on Windows, Xcode Command Line Tools on macOS, or `build-essential` on Linux). Refer to Tauri's [prerequisites guide](https://tauri.app/v1/guides/getting-started/prerequisites) for more details.

---

## 1. Cloning and Setup

Start by cloning the core OpenChad repository:

```bash
git clone https://github.com/openchad/openchad.git
cd openchad
```

### Install Frontend Dependencies
Run `pnpm` to install all necessary packages for the React interface and the `openchad-react` library:

```bash
pnpm install
```

### Install Python Dependencies
Use `uv` to resolve and install the python backend SDK (`openchadpy`) and dependencies into a local `.venv`:

```bash
uv sync
```

---

## 2. Development Workflow

OpenChad's development environment is designed for rapid iteration. You can start the full stack with a single command:

```bash
pnpm dev
```

This command does three things simultaneously:
1. Starts the **Vite Dev Server** for the React frontend with Hot Module Replacement (HMR).
2. Launches the **Python Backend** (`launcher.py`), which powers the models, tools, and pipelines.
3. Opens the **Tauri Desktop Window**, connecting directly to the local Vite server.

> [!TIP]
> **Manual Backend Launch:** If you need to debug the backend in isolation without the frontend UI, you can start the python process manually using `uv`:
> ```bash
> uv run launcher.py
> ```
> *(Note: Always use `uv run` when executing python scripts in the OpenChad project to ensure the correct virtual environment is used.)*

### Architecture & Hot-Reloading

Changes to the core directories take effect automatically:
* **`openchad-react/`**: React component modifications are hot-reloaded by Vite.
* **`openchadpy/`**: Python SDK changes are applied when the backend restarts.
* **`Tools/` / `Pipeline/` / `Backend/`**: Custom python plugins are hot-reloaded in real-time by the backend without requiring a restart.

---

## 3. Building Standalone Executables

When you are ready to distribute your version of OpenChad, you need to package the Python backend and the Tauri frontend into a single standalone binary (`.exe` on Windows, `.app` on macOS, or binary on Linux).

### Step A: Bundle the Python Backend

We use PyInstaller to compile the Python environment into a standalone executable. Run this using `uvx` to execute PyInstaller seamlessly within an isolated environment:

```bash
uvx pyinstaller \
  --onefile \
  --name openchad_backend \
  --distpath . \
  --icon icon.ico \
  --noconsole \
  launcher.py
```

| Flag | Description |
|:---|:---|
| `--onefile` | Bundles everything into a single portable binary. |
| `--name` | The name of the output binary. |
| `--distpath .` | Outputs the file to the current project root (important for Tauri to find it). |
| `--icon` | Embeds the application icon. |
| `--noconsole` | Prevents a terminal window from opening behind the UI on Windows/macOS. |

### Step B: Build the Tauri Frontend

Once the python backend binary is successfully generated in the root directory, you can build the Tauri application wrapper.

Tauri will bundle the Vite production build and the Python binary into the final distributable application:

```bash
pnpm tauri build
```

Once the build finishes, you will find your compiled executables inside `src-tauri/target/release/` (or the respective output bundle folders depending on your OS).

---

## What to Read Next

Now that you have the source code running locally, you can start modifying the core framework or extending it:

* [Building a Custom React App](./custom-app)
* [Creating Custom Python Tools](./custom-tools)
* [Building Custom Pipelines](./custom-pipeline)
* [Adding Custom Model Providers](./custom-model-provider)
