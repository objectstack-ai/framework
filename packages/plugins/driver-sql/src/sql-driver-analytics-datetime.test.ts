// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * End-to-end repro of the dashboard time-series "No rows" bug at the storage
 * level, and proof of the fix.
 *
 * The analytics `NativeSQLStrategy` compiles dashboard relative-date tokens
 * (e.g. `{12_months_ago}`) to ISO date strings and binds them into a raw
 * `SELECT … WHERE col >= ?` that it runs through the driver's `execute()` —
 * bypassing the normal `find()` filter coercion. Under better-sqlite3 a
 * `Field.datetime` column is stored as an INTEGER epoch (ms), so the ISO TEXT
 * comparand never matches (TEXT sorts after every INTEGER) → 0 rows, even though
 * the rows exist. A `Field.date` column stores ISO TEXT and matches fine.
 *
 * This test reproduces both the broken (raw ISO bind → 0) and fixed (epoch bind
 * via the driver's public `temporalFilterValue` → N) behaviour against a real
 * SQLite database, mirroring exactly what the analytics strategy now does.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SqlDriver } from '../src/index.js';

describe('Analytics datetime filter — SQLite epoch storage (E2E repro)', () => {
  let driver: SqlDriver;
  const TABLE = 'compliance_assessment';
  const CUTOFF = '2025-06-18'; // ISO date token the dashboard expands to

  beforeEach(async () => {
    driver = new SqlDriver({
      client: 'better-sqlite3',
      connection: { filename: ':memory:' },
      useNullAsDefault: true,
    });

    await driver.initObjects([
      {
        name: TABLE,
        fields: {
          title: { type: 'string' },
          assessed_at: { type: 'datetime' }, // stored as INTEGER epoch ms
          assessed_on: { type: 'date' },      // stored as YYYY-MM-DD text
        },
      },
    ]);

    // Four assessments AFTER the cutoff, one well before — inserted with real
    // Date objects so better-sqlite3 stores `assessed_at` as INTEGER epoch ms,
    // exactly the path the seed loader takes.
    const rows = [
      ['a1', new Date('2024-01-01T00:00:00Z'), '2024-01-01'], // before cutoff
      ['a2', new Date('2025-06-18T09:00:00Z'), '2025-06-18'], // on/after
      ['a3', new Date('2025-09-01T09:00:00Z'), '2025-09-01'],
      ['a4', new Date('2026-01-15T09:00:00Z'), '2026-01-15'],
      ['a5', new Date('2026-05-20T09:00:00Z'), '2026-05-20'],
    ] as const;
    for (const [id, at, on] of rows) {
      await driver.create(
        TABLE,
        { id, title: id, assessed_at: at, assessed_on: on },
        { bypassTenantAudit: true },
      );
    }
  });

  afterEach(async () => {
    await driver.disconnect();
  });

  const countWhere = async (col: string, bind: unknown): Promise<number> => {
    const res: any = await driver.execute(
      `SELECT count(*) AS n FROM "${TABLE}" WHERE "${col}" >= ?`,
      [bind],
    );
    const row = Array.isArray(res) ? res[0] : res?.rows?.[0] ?? res;
    return Number(row.n);
  };

  it('BUG: a raw ISO comparand against the epoch datetime column returns 0 rows', async () => {
    // This is what the type-blind strategy used to bind — the silent failure.
    expect(await countWhere('assessed_at', CUTOFF)).toBe(0);
  });

  it('FIX: the driver-coerced epoch comparand returns the 4 matching rows', async () => {
    // `temporalFilterValue` is exactly the hook NativeSQLStrategy now calls.
    const coerced = driver.temporalFilterValue(TABLE, 'assessed_at', CUTOFF);
    expect(typeof coerced).toBe('number'); // epoch ms, not the ISO string
    expect(await countWhere('assessed_at', coerced)).toBe(4);
  });

  it('CONTROL: the `Field.date` text column already matched the raw ISO comparand', async () => {
    // Proves the date/text path was never broken and is left untouched.
    const coerced = driver.temporalFilterValue(TABLE, 'assessed_on', CUTOFF);
    expect(typeof coerced).toBe('string'); // YYYY-MM-DD, NOT coerced to epoch
    expect(await countWhere('assessed_on', coerced)).toBe(4);
    // and the raw ISO bind matches identically (no coercion needed for text)
    expect(await countWhere('assessed_on', CUTOFF)).toBe(4);
  });

  it('does not touch a non-temporal column', () => {
    expect(driver.temporalFilterValue(TABLE, 'title', 'hello')).toBe('hello');
  });
});
