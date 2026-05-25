// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

import type { Client } from '@libsql/client';
import type {
  IKnowledgeAdapter,
  AdapterContext,
  AdapterSearchOptions,
} from '@objectstack/spec/contracts';
import type {
  KnowledgeDocument,
  KnowledgeHit,
  KnowledgeSource,
} from '@objectstack/spec/ai';
import type { EmbeddingProvider } from './embedding';

export interface TursoAdapterOptions {
  /** Stable adapter id used in `KnowledgeSource.adapter`. @default 'turso' */
  id?: string;
  /** libsql client (Turso cloud, embedded replica, file, or `:memory:`). */
  client: Client;
  /** Embedding provider used for both upsert and search. */
  embedder: EmbeddingProvider;
  /** Soft cap on chunk size, in characters. @default 800 */
  chunkTarget?: number;
  /**
   * Over-fetch multiplier — `vector_top_k` is called with `topK * overFetch`
   * so that JS-side metadata filtering still has candidates to return.
   * @default 4
   */
  overFetch?: number;
}

/**
 * Per-source adapter config carried on `KnowledgeSource.adapterConfig`.
 * The adapter is forgiving: every field is optional and falls back to
 * sane defaults derived from the embedder.
 */
interface TursoSourceConfig {
  /** Override the auto-derived table name. */
  tableName?: string;
  /** Embedding dimensionality. Defaults to `embedder.dimensions`. */
  dimensions?: number;
}

interface ChunkRow {
  chunk_id: string;
  document_id: string;
  source_record_id: string | null;
  content: string;
  title: string | null;
  metadata: string | null;
  dist: number;
}

const DEFAULT_CHUNK_TARGET = 800;
const DEFAULT_OVER_FETCH = 4;

/**
 * `TursoKnowledgeAdapter` — Turso/libSQL backed knowledge adapter.
 *
 * Each `KnowledgeSource` owns a dedicated table named
 * `knowledge_<source.id>` plus a DiskANN index
 * `knowledge_<source.id>_vec_idx`. Schema is bootstrapped lazily on the
 * first call into a given source so callers don't need a separate
 * migration step.
 */
export class TursoKnowledgeAdapter implements IKnowledgeAdapter {
  readonly id: string;
  private readonly client: Client;
  private readonly embedder: EmbeddingProvider;
  private readonly chunkTarget: number;
  private readonly overFetch: number;
  private readonly ready = new Map<string, Promise<{ table: string; dimensions: number }>>();

  constructor(opts: TursoAdapterOptions) {
    if (!opts.client) throw new Error('TursoKnowledgeAdapter: client required');
    if (!opts.embedder) throw new Error('TursoKnowledgeAdapter: embedder required');
    this.id = opts.id ?? 'turso';
    this.client = opts.client;
    this.embedder = opts.embedder;
    this.chunkTarget = opts.chunkTarget ?? DEFAULT_CHUNK_TARGET;
    this.overFetch = opts.overFetch ?? DEFAULT_OVER_FETCH;
  }

  async upsert(docs: KnowledgeDocument[], ctx: AdapterContext): Promise<void> {
    if (docs.length === 0) return;
    const { table } = await this.ensureSchema(ctx.source);

    // Drop any existing rows for these documents first so re-upsert is idempotent.
    const ids = docs.map((d) => d.id);
    await this.deleteByDocumentIds(table, ids);

    // Chunk every document, then embed all chunks in a single batch.
    const chunks: Array<{
      chunkId: string;
      documentId: string;
      sourceRecordId?: string;
      content: string;
      title?: string;
      metadata: Record<string, unknown>;
    }> = [];
    for (const doc of docs) {
      const pieces = chunkText(doc.content, this.chunkTarget);
      pieces.forEach((content, idx) => {
        chunks.push({
          chunkId: `${doc.id}#${idx}`,
          documentId: doc.id,
          sourceRecordId: doc.sourceRecordId,
          content,
          title: doc.title,
          metadata: doc.metadata ?? {},
        });
      });
    }
    if (chunks.length === 0) return;

    const vectors = await this.embedder.embed(chunks.map((c) => c.content));
    if (vectors.length !== chunks.length) {
      throw new Error(
        `TursoKnowledgeAdapter: embedder returned ${vectors.length} vectors for ${chunks.length} chunks`,
      );
    }

    // libsql batches a sequence of statements in a single round-trip.
    const stmts = chunks.map((c, i) => ({
      sql: `INSERT INTO ${table} (chunk_id, document_id, source_record_id, content, title, metadata, embedding)
            VALUES (?, ?, ?, ?, ?, ?, ${vectorLiteral(vectors[i])})`,
      args: [
        c.chunkId,
        c.documentId,
        c.sourceRecordId ?? null,
        c.content,
        c.title ?? null,
        JSON.stringify(c.metadata),
      ],
    }));
    await this.client.batch(stmts, 'write');
  }

  async delete(documentIds: string[], ctx: AdapterContext): Promise<void> {
    if (documentIds.length === 0) return;
    const { table } = await this.ensureSchema(ctx.source);
    await this.deleteByDocumentIds(table, documentIds);
  }

