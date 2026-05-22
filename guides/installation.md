---
outline: deep
---

# Installation

## Prerequisites

Both installation paths require the same two tools:

### uv
The fast Python package and project manager. Used to install Python dependencies and run the backend.

```sh
# macOS / Linux
curl -LsSf https://astral.sh/uv/install.sh | sh

# Windows (PowerShell)
powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
```

Verify:
```sh
uv --version
```

### pnpm
Fast, disk-efficient Node.js package manager. Used for the React frontend.

```sh
npm install -g pnpm
```

Verify:
```sh
pnpm --version
```

## Quick Start


```sh
npx create-openchad-react@latest
```

### 2. Start the development server

```sh
cd my-app
pnpm dev
```