// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Dialect-correctness of `temporalFilterValue` (the hook the analytics layer
 * uses). The datetime → epoch-ms coercion is SQLite-ONLY: SQLite stores
 * `Field.datetime` as an INTEGER epoch, but Postgres/MySQL map it to a native
 * TIMESTAMP where an ISO string / Date binds correctly. Coercing to an epoch
 * integer on a native-timestamp dialect would compare INTEGER vs TIMESTAMP and
 * break the query — the exact Postgres regression we must NOT introduce.
 *
 * No DB connection is needed: we seed the field-type maps the way `initObjects`
 * would and exercise the pure coercion logic across dialects.
 */

import { describe, it, expect } from 'vitest';
import { SqlDriver } from '../src/index.js';

/** Test double that injects the field-type metadata without a live connection. */
class ProbeDriver extends SqlDriver {
  seedDatetime(table: string, field: string): void {
    (this.datetimeFields[table] ??= new Set()).add(field);
  }
  seedDate(table: string, field: string): void {
    (this.dateFields[table] ??= new Set()).add(field);
  }
}

function makeDriver(client: string): ProbeDriver {
  // Connection is never opened — we only call the synchronous coercion path.
  return new ProbeDriver({ client, connection: { filename: ':memory:' }, useNullAsDefault: true } as any);
}

const ISO = '2025-06-18';
const EPOCH = Date.parse('2025-06-18T00:00:00.000Z');

describe('temporalFilterValue dialect gating', () => {
  it('SQLite: datetime ISO comparand → epoch ms', () => {
    const d = makeDriver('better-sqlite3');
    d.seedDatetime('t', 'at');
    expect(d.temporalFilterValue('t', 'at', ISO)).toBe(EPOCH);
  });

  it('Postgres: datetime ISO comparand is LEFT UNCHANGED (no epoch coercion → no regression)', () => {
    const d = makeDriver('pg');
    d.seedDatetime('t', 'at');
    expect(d.temporalFilterValue('t', 'at', ISO)).toBe(ISO);
  });

  it('MySQL: datetime ISO comparand is left unchanged', () => {
    const d = makeDriver('mysql2');
    d.seedDatetime('t', 'at');
    expect(d.temporalFilterValue('t', 'at', ISO)).toBe(ISO);
  });

  it('Field.date normalises to YYYY-MM-DD text on every dialect', () => {
    for (const client of ['better-sqlite3', 'pg', 'mysql2']) {
      const d = makeDriver(client);
      d.seedDate('t', 'on');
      expect(d.temporalFilterValue('t', 'on', '2025-06-18T12:00:00Z')).toBe('2025-06-18');
    }
  });

  it('non-temporal fields pass through unchanged on every dialect', () => {
    for (const client of ['better-sqlite3', 'pg', 'mysql2']) {
      const d = makeDriver(client);
      expect(d.temporalFilterValue('t', 'name', 'hello')).toBe('hello');
    }
  });
});
