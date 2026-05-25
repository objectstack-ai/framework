# @objectstack/knowledge-turso

[Turso / libSQL](https://turso.tech) `IKnowledgeAdapter` for ObjectStack.

Bridges the [Knowledge Protocol](../../../content/docs/protocol/knowledge.mdx) to Turso's native vector support (`F32_BLOB` columns + `libsql_vector_idx` DiskANN). No separate vector DB, no extra infra — vectors live in the same SQLite-compatible engine that already backs your tenants.

## Why Turso?

- **Zero extra infra.** If you already run on Turso (or any libSQL — file, `:memory:`, embedded replica), RAG works without standing up Pinecone / Qdrant / Weaviate.
- **Native vectors.** `F32_BLOB(N)` + `vector_top_k(idx, vec, k)` with on-disk DiskANN — first-class, not a JSON-array hack.
- **Per-tenant isolation for free.** Each `KnowledgeSource` gets its own `knowledge_<source.id>` table + index. Drop the table → source is gone.
- **Right size for small / mid customers.** RAGFlow is a lot of operator surface; this is one plugin, one connection string.

## Setup

```ts
import { ObjectKernel } from '@objectstack/core';
import { KnowledgeServicePlugin } from '@objectstack/service-knowledge';
import {
  KnowledgeTursoPlugin,
  OpenAIEmbeddingProvider,
} from '@objectstack/knowledge-turso';

const kernel = new ObjectKernel();

kernel.use(new KnowledgeServicePlugin({
  sources: [{
    id: 'product_docs',
    label: 'Product documentation',
    adapter: 'turso',
    source: { kind: 'http', urls: ['https://docs.example.com/sitemap.xml'] },
  }],
}));

kernel.use(new KnowledgeTursoPlugin({
  url: process.env.TURSO_URL!,            // libsql://… | file:… | :memory:
  authToken: process.env.TURSO_AUTH_TOKEN,
  embedding: new OpenAIEmbeddingProvider({
    apiKey: process.env.OPENAI_API_KEY!,
    // model: 'text-embedding-3-small',   // default — 1536 dims
  }),
}));
```

If you already own a libSQL client (e.g. shared with `driver-turso`), pass it directly:

```ts
new KnowledgeTursoPlugin({ client: existingLibsqlClient, embedding })
```

## Schema

Bootstrapped lazily on first call per source — no migration step needed:

```sql
CREATE TABLE knowledge_<source.id> (
  chunk_id          TEXT PRIMARY KEY,
  document_id       TEXT NOT NULL,
  source_record_id  TEXT,
  content           TEXT NOT NULL,
  title             TEXT,
  metadata          TEXT,                       -- JSON
  embedding         F32_BLOB(<dimensions>) NOT NULL
);
CREATE INDEX knowledge_<source.id>_doc_idx ON knowledge_<source.id>(document_id);
CREATE INDEX knowledge_<source.id>_vec_idx ON knowledge_<source.id>(libsql_vector_idx(embedding));
```

Search uses `vector_top_k(idx, vec, topK * overFetch)` and joins back on `rowid`; metadata filters are applied JS-side over the over-fetched candidate set.

## What the adapter does

| Call            | Turso operation |
|-----------------|-----------------|
| `upsert(docs)`  | Chunk → batch embed → `DELETE document_id IN (…)` then `INSERT … vector32('[…]')` per chunk in a single `client.batch('write')`. |
| `search(query)` | `vector_top_k('<table>_vec_idx', <query-vec>, topK*4)` JOIN base table, ORDER BY `vector_distance_cos`. |
| `delete(ids)`   | `DELETE FROM <table> WHERE document_id IN (…)`. |
| `healthCheck()` | `SELECT 1`. |

Permission filtering happens in `KnowledgeService` *after* `search()` returns — it re-checks each hit's `sourceRecordId` via ObjectQL / RLS. The adapter doesn't see actors.

## Embedding providers

| Provider | When to use |
|----------|-------------|
| `OpenAIEmbeddingProvider` | Production. Works with OpenAI, Azure OpenAI, and OpenAI-compatible servers (LiteLLM, vLLM, Ollama). Override `baseUrl` to point elsewhere. |
| `HashEmbeddingProvider`   | Unit tests / offline dev. Deterministic FNV-1a hashing into a fixed-width L2-normalised vector. **Not semantic** — only exercises adapter plumbing. |

Custom embedders implement:

```ts
interface EmbeddingProvider {
  readonly id: string;
  readonly dimensions: number;
  embed(texts: string[]): Promise<number[][]>;
}
```

The `F32_BLOB(N)` column is sized from `embedding.dimensions` at first use. Changing the embedding provider's dimensionality after a source is bootstrapped requires dropping the source's table.

## Testing

```bash
pnpm --filter @objectstack/knowledge-turso test
```

10 in-memory libsql tests run by default (no creds needed). To also run the live cloud smoke test:

```bash
export TURSO_URL='libsql://<your-db>.turso.io'
export TURSO_AUTH_TOKEN='…'
pnpm --filter @objectstack/knowledge-turso test
```

The live test creates a throw-away source table (`knowledge_live_test_<timestamp>`) and `DROP TABLE`s it in `finally`.
