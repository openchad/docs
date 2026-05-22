---
outline: deep
---

# Creating Custom Model Providers

A **Model Provider** is a plugin that tells OpenChad which AI models are available and how to surface them in the UI. The built-in `LiteLLMModelProvider` (at `ModelProvider/openchad/LiteLLMModelProvider/main.py`) discovers hundreds of cloud models by inspecting which API keys are set in the environment — your own provider follows the exact same pattern.

---

## What a Model Provider Does

A provider has exactly one responsibility: **scan and return a list of model descriptors**.


## Directory Layout

Providers live inside the `ModelProvider/` directory under a two-level namespace:

```
ModelProvider/
└── openchad/                         ← publisher name (use your own)
    └── LiteLLMModelProvider/         ← provider name
        ├── main.py                   ← required — must export a BaseModelProvider subclass
```

> [!IMPORTANT]
> The file **must** be named `main.py`. The `provider_id` is derived from the folder path as `{publisher}/{provider}` (e.g. `openchad/litellm`).

---

## Step 1 — Create Your Provider File

```
ModelProvider/
└── mynamespace/
    └── MyCustomProvider/
        ├── main.py
```

---

## Step 2 — Subclass `BaseModelProvider`

```python
# ModelProvider/mynamespace/MyCustomProvider/main.py

import logging
from typing import List, Dict, Any
from openchadpy.base_provider import BaseModelProvider

logger = logging.getLogger(__name__)


class MyCustomProvider(BaseModelProvider):
    """
    Discovers models from my private inference server.
    """

    # Required: unique identifier — must match the folder path
    provider_id = "mynamespace/mycustomprovider"

    # Optional: set True to re-run scan() whenever API keys are saved in Settings
    rescan_on_credentials = False

    def __init__(self):
        super().__init__()
        self.base_url = "http://localhost:8000"

    async def scan(self) -> List[Dict[str, Any]]:
        """Return a list of model descriptor dicts."""
        import aiohttp
        models = []
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(f"{self.base_url}/v1/models") as resp:
                    data = await resp.json()
            for entry in data.get("data", []):
                raw_id = entry["id"]
                models.append({
                    "id":          f"mycustom/{raw_id}",
                    "name":        self.format_model_name(raw_id),
                    "backend":     "mynamespace/mycustombackend",
                    "model_type":  ["llm"],
                    "model":       raw_id,
                    "provider":    self.provider_id,
                    "auto_load":   True,
                    "is_local":    True,
                })
        except Exception as e:
            logger.error("Failed to scan MyCustomProvider: %s", e)
        return models

    async def close(self):
        """Called when the provider is unloaded. Release any held resources."""
        pass
```

---

## `BaseModelProvider` Reference

### Class Attributes

| Attribute | Type | Default | Description |
|:---|:---|:---|:---|
| `provider_id` | `str` | `""` | **Required.** Unique string identifier. Convention: `"{publisher}/{name}"`. |
| `rescan_on_credentials` | `bool` | `False` | When `True`, OpenChad calls `scan()` again after the user saves API credentials in Settings. |

### Instance Attributes (framework-injected)

| Attribute | Type | Description |
|:---|:---|:---|
| `self.settings_manager` | `Settings \| None` | Injected after instantiation. Use it to read app settings such as stored base URLs or custom options. |

### Abstract Method: `scan()`

```python
async def scan(self) -> List[Dict[str, Any]]:
    ...
```

