// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.
//
// CAPABILITY-MATRIX golden test — every authorable field type must survive a
// real HTTP write → read round-trip.
//
// @proof: field-type-roundtrip
// ADR-0054 runtime proof for the field-type high-risk class. Referenced by the
// liveness ledger entry `field.type` (packages/spec/liveness/field.json); the
// spec liveness gate fails if this tag is removed. See proof-registry.mts.
//
// `showcase_field_zoo` carries one field of (almost) every protocol FieldType.
// Until now it was only *static*-checked (the metadata bundle registers it);
// nothing wrote a record and read it back. But the platform's value is that an
// AI can author ANY field and it works at runtime — so each field type needs a
// runtime proof, not a shape assertion. This is the first block of that matrix
// and the direct guard for #2004 (array-typed fields silently failed to persist;
// Field.time rejected time-of-day).

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import showcaseStack from '@objectstack/example-showcase';
import { SECRET_MASK } from '@objectstack/objectql';
import { bootStack, type VerifyStack } from '@objectstack/verify';

import { MATRIX } from './field-zoo.matrix';
describe('dogfood: field-type capability matrix round-trips over HTTP (#2004)', () => {
  let stack: VerifyStack;
  let record: Record<string, unknown>;

  beforeAll(async () => {
    stack = await bootStack(showcaseStack);
    const token = await stack.signIn();

    // Build the create body from every entry that carries a `write` value
    // (+ required name). `present`/`computed` server-owned fields are skipped.
    const body: Record<string, unknown> = { name: 'zoo-roundtrip' };
    for (const c of MATRIX) {
      if ('write' in c.check && c.check.write !== undefined) body[c.field] = c.check.write;
    }

    const created = await stack.apiAs(token, 'POST', '/data/showcase_field_zoo', body);
    expect(created.status, `create failed: ${created.status} ${await created.clone().text()}`).toBeLessThan(300);
    const createdJson = (await created.json()) as { id?: string; record?: { id?: string } };
    const id = createdJson.id ?? createdJson.record?.id;
    expect(id, 'no id returned from create').toBeTruthy();

    const got = await stack.apiAs(token, 'GET', `/data/showcase_field_zoo/${id}`);
    expect(got.status).toBe(200);
    const gotJson = (await got.json()) as { record?: Record<string, unknown> } & Record<string, unknown>;
    record = (gotJson.record ?? gotJson) as Record<string, unknown>;
  }, 60_000);

  afterAll(async () => {
    await stack?.stop();
  });

  for (const c of MATRIX) {
    // xfail entries are KNOWN type-fidelity gaps: `it.fails` passes while the
    // assertion throws and turns RED the moment the gap is fixed — forcing the
    // quarantine to be lifted rather than silently rotting.
    const runner = c.xfail ? it.fails : it;
    runner(`${c.type} (${c.field}) round-trips`, () => {
      const actual = record[c.field];
      switch (c.check.kind) {
        case 'equal':
          expect(actual).toEqual(c.check.write);
          break;
        case 'setEqual': {
          // Array-typed fields: persisted as a JSON array; order is not
          // guaranteed, so compare as sets (the #2004 break returned null/[]).
          expect(Array.isArray(actual), `${c.field} not an array: ${JSON.stringify(actual)}`).toBe(true);
          expect([...(actual as unknown[])].sort()).toEqual([...c.check.write].sort());
          break;
        }
        case 'present':
          expect(actual ?? null, `${c.field} should be persisted`).not.toBeNull();
          break;
        case 'masked':
          // secret never leaves the engine as plaintext — the write value is
          // encrypted into sys_secret and the read path returns the mask.
          expect(actual, `${c.field} should not echo plaintext`).not.toEqual(c.check.write);
          expect(actual).toEqual(SECRET_MASK);
          break;
        case 'computed':
          expect(Number(actual)).toBeCloseTo(Number(c.check.expected), 5);
          break;
      }
    });
  }
});