  async search(query: string, opts: AdapterSearchOptions): Promise<KnowledgeHit[]> {
    if (!query.trim()) return [];
    const { table } = await this.ensureSchema(opts.source);
    const [qVec] = await this.embedder.embed([query]);
    if (!qVec) return [];

    const candidate = Math.max(opts.topK * this.overFetch, opts.topK);
    const lit = vectorLiteral(qVec);
    const sql = `
      SELECT t.chunk_id, t.document_id, t.source_record_id, t.content, t.title, t.metadata,
             vector_distance_cos(t.embedding, ${lit}) AS dist
      FROM vector_top_k('${table}_vec_idx', ${lit}, ${candidate}) AS v
      JOIN ${table} AS t ON t.rowid = v.id
      ORDER BY dist ASC
    `;
    const rs = await this.client.execute(sql);

    const filter = opts.filter ?? {};
    const hasFilter = Object.keys(filter).length > 0;
    const hits: KnowledgeHit[] = [];
    for (const raw of rs.rows as unknown as ChunkRow[]) {
      const metadata = raw.metadata ? safeParseJson(raw.metadata) : {};
      if (hasFilter && !matchesFilter(metadata, filter)) continue;
      hits.push({
        chunkId: raw.chunk_id,
        documentId: raw.document_id,
        sourceId: opts.source.id,
        sourceRecordId: raw.source_record_id ?? undefined,
        // cosine distance ∈ [0,2] for unit vectors → similarity ∈ [-1,1]
        score: 1 - Number(raw.dist),
        snippet: raw.content,
        title: raw.title ?? undefined,
        metadata,
      });
      if (hits.length >= opts.topK) break;
    }
    return hits;
  }

  async healthCheck(): Promise<{ ok: boolean; message?: string }> {
    try {
      await this.client.execute('SELECT 1');
      return { ok: true, message: `turso adapter (${this.embedder.id}/${this.embedder.dimensions}d)` };
    } catch (err) {
      return { ok: false, message: (err as Error).message };
    }
  }

  private resolveConfig(source: KnowledgeSource): Required<Pick<TursoSourceConfig, 'tableName' | 'dimensions'>> {
    const cfg = (source.adapterConfig ?? {}) as TursoSourceConfig;
    return {
      tableName: cfg.tableName ?? defaultTableName(source.id),
      dimensions: cfg.dimensions ?? this.embedder.dimensions,
    };
  }

  private ensureSchema(source: KnowledgeSource): Promise<{ table: string; dimensions: number }> {
    const cached = this.ready.get(source.id);
    if (cached) return cached;
    const { tableName, dimensions } = this.resolveConfig(source);
    const task = (async () => {
      await this.client.execute(`
        CREATE TABLE IF NOT EXISTS ${tableName} (
          chunk_id          TEXT PRIMARY KEY,
          document_id       TEXT NOT NULL,
          source_record_id  TEXT,
          content           TEXT NOT NULL,
          title             TEXT,
          metadata          TEXT,
          embedding         F32_BLOB(${dimensions}) NOT NULL
        )
      `);
      await this.client.execute(
        `CREATE INDEX IF NOT EXISTS ${tableName}_doc_idx ON ${tableName}(document_id)`,
      );
      await this.client.execute(
        `CREATE INDEX IF NOT EXISTS ${tableName}_vec_idx ON ${tableName}(libsql_vector_idx(embedding))`,
      );
      return { table: tableName, dimensions };
    })();
    this.ready.set(source.id, task);
    task.catch(() => this.ready.delete(source.id));
    return task;
  }

  private async deleteByDocumentIds(table: string, ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const placeholders = ids.map(() => '?').join(',');
    await this.client.execute({
      sql: `DELETE FROM ${table} WHERE document_id IN (${placeholders})`,
      args: ids,
    });
  }
}

function defaultTableName(sourceId: string): string {
  // Source ids are already constrained to snake_case by the spec — safe to interpolate.
  return `knowledge_${sourceId}`;
}

function vectorLiteral(v: number[]): string {
  return `vector32('[${v.join(',')}]')`;
}

function safeParseJson(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function matchesFilter(
  metadata: Record<string, unknown>,
  filter: Record<string, unknown>,
): boolean {
  for (const [k, v] of Object.entries(filter)) {
    if (metadata[k] !== v) return false;
  }
  return true;
}

function chunkText(text: string, target: number): string[] {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  const chunks: string[] = [];
  let buf = '';
  for (const p of paragraphs.length ? paragraphs : [text]) {
    if (buf && buf.length + p.length + 2 > target) {
      chunks.push(buf);
      buf = '';
    }
    if (p.length > target) {
      if (buf) {
        chunks.push(buf);
        buf = '';
      }
      for (let i = 0; i < p.length; i += target) {
        chunks.push(p.slice(i, i + target));
      }
    } else {
      buf = buf ? `${buf}\n\n${p}` : p;
    }
  }
  if (buf) chunks.push(buf);
  return chunks;
}
