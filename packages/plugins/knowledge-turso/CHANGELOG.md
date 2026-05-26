# @objectstack/knowledge-turso

## 7.0.0

### Minor Changes

- 430067b: Introduce `IEmbedder` protocol and extract `@objectstack/embedder-openai` plugin.

  **What's new**

  - **`IEmbedder` contract** (`@objectstack/spec/contracts/embedder.ts`) — protocol-level interface for text → vector providers. One contract covers cloud APIs (OpenAI / 阿里通义 / 智谱 / 硅基流动 / 火山 Doubao / MiniMax), local Ollama daemons, and in-process embedders.
  - **`@objectstack/embedder-openai`** — new package. Drop-in for any OpenAI-shape endpoint via `baseUrl`. Ships preset constants for 8 mainstream providers (`createOpenAIEmbedder({ preset: 'siliconflow', ... })`) and pre-baked dimensions for 16+ popular models.

  **Breaking changes (`@objectstack/knowledge-turso`)**

  - `OpenAIEmbeddingProvider` is **removed** — install `@objectstack/embedder-openai` and use `OpenAIEmbedder` instead (identical option shape).
  - `EmbeddingProvider` type alias kept as a deprecated re-export of `IEmbedder` for smoother migration; will be removed in a future major.
  - `HashEmbeddingProvider` is now an alias for the renamed `HashEmbedder` class — no functional change.

  **Migration**

  ```diff
  - import { OpenAIEmbeddingProvider } from '@objectstack/knowledge-turso';
  + import { OpenAIEmbedder } from '@objectstack/embedder-openai';

  - const embedding = new OpenAIEmbeddingProvider({ apiKey });
  + const embedding = new OpenAIEmbedder({ apiKey });
  ```

  For 国内 providers, use presets:

  ```ts
  import { createOpenAIEmbedder } from "@objectstack/embedder-openai";
  const embedding = createOpenAIEmbedder({
    preset: "siliconflow", // or 'dashscope', 'zhipu', 'doubao', 'ollama', …
    apiKey: process.env.SILICONFLOW_API_KEY!,
    model: "BAAI/bge-m3",
  });
  ```

### Patch Changes

- Updated dependencies [430067b]
  - @objectstack/spec@7.0.0
  - @objectstack/core@7.0.0
  - @objectstack/service-knowledge@7.0.0

## 6.6.0

### Patch Changes

- Updated dependencies [a49cfc2]
  - @objectstack/spec@6.6.0
  - @objectstack/core@6.6.0
  - @objectstack/service-knowledge@6.6.0

## 6.5.1

### Patch Changes

- @objectstack/spec@6.5.1
- @objectstack/core@6.5.1
- @objectstack/service-knowledge@6.5.1

## 6.5.0

### Patch Changes

- @objectstack/spec@6.5.0
- @objectstack/core@6.5.0
- @objectstack/service-knowledge@6.5.0

## 6.4.0

### Minor Changes

- 52d1244: Add `@objectstack/knowledge-turso` — production-grade knowledge adapter backed by [Turso](https://turso.tech) / libSQL native vector columns.

  **What's included:**

  - `TursoKnowledgeAdapter` — implements `IKnowledgeAdapter` against a libSQL database with native `F32_BLOB` vector columns and ANN search via `vector_distance_cos()`. Single-table schema (`knowledge_chunks_<sourceId>`), automatic schema bootstrap on first `upsert()`, deterministic chunking + pluggable embedder.
  - `KnowledgeTursoPlugin` — registers the adapter with `IKnowledgeService` on `start()`. Accepts an existing `@libsql/client` instance or `{ url, authToken }` config.
  - Default tiny built-in embedder (hash-token bag-of-words → fixed-dim float vector) for tests / offline dev. Production deployments inject an OpenAI / Voyage / Cohere embedder via the `embed` option.

  **Why:** memory adapter is for tests, RAGFlow adapter is for teams that already run RAGFlow. Turso is the sweet spot for ObjectStack apps that want a real vector store with **zero new infrastructure** — it's the same libSQL the platform already uses for data.

  See `packages/plugins/knowledge-turso/README.md` for the full reference.

### Patch Changes

- Updated dependencies [f8651cc]
- Updated dependencies [f8651cc]
- Updated dependencies [0bf6f9a]
  - @objectstack/spec@6.4.0
  - @objectstack/service-knowledge@6.4.0
  - @objectstack/core@6.4.0