Called by the framework to discover models. Must return a list of **model descriptor dicts**. See [Model Descriptor Fields](#model-descriptor-fields) below.

### Optional Method: `close()`

```python
async def close(self) -> None:
    ...
```

Called when the provider is unloaded (app shutdown or hot-reload). Use it to stop background watchers, close HTTP sessions, etc. The default implementation is a no-op.

### Static Helper: `format_model_name(m_name)`

```python
BaseModelProvider.format_model_name("gpt-4o-mini")
# → "GPT 4O Mini"
```

Splits on `/`, `-`, `:`, `_`, title-cases long words, and upper-cases short abbreviations (≤ 3 letters). Handy for generating readable display names from raw model identifiers.

---

## Model Descriptor Fields

`scan()` must return a list of dicts. Required fields are marked **bold**.

| Field | Type | Description |
|:---|:---|:---|
| **`id`** | `str` | Globally unique model identifier. Used as the primary key in `config.json`. Convention: `"{backend_prefix}/{raw_model_id}"`. |
| **`name`** | `str` | Human-readable display name shown in the UI. |
| **`backend`** | `str` | Which backend handles inference for this model (e.g. `"openchad/litellm"`, `"openchad/llamacpp"`). |
| **`model_type`** | `str \| List[str]` | One or more capability tags: `"llm"`, `"embedding"`, `"transcription"`, `"image generation"`, `"speech"`, `"video generation"`. |
| **`model`** | `str` | The raw model string forwarded to the backend (e.g. `"gpt-4o"`, `"mistral/mistral-7b"`). |
| **`provider`** | `str` | `self.provider_id` — used for attribution and re-scan targeting. |
| `auto_load` | `bool` | When `True`, the model is automatically added to `config.json` on first discovery (no manual user action needed). Defaults to `False`. |
| `is_local` | `bool` | Hint to the UI: `True` for on-device models, `False` for cloud APIs. |

### Minimal example

```python
{
    "id":          "mybackend/llama-3-8b",
    "name":        "Llama 3 8B",
    "backend":     "mynamespace/mybackend",
    "model_type":  ["llm"],
    "model":       "llama-3-8b",
    "provider":    "mynamespace/myprovider",
    "auto_load":   True,
    "is_local":    True,
}
```

## Using `settings_manager`

After your provider is instantiated, OpenChad injects `self.settings_manager`. Use it to read user-configured values (like a custom base URL or token):

```python
async def scan(self) -> List[Dict[str, Any]]:
    base_url = "http://localhost:8000"
    if self.settings_manager:
        stored = await self.settings_manager.get("my_provider_base_url")
        if stored:
            base_url = stored
    # ... rest of scan
```

## Complete Example: Hardcoded Model List

The simplest possible provider — useful for curating a fixed set of models without querying any external API:

```python
# ModelProvider/mynamespace/StaticProvider/main.py

from typing import List, Dict, Any
from openchadpy.base_provider import BaseModelProvider


class StaticProvider(BaseModelProvider):
    """Exposes a fixed, curated list of OpenAI models."""

    provider_id = "mynamespace/static"

    async def scan(self) -> List[Dict[str, Any]]:
        import os
        if not os.environ.get("OPENAI_API_KEY"):
            return []
        return [
            {
                "id":         "litellm/gpt-4o",
                "name":       "GPT-4o",
                "backend":    "openchad/litellm",
                "model_type": ["llm"],
                "model":      "gpt-4o",
                "provider":   self.provider_id,
                "auto_load":  True,
                "is_local":   False,
            },
            {
                "id":         "litellm/gpt-4o-mini",
                "name":       "GPT-4o Mini",
                "backend":    "openchad/litellm",
                "model_type": ["llm"],
                "model":      "gpt-4o-mini",
                "provider":   self.provider_id,
                "auto_load":  True,
                "is_local":   False,
            },
        ]
```

---

## Complete Example: Dynamic Server Scan (LiteLLM Style)

A provider that queries an Ollama-compatible server and maps each result to a model descriptor:

```python
# ModelProvider/mynamespace/OllamaProvider/main.py

import asyncio
import logging
from typing import List, Dict, Any
from openchadpy.base_provider import BaseModelProvider

logger = logging.getLogger(__name__)


class OllamaProvider(BaseModelProvider):
    """Discovers locally running Ollama models."""

    provider_id = "mynamespace/ollama"
    rescan_on_credentials = False

    def __init__(self):
        super().__init__()
        self._base_url = "http://localhost:11434"

    async def scan(self) -> List[Dict[str, Any]]:
        return await asyncio.to_thread(self._scan_sync)

    def _scan_sync(self) -> List[Dict[str, Any]]:
        import urllib.request, json
        models = []
        try:
            with urllib.request.urlopen(f"{self._base_url}/api/tags", timeout=3) as r:
                data = json.loads(r.read())
            for entry in data.get("models", []):
                raw = entry["name"]
                models.append({
                    "id":         f"ollama/{raw}",
                    "name":       self.format_model_name(raw),
                    "backend":    "openchad/litellm",   # LiteLLM supports ollama/
                    "model_type": ["llm"],
                    "model":      f"ollama/{raw}",
                    "provider":   self.provider_id,
                    "auto_load":  True,
                    "is_local":   True,
                })
            logger.info("Ollama: found %d model(s)", len(models))
        except Exception as e:
            logger.warning("Ollama server not reachable: %s", e)
        return models


# Required export
ModelProvider = OllamaProvider
```

---

## How OpenChad Loads Providers

The `ModelProviderManager` walks `ModelProvider/{publisher}/{plugin}/main.py`, imports each file, and searches for any class that:

- is a subclass of `BaseModelProvider`
- is not `BaseModelProvider` itself
- has a non-empty `provider_id`


```
ModelProvider/
└── {publisher}/                 ← any folder name
    └── {plugin}/                ← any folder name
        ├── main.py              ← contains your BaseModelProvider subclass
```

The resulting `provider_id` used internally is always `"{publisher}/{plugin}"` in lowercase.

---

## Directory Reference

```
ModelProvider/
└── openchad/                          ← built-in namespace
    └── LiteLLMModelProvider/          ← built-in provider
        └── main.py
└── mynamespace/                       ← your namespace
    └── MyCustomProvider/
        ├── main.py                    ← export a BaseModelProvider subclass
```
