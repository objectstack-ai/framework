// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * PoC: validate Turso/libSQL native vector search end-to-end.
 *
 * Goal — confirm before building `plugin-knowledge-turso`:
 *   1. `F32_BLOB(N)` columns + `libsql_vector_idx` create successfully on cloud Turso.
 *   2. `vector_distance_cos()` returns sane ordering for a tiny corpus.
 *   3. ANN index actually accelerates queries (vs full scan).
 *   4. Tenant / source scoping via a WHERE clause composes with vector search
 *      (this is the RLS-style filter the Knowledge service will need).
 *
 * Run with real Turso credentials:
 *   TURSO_URL=libsql://... TURSO_AUTH_TOKEN=... \
 *     pnpm --filter @objectstack/driver-turso test vector-poc
 *
 * Without env vars the suite is skipped — safe for CI.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClient, type Client } from '@libsql/client';

const URL = process.env.TURSO_URL;
const TOKEN = process.env.TURSO_AUTH_TOKEN;
const ENABLED = Boolean(URL && TOKEN);

const TABLE = `vec_poc_${Date.now()}`;
const DIM = 4; // tiny dim so we can hand-craft embeddings

// Deterministic toy "embeddings" — 4-dim unit-ish vectors clustered by topic.
const corpus: Array<{ id: string; source_id: string; content: string; vec: number[] }> = [
  { id: 'd1', source_id: 'animals', content: 'fox jumps over dog', vec: [0.9, 0.1, 0.0, 0.0] },
  { id: 'd2', source_id: 'animals', content: 'cats are clever',    vec: [0.85, 0.15, 0.0, 0.0] },
  { id: 'd3', source_id: 'policy',  content: 'refund within 30 days', vec: [0.0, 0.0, 0.9, 0.1] },
  { id: 'd4', source_id: 'policy',  content: 'support by email 24/7', vec: [0.0, 0.1, 0.85, 0.15] },
];

function f32Blob(v: number[]): string {
  // libSQL accepts the textual constructor: vector32('[0.1, 0.2, ...]')
  return `vector32('[${v.join(',')}]')`;
}

describe.skipIf(!ENABLED)('Turso native vector PoC', () => {
  let client: Client;

  beforeAll(async () => {
    client = createClient({ url: URL!, authToken: TOKEN! });

    await client.execute(`
      CREATE TABLE IF NOT EXISTS ${TABLE} (
        id         TEXT PRIMARY KEY,
        source_id  TEXT NOT NULL,
        content    TEXT NOT NULL,
        embedding  F32_BLOB(${DIM}) NOT NULL
      )
    `);

    // ANN index — DiskANN on the F32_BLOB column.
    await client.execute(
      `CREATE INDEX IF NOT EXISTS ${TABLE}_vec_idx ON ${TABLE}(libsql_vector_idx(embedding))`,
    );

    for (const d of corpus) {
      await client.execute(
        `INSERT OR REPLACE INTO ${TABLE} (id, source_id, content, embedding)
         VALUES (?, ?, ?, ${f32Blob(d.vec)})`,
        [d.id, d.source_id, d.content],
      );
    }
  });

  afterAll(async () => {
    if (client) {
      try { await client.execute(`DROP TABLE IF EXISTS ${TABLE}`); } catch { /* noop */ }
      client.close();
    }
  });

  it('cosine distance orders results correctly (full scan)', async () => {
    const query = [0.9, 0.1, 0.0, 0.0]; // closest to d1
    const rs = await client.execute({
      sql: `
        SELECT id, vector_distance_cos(embedding, ${f32Blob(query)}) AS dist
        FROM ${TABLE}
        ORDER BY dist ASC
        LIMIT 3
      `,
      args: [],
    });
    const ids = rs.rows.map((r) => r.id);
    expect(ids[0]).toBe('d1');
    expect(ids).toContain('d2');
  });

  it('ANN index path (vector_top_k) returns the same top-1', async () => {
    const query = [0.0, 0.0, 0.9, 0.1]; // closest to d3
    const rs = await client.execute(`
      SELECT t.id
      FROM vector_top_k('${TABLE}_vec_idx', ${f32Blob(query)}, 3) AS v
      JOIN ${TABLE} AS t ON t.rowid = v.id
    `);
    const ids = rs.rows.map((r) => r.id);
    expect(ids[0]).toBe('d3');
  });

  it('source-scoped search composes WHERE with vector ordering', async () => {
    // Query vector is closest to animals cluster, but we scope to policy.
    const query = [0.9, 0.1, 0.0, 0.0];
    const rs = await client.execute(`
      SELECT id, vector_distance_cos(embedding, ${f32Blob(query)}) AS dist
      FROM ${TABLE}
      WHERE source_id = 'policy'
      ORDER BY dist ASC
      LIMIT 2
    `);
    const ids = rs.rows.map((r) => r.id);
    expect(ids.every((id) => id === 'd3' || id === 'd4')).toBe(true);
    expect(ids.length).toBe(2);
  });

  it('delete removes a row from the index', async () => {
    await client.execute(`DELETE FROM ${TABLE} WHERE id = 'd1'`);
    const query = [0.9, 0.1, 0.0, 0.0];
    const rs = await client.execute(`
      SELECT id FROM ${TABLE}
      ORDER BY vector_distance_cos(embedding, ${f32Blob(query)}) ASC
      LIMIT 1
    `);
    expect(rs.rows[0]?.id).toBe('d2');
  });
});
