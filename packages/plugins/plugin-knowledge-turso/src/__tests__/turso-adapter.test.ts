// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect, beforeEach } from 'vitest';
import { createClient, type Client } from '@libsql/client';
import type { KnowledgeDocument, KnowledgeSource } from '@objectstack/spec/ai';
import { TursoKnowledgeAdapter } from '../turso-adapter';
import { HashEmbeddingProvider } from '../embedding';

const source: KnowledgeSource = {
  id: 'src1',
  label: 'Test source',
  adapter: 'turso',
  source: { kind: 'http', urls: ['https://example.com'] } as KnowledgeSource['source'],
};

const otherSource: KnowledgeSource = {
  id: 'src2',
  label: 'Other source',
  adapter: 'turso',
  source: { kind: 'http', urls: ['https://example.com'] } as KnowledgeSource['source'],
};

const docs: KnowledgeDocument[] = [
  {
    id: 'd1',
    sourceId: 'src1',
    sourceRecordId: 'rec_d1',
    content: 'The quick brown fox jumps over the lazy dog. Foxes are clever animals.',
    title: 'Fox facts',
    metadata: { topic: 'animals' },
  },
  {
    id: 'd2',
    sourceId: 'src1',
    sourceRecordId: 'rec_d2',
    content: 'Refunds require a receipt and must be processed within 30 days of purchase.',
    title: 'Refund policy',
    metadata: { topic: 'policy' },
  },
  {
    id: 'd3',
    sourceId: 'src1',
    sourceRecordId: 'rec_d3',
    content: 'Customer support is available 24/7 by email at help@example.com.',
    title: 'Support',
    metadata: { topic: 'policy' },
  },
];

function newAdapter(client: Client): TursoKnowledgeAdapter {
  return new TursoKnowledgeAdapter({
    client,
    embedder: new HashEmbeddingProvider(64),
  });
}

describe('TursoKnowledgeAdapter (in-memory libsql)', () => {
  let client: Client;
  let adapter: TursoKnowledgeAdapter;

  beforeEach(() => {
    client = createClient({ url: ':memory:' });
    adapter = newAdapter(client);
  });

  it('upsert + search returns the closest doc on top', async () => {
    await adapter.upsert(docs, { source });
    const hits = await adapter.search('refund receipt purchase', { source, topK: 3 });
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].documentId).toBe('d2');
    expect(hits[0].sourceRecordId).toBe('rec_d2');
    expect(hits[0].sourceId).toBe('src1');
  });

  it('respects topK', async () => {
    await adapter.upsert(docs, { source });
    const hits = await adapter.search('refund support fox', { source, topK: 1 });
    expect(hits.length).toBe(1);
  });

  it('filters by metadata', async () => {
    await adapter.upsert(docs, { source });
    const hits = await adapter.search('fox refund support', {
      source,
      topK: 5,
      filter: { topic: 'policy' },
    });
    expect(hits.find((h) => h.documentId === 'd1')).toBeUndefined();
    for (const h of hits) expect(h.metadata?.topic).toBe('policy');
  });

  it('delete removes a document', async () => {
    await adapter.upsert(docs, { source });
    await adapter.delete(['d2'], { source });
    const hits = await adapter.search('refund receipt', { source, topK: 5 });
    expect(hits.find((h) => h.documentId === 'd2')).toBeUndefined();
  });

  it('re-upsert replaces existing chunks for the same doc', async () => {
    await adapter.upsert(docs, { source });
    await adapter.upsert(
      [{ id: 'd2', sourceId: 'src1', content: 'Pineapples are tropical fruit.', title: 'New' }],
      { source },
    );
    const tropical = await adapter.search('pineapple tropical fruit', { source, topK: 5 });
    expect(tropical[0]?.documentId).toBe('d2');
    expect(tropical[0]?.snippet).toContain('Pineapples');
    // Old refund chunk must be gone — only one chunk should exist for d2 now.
    const rs = await client.execute('SELECT COUNT(*) AS n FROM knowledge_src1 WHERE document_id = ?', [
      'd2',
    ]);
    expect(Number((rs.rows[0] as unknown as { n: number }).n)).toBe(1);
  });

  it('chunks long documents into multiple rows', async () => {
    const long = 'lorem ipsum dolor sit amet '.repeat(200);
    await adapter.upsert([{ id: 'long', sourceId: 'src1', content: long }], { source });
    const rs = await client.execute('SELECT COUNT(*) AS n FROM knowledge_src1 WHERE document_id = ?', [
      'long',
    ]);
    const n = Number((rs.rows[0] as unknown as { n: number }).n);
    expect(n).toBeGreaterThan(1);
  });

  it('isolates rows per source (separate tables)', async () => {
    await adapter.upsert(docs, { source });
    await adapter.upsert(
      [{ id: 'x1', sourceId: 'src2', content: 'Pineapples are tropical fruit.' }],
      { source: otherSource },
    );

    const hitsA = await adapter.search('tropical pineapple', { source, topK: 5 });
    expect(hitsA.find((h) => h.documentId === 'x1')).toBeUndefined();

    const hitsB = await adapter.search('tropical pineapple', { source: otherSource, topK: 5 });
    expect(hitsB[0]?.documentId).toBe('x1');
    expect(hitsB[0]?.sourceId).toBe('src2');
  });

  it('healthCheck returns ok', async () => {
    const h = await adapter.healthCheck();
    expect(h.ok).toBe(true);
  });

  it('search on empty source returns []', async () => {
    const hits = await adapter.search('anything', { source, topK: 5 });
    expect(hits).toEqual([]);
  });

  it('search with empty query returns []', async () => {
    await adapter.upsert(docs, { source });
    const hits = await adapter.search('   ', { source, topK: 5 });
    expect(hits).toEqual([]);
  });
});

const liveUrl = process.env.TURSO_URL;
const liveToken = process.env.TURSO_AUTH_TOKEN;

describe.skipIf(!liveUrl)('TursoKnowledgeAdapter (live Turso)', () => {
  it('round-trips upsert→search→delete against the cloud DB', async () => {
    const client = createClient({ url: liveUrl!, authToken: liveToken });
    const adapter = newAdapter(client);
    const live: KnowledgeSource = {
      id: `live_test_${Date.now()}`,
      label: 'Live smoke',
      adapter: 'turso',
      source: { kind: 'http', urls: ['https://example.com'] } as KnowledgeSource['source'],
    };
    try {
      await adapter.upsert(docs, { source: live });
      const hits = await adapter.search('refund receipt purchase', { source: live, topK: 3 });
      expect(hits[0]?.documentId).toBe('d2');
      await adapter.delete(['d2'], { source: live });
      const after = await adapter.search('refund receipt', { source: live, topK: 5 });
      expect(after.find((h) => h.documentId === 'd2')).toBeUndefined();
    } finally {
      try {
        await client.execute(`DROP TABLE IF EXISTS knowledge_${live.id}`);
      } catch {
        /* noop */
      }
      client.close();
    }
  }, 30_000);
});
