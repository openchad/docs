---
outline: deep
---

# Creating Custom Backends

A **Backend** is the lowest layer of OpenChad's AI stack. It is the driver that actually talks to a model — loading weights from disk, calling a cloud API, or interfacing with a local inference server. Everything above it (pipelines, tools, chat history) is backend-agnostic.

OpenChad ships with two built-in backends:
- **`litellm`** — a unified proxy for cloud providers (OpenAI, Anthropic, Groq, Azure, OpenRouter…)
- **`llamacpp`** — local GGUF model inference via `llama-cpp-python`

You can add your own by dropping a folder into `Backend/` and implementing the `BaseBackend` contract.

## Architecture Overview

```
Backend/
└── {{publisher}}/
    └── my_backend/
        └── main.py          ← Backend = MyBackend  ← you write this

openchadpy ModelManager
    └── BackendRegistry.discover()   ← scans Backend/ at startup
    └── ModelManager.load(backend="my_backend", ...)
            └── BackendRegistry.get_backend_class("my_backend")
                    └── instantiates MyBackend(**kwargs)
                    └── calls model_manager.chat / embed / speech…
```

The `ModelManager` never calls your backend directly — it calls its own typed convenience methods (`text_chat`, `embed`, `speech`, etc.). Those methods look up the loaded model and call `model.chat(...)`, `model.embed(...)`, and so on. Your backend just needs to implement the methods that match the capabilities you declare.

---

## Step 1 — Create Your Backend File

```
Backend/
└── {{publisher}}/
    └── my_backend/
        └── main.py     ← must export  Backend = YourClass
```

> [!IMPORTANT]
> The file **must** be named `main.py` and **must** export `Backend = YourClass` at the bottom. This is what `BackendRegistry` uses to discover and load your class.

---

## Step 2 — Subclass `BaseBackend`

```python
from openchadpy.base_backend import BaseBackend, BackendMetadata

class MyBackend(BaseBackend):
    # ── Required class attributes ──────────────────────────────────────────
    backend = "my_backend"    # must match the folder name exactly
    use_lock = False          # set True if your model is NOT thread-safe

    def __init__(self, **kwargs):
        self.model_path = kwargs.get("model_path")
        self.api_key    = kwargs.get("api_key")
        # ... load your model here

    def get_metadata(self) -> BackendMetadata:
        return BackendMetadata(
            name="My Custom Backend",
            description="Wraps my favourite inference library.",
            version="1.0.0",
            capabilities=["LLM"],      # see Capability Strings below
        )

    # ── Capability methods — implement what you declared ───────────────────
    def chat(self, messages, stream=False, **kwargs):
        ...


# Required export
Backend = MyBackend
```

---

## `BaseBackend` Reference

### Required Class Attributes

| Attribute | Type | Description |
|:---|:---|:---|
| `backend` | `str` | Unique identifier. **Must match the subfolder name** under `Backend/`. |
| `use_lock` | `bool` | Set `True` if the underlying library is not thread-safe (e.g. llama.cpp). The `ModelManager` will serialize all calls behind an `asyncio.Lock`. |

### `BackendMetadata` Fields

| Field | Type | Required | Description |
|:---|:---|:---|:---|
| `name` | `str` | ✅ | Human-readable display name. |
| `version` | `str` | ✅ | Semantic version string. |
| `description` | `str` | ✅ | Short description of what the backend does. |
| `capabilities` | `List[str]` | ✅ | Declares which `ModelManager` methods this backend can serve. See table below. |
| `author` | `str` | — | Optional author attribution. |
| `requirements` | `List[str]` | — | Optional pip packages this backend needs (informational only). |

---

## Capability Strings

The `capabilities` list in `BackendMetadata` tells `ModelManager` which types of model operations your backend can serve. Each string corresponds to a `model_type` that can be set when loading a model.

| Capability String | Matching `model_type` | Methods the Backend Must Implement |
|:---|:---|:---|
| `"LLM"` | `"llm"` | `chat(messages, stream, **kwargs)` |
| `"Vision"` | `"vision"` | `chat(messages, stream, **kwargs)` (with image content) |
| `"Embedding"` | `"embedding"` | `embed(texts, **kwargs)` |
| `"Reranker"` | `"reranker"` | `rerank(query, documents, **kwargs)` |
| `"STT"` | `"stt"` | `transcription(audio, **kwargs)` |
| `"TTS"` | `"tts"` | `speech(text, stream, **kwargs)` |
| `"ImageGenerator"` | `"image_generator"` | `generate_image(prompt, **kwargs)` |
| `"VideoGenerator"` | `"video_generator"` | `generate_video(prompt, **kwargs)` |

> [!TIP]
> A single backend class can declare multiple capabilities. For example, a multimodal model might declare `["LLM", "Vision", "Embedding"]` and implement all three method families.

---

## Implementing `chat()`

The `chat` method is the most common capability. It must support both streaming and non-streaming modes:

```python
from typing import List, Dict, Union, Generator

def chat(
    self,
    messages: List[Dict[str, str]],
    stream: bool = False,
    max_tokens: int = 4096,
    temperature: float = 0.8,
    top_p: float = 0.95,
    **kwargs
) -> Union[Dict, Generator]:
    """
    Returns:
      - stream=False → a plain dict in OpenAI response format
      - stream=True  → a Generator yielding plain dicts (OpenAI chunk format)
    """
    if stream:
        return self._stream(messages, max_tokens, temperature, top_p, **kwargs)
    return self._complete(messages, max_tokens, temperature, top_p, **kwargs)
```

### Response Format

Both streaming and non-streaming responses must use the **OpenAI response schema**. `ModelManager` passes these dicts directly to pipelines and the frontend — returning anything else will break the chat UI.

**Non-streaming** — return a complete response dict:
```python
{
  "id": "chatcmpl-abc123",
  "choices": [{
    "message": {
      "role": "assistant",
      "content": "Hello! How can I help you?"
    },
    "finish_reason": "stop"
  }],
  "usage": {
    "prompt_tokens": 10,
    "completion_tokens": 20,
    "total_tokens": 30
  }
}
```

**Streaming** — yield chunk dicts one at a time:
```python
# Each yielded chunk:
{
  "choices": [{
    "delta": {
      "role": "assistant",     # only in the first chunk
      "content": "Hello"       # the token text
    },
    "finish_reason": None      # "stop" on the final chunk
  }]
}
```

> [!NOTE]
> `ModelManager` calls `chat()` inside `asyncio.to_thread()` for synchronous backends, so you don't need to make your `chat()` async. For async backends (e.g. aiohttp-based), you can make it a coroutine — `ModelManager` will detect this and `await` it directly.

## Threading & Locking

Set `use_lock = True` on your class if the underlying library cannot handle concurrent calls (common with C-extension local models like llama.cpp):

```python
class MyLocalBackend(BaseBackend):
    backend  = "my_local"
    use_lock = True          # ← ModelManager will wrap every call in an asyncio.Lock
```

When `use_lock = True`, `ModelManager` automatically acquires a per-model `asyncio.Lock` around every call. Your `chat()` will never be entered concurrently by two coroutines for the same loaded model instance.

For stateless cloud API wrappers, keep `use_lock = False` (the default) to allow full concurrency.

---

## Directory Reference

```
Backend/
└── {{publisher}}/              ← namespace (use your app name)
    └── my_backend/
        └── main.py        ← must export  Backend = YourClass
```

The backend loader resolves names as the **folder name** directly under the namespace folder. The built-in backends are at `openchad/litellm` and `openchad/llamacpp`.
