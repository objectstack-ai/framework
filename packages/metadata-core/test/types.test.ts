// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect } from 'vitest';
import {
  MetaRefSchema,
  MetadataItemSchema,
  MetadataEventSchema,
  MetadataTypeSchema,
  refKey,
} from '../src/types.js';

describe('MetaRefSchema', () => {
  it('accepts a valid ref', () => {
    const ref = MetaRefSchema.parse({
      org: 'acme',
      project: 'crm',
      branch: 'main',
      type: 'view',
      name: 'case',
    });
    expect(ref.org).toBe('acme');
  });

  it('defaults branch to main', () => {
    const ref = MetaRefSchema.parse({
      org: 'acme',
      project: 'crm',
      type: 'view',
      name: 'case',
    });
    expect(ref.branch).toBe('main');
  });

  it('rejects camelCase names', () => {
    expect(() =>
      MetaRefSchema.parse({
        org: 'acme', project: 'crm', branch: 'main',
        type: 'view', name: 'caseRecord',
      }),
    ).toThrow();
  });

  it('rejects unknown types', () => {
    expect(() =>
      MetaRefSchema.parse({
        org: 'acme', project: 'crm', branch: 'main',
        type: 'widget', name: 'case',
      }),
    ).toThrow();
  });
});

describe('refKey', () => {
  it('produces a stable string key', () => {
    expect(refKey({ org: 'a', project: 'b', branch: 'main', type: 'view', name: 'case' }))
      .toBe('a/b/main/view/case');
  });

  it('ignores version', () => {
    const k1 = refKey({ org: 'a', project: 'b', branch: 'main', type: 'view', name: 'case' });
    const k2 = refKey({
      org: 'a', project: 'b', branch: 'main', type: 'view', name: 'case',
      // @ts-expect-error — refKey signature drops version, but extra fields are tolerated
      version: 'sha256:abc',
    });
    expect(k1).toBe(k2);
  });
});

describe('MetadataItemSchema', () => {
  const sample = {
    ref: { org: 'a', project: 'b', branch: 'main', type: 'view' as const, name: 'case' },
    body: { name: 'case', type: 'object-grid' },
    hash: 'sha256:' + 'a'.repeat(64),
    parentHash: null,
    authoredBy: 'cli',
    authoredAt: '2026-05-22T00:00:00Z',
    seq: 1,
  };

  it('accepts a valid item', () => {
    expect(() => MetadataItemSchema.parse(sample)).not.toThrow();
  });

  it('rejects malformed hash', () => {
    expect(() => MetadataItemSchema.parse({ ...sample, hash: 'sha1:foo' })).toThrow();
  });

  it('requires non-negative seq', () => {
    expect(() => MetadataItemSchema.parse({ ...sample, seq: -1 })).toThrow();
  });
});

describe('MetadataEventSchema', () => {
  it('accepts a valid event', () => {
    const evt = MetadataEventSchema.parse({
      seq: 1,
      op: 'create',
      ref: { org: 'a', project: 'b', branch: 'main', type: 'view', name: 'case' },
      hash: 'sha256:' + 'a'.repeat(64),
      parentHash: null,
      actor: 'cli',
      ts: '2026-05-22T00:00:00Z',
      source: 'fs',
    });
    expect(evt.op).toBe('create');
  });

  it('allows hash=null on delete', () => {
    const evt = MetadataEventSchema.parse({
      seq: 2,
      op: 'delete',
      ref: { org: 'a', project: 'b', branch: 'main', type: 'view', name: 'case' },
      hash: null,
      parentHash: 'sha256:' + 'a'.repeat(64),
      actor: 'cli',
      ts: '2026-05-22T00:00:00Z',
      source: 'fs',
    });
    expect(evt.hash).toBeNull();
  });
});

describe('MetadataTypeSchema', () => {
  it('includes the core types from MetadataTypeSchema enum', () => {
    for (const t of ['object', 'view', 'flow', 'agent', 'tool', 'dashboard', 'page']) {
      expect(() => MetadataTypeSchema.parse(t)).not.toThrow();
    }
  });
});
