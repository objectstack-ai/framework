// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Pluggable embedding provider for the Turso knowledge adapter.
 *
 * Adapters call `embed()` once with the full batch of chunk texts at
 * upsert time, and once per query at search time. Implementations are
 * responsible for batching / rate-limiting against their upstream API.
 */
export interface EmbeddingProvider {
  /** Stable id (mostly for logs). */
  readonly id: string;
  /** Output vector dimensionality — used to size the `F32_BLOB(N)` column. */
  readonly dimensions: number;
  /** Embed a batch of strings. Output order matches input order. */
  embed(texts: string[]): Promise<number[][]>;
}

export interface OpenAIEmbeddingOptions {
  apiKey: string;
  /** @default 'text-embedding-3-small' */
  model?: string;
  /** Override dimensions (only some models support this). */
  dimensions?: number;
  /** Override base URL (Azure / proxy / Ollama-compatible servers). */
  baseUrl?: string;
  /** Inject for tests. Defaults to global fetch. */
  fetch?: typeof fetch;
}

/**
 * Known dimensions for OpenAI's first-party embedding models. Used as
 * the default when the caller doesn't pass `dimensions` explicitly.
 */
const OPENAI_DEFAULT_DIMS: Record<string, number> = {
  'text-embedding-3-small': 1536,
  'text-embedding-3-large': 3072,
  'text-embedding-ada-002': 1536,
};

/**
 * OpenAI-compatible embedding provider. Works against the real OpenAI
 * API, Azure OpenAI deployments, and any drop-in compatible server
 * (LiteLLM, vLLM, Ollama with the openai shim).
 */
export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  readonly id = 'openai';
  readonly dimensions: number;
  private readonly model: string;
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly fetchImpl: typeof fetch;
  private readonly requestedDims?: number;

  constructor(opts: OpenAIEmbeddingOptions) {
    if (!opts.apiKey) throw new Error('OpenAIEmbeddingProvider: apiKey required');
    this.apiKey = opts.apiKey;
    this.model = opts.model ?? 'text-embedding-3-small';
    this.baseUrl = (opts.baseUrl ?? 'https://api.openai.com/v1').replace(/\/+$/, '');
    this.fetchImpl = opts.fetch ?? (globalThis.fetch as typeof fetch);
    this.requestedDims = opts.dimensions;
    this.dimensions =
      opts.dimensions ?? OPENAI_DEFAULT_DIMS[this.model] ?? 1536;
    if (!this.fetchImpl) {
      throw new Error('OpenAIEmbeddingProvider: no fetch available; pass options.fetch');
    }
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    const body: Record<string, unknown> = { model: this.model, input: texts };
    if (this.requestedDims) body.dimensions = this.requestedDims;
    const res = await this.fetchImpl(`${this.baseUrl}/embeddings`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(
        `OpenAI embeddings → ${res.status} ${res.statusText}${text ? `: ${text.slice(0, 200)}` : ''}`,
      );
    }
    const json = (await res.json()) as { data?: Array<{ embedding: number[] }> };
    const data = json.data ?? [];
    if (data.length !== texts.length) {
      throw new Error(
        `OpenAI embeddings: expected ${texts.length} vectors, got ${data.length}`,
      );
    }
    return data.map((d) => d.embedding);
  }
}

/**
 * Deterministic, dependency-free embedding provider for unit tests
 * and offline development. Hashes tokens into a fixed-width vector —
 * not semantically meaningful, but cosine-distance preserves token
 * overlap, which is enough to validate adapter plumbing.
 */
export class HashEmbeddingProvider implements EmbeddingProvider {
  readonly id = 'hash';
  readonly dimensions: number;

  constructor(dimensions = 64) {
    if (dimensions < 4) throw new Error('HashEmbeddingProvider: dimensions must be >= 4');
    this.dimensions = dimensions;
  }

  async embed(texts: string[]): Promise<number[][]> {
    return texts.map((t) => this.encode(t));
  }

  private encode(text: string): number[] {
    const vec = new Array<number>(this.dimensions).fill(0);
    const tokens = text
      .toLowerCase()
      .split(/[^a-z0-9一-鿿]+/i)
      .filter((s) => s.length > 1);
    for (const tok of tokens) {
      const h = fnv1a(tok);
      vec[h % this.dimensions] += 1;
    }
    // L2-normalise so cosine == dot.
    let norm = 0;
    for (const v of vec) norm += v * v;
    norm = Math.sqrt(norm);
    if (norm === 0) {
      vec[0] = 1;
      return vec;
    }
    return vec.map((v) => v / norm);
  }
}

function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h >>> 0;
}
