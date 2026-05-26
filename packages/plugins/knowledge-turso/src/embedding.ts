// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Embedding helpers for the Turso knowledge adapter.
 *
 * The interface itself now lives in `@objectstack/spec/contracts` as
 * `IEmbedder` — see that file for the protocol-level contract.
 *
 * This module ships ONLY the deterministic `HashEmbedder` used for
 * tests and offline dev. For real models, install a dedicated
 * embedder plugin:
 *
 *   - `@objectstack/embedder-openai`      (OpenAI / 阿里通义 / 智谱 /
 *                                          硅基流动 / 火山 Doubao /
 *                                          MiniMax / Ollama / 任何
 *                                          OpenAI-shape 兼容端点)
 *
 * Migrating from `@objectstack/knowledge-turso` ≤ 6.6:
 *   - `EmbeddingProvider`         → `IEmbedder` (`@objectstack/spec/contracts`)
 *   - `OpenAIEmbeddingProvider`   → `OpenAIEmbedder` (`@objectstack/embedder-openai`)
 *   - `HashEmbeddingProvider`     → `HashEmbedder` (this file, unchanged behaviour)
 */

import type { IEmbedder } from '@objectstack/spec/contracts';

/**
 * @deprecated Use `IEmbedder` from `@objectstack/spec/contracts`.
 * Re-exported here as an alias to ease migration; will be removed in
 * a future major.
 */
export type EmbeddingProvider = IEmbedder;

/**
 * Deterministic, dependency-free embedder for unit tests and offline
 * development. Hashes tokens into a fixed-width vector — not
 * semantically meaningful, but cosine-distance preserves token
 * overlap, which is enough to validate adapter plumbing.
 */
export class HashEmbedder implements IEmbedder {
  readonly id = 'hash';
  readonly dimensions: number;

  constructor(dimensions = 64) {
    if (dimensions < 4) throw new Error('HashEmbedder: dimensions must be >= 4');
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

/** @deprecated Renamed to {@link HashEmbedder}. */
export const HashEmbeddingProvider = HashEmbedder;

function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h >>> 0;
}
