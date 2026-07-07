// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.
//
// Driver read-coercion conformance.
//
// A stored value must read back as its DECLARED type on every driver: a
// `boolean` as a JS boolean (not the integer 0/1 SQLite stores), a `json` field
// as an object/array (not serialized text), an `integer` as a number. When two
// drivers disagree, code that is green on one silently breaks on the other.
//
// This is the invariant behind the 2026-07-06 `case_escalation` incident: a
// boolean guard `field != true` on Turso read the field back as integer `1`, so
// `1 != true` was always true and the flow self-triggered forever — while the
// local repro (memory / better-sqlite3, both of which coerce) was green in 6s.
//
// The check itself is the reusable, driver-agnostic `checkReadCoercion` from
// `@objectstack/verify` (empty problem list = conformant). This suite runs it
// against the framework's own SQL + memory drivers; cloud's driver-turso runs
// the identical contract against itself in remote mode.

import { describe, it, expect } from 'vitest';
import { checkReadCoercion } from '@objectstack/verify';
import { SqlDriver } from '@objectstack/driver-sql';
import { InMemoryDriver } from '@objectstack/driver-memory';

const DRIVERS = [
  {
    name: 'driver-sql (better-sqlite3 :memory:)',
    make: () =>
      new SqlDriver({
        client: 'better-sqlite3',
        connection: { filename: ':memory:' },
        useNullAsDefault: true,
      }),
  },
  {
    name: 'driver-memory',
    make: () => new InMemoryDriver(),
  },
];

describe.each(DRIVERS)('read-coercion conformance: $name', ({ make }) => {
  it('reads a stored row back as its declared types (boolean/json/number)', async () => {
    const problems = await checkReadCoercion(make() as any);
    expect(problems).toEqual([]);
  });
});
