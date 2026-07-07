// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Driver read-coercion conformance — a reusable, driver-agnostic check.
 *
 * A stored value must read back as its DECLARED type on every driver: a
 * `boolean` as a JS boolean (not the integer 0/1 SQLite stores), a `json` field
 * as an object/array (not serialized text), an `integer` as a number. When two
 * drivers disagree, code that is green on one silently breaks on the other.
 *
 * This is the invariant behind the 2026-07-06 `case_escalation` incident: a
 * boolean guard `field != true` read the field back as integer `1` on Turso, so
 * `1 != true` was always true and the flow self-triggered forever — while the
 * local repro (memory / better-sqlite3, both of which coerce) was green.
 *
 * Like {@link checkLedger}, this returns a list of human-readable problems
 * (empty = conformant) and carries NO test-runner dependency — callers assert
 * `expect(await checkReadCoercion(driver)).toEqual([])`. It takes any driver
 * structurally (see {@link CoercibleDriver}) so out-of-tree drivers — e.g.
 * cloud's `driver-turso` in remote mode — can run the identical contract against
 * themselves without importing a concrete driver type.
 */

/** The minimal driver surface this check drives. */
export interface CoercibleDriver {
  connect?(): Promise<void>;
  disconnect?(): Promise<void>;
  syncSchema(object: string, schema: unknown, options?: unknown): Promise<void>;
  create(object: string, data: Record<string, unknown>, options?: unknown): Promise<unknown>;
  find(object: string, query: unknown, options?: unknown): Promise<any[]>;
}

export interface ReadCoercionOptions {
  /** Object/table name to create for the probe. Default `read_coercion_probe`. */
  object?: string;
}

const FIELDS = {
  name: { type: 'string' },
  active: { type: 'boolean' },
  meta: { type: 'json' },
  count: { type: 'integer' },
} as const;

const INPUT = { id: '1', name: 'Widget', active: true, meta: { k: 1, arr: [1, 2] }, count: 5 };

function stableStringify(v: unknown): string {
  // Order-insensitive for plain objects so a driver that reorders JSON keys on
  // round-trip is not falsely flagged; arrays keep their order.
  const norm = (x: any): any => {
    if (Array.isArray(x)) return x.map(norm);
    if (x && typeof x === 'object') {
      return Object.keys(x).sort().reduce((o: any, k) => ((o[k] = norm(x[k])), o), {});
    }
    return x;
  };
  return JSON.stringify(norm(v));
}

/**
 * Round-trip a typed row through `driver` and report every field whose read-back
 * value does not match its declared type. Empty array = conformant.
 */
export async function checkReadCoercion(
  driver: CoercibleDriver,
  opts: ReadCoercionOptions = {},
): Promise<string[]> {
  const object = opts.object ?? 'read_coercion_probe';
  const problems: string[] = [];

  await driver.connect?.();
  try {
    await driver.syncSchema(object, { name: object, fields: FIELDS });
    await driver.create(object, { ...INPUT });

    // Read back only the row we just wrote (by id), so the check is robust even
    // when the probe object already holds unrelated rows on a shared backend.
    const rows = await driver.find(object, { object, where: { id: INPUT.id } });
    if (!Array.isArray(rows) || rows.length !== 1) {
      problems.push(`find returned ${Array.isArray(rows) ? `${rows.length} rows` : typeof rows}, expected exactly 1`);
      return problems;
    }
    const row = rows[0] as Record<string, unknown>;

    if (row.active !== true) {
      problems.push(`boolean not coerced: 'active' expected true, got ${typeof row.active} ${JSON.stringify(row.active)}`);
    }
    if (stableStringify(row.meta) !== stableStringify(INPUT.meta)) {
      problems.push(`json not coerced: 'meta' expected object ${JSON.stringify(INPUT.meta)}, got ${typeof row.meta} ${JSON.stringify(row.meta)}`);
    }
    if (row.count !== 5) {
      problems.push(`number not coerced: 'count' expected 5, got ${typeof row.count} ${JSON.stringify(row.count)}`);
    }
  } finally {
    await driver.disconnect?.();
  }

  return problems;
}
