// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.
//
// objectstack verify — metadata-driven runtime verification, proven against the
// framework's own example apps. From each app's metadata ALONE it auto-derives a
// CRUD round-trip contract (no hand-written cases) and runs it over real HTTP.
// The same runner points at any third-party app's built artifact via
// `test/verify-external.dogfood.test.ts`.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import crmStack from '@objectstack/example-crm';
import showcaseStack from '@objectstack/example-showcase';
import { bootDogfoodStack, type DogfoodStack } from '../src/harness.js';
import { runCrudVerification, formatReport, type VerifyReport } from '../src/verify.js';

const APPS: Array<[string, unknown]> = [
  ['crm', crmStack],
  ['showcase', showcaseStack],
];

for (const [name, config] of APPS) {
  describe(`objectstack verify: ${name} (auto-derived CRUD round-trip)`, () => {
    let stack: DogfoodStack;
    let report: VerifyReport;

    beforeAll(async () => {
      stack = await bootDogfoodStack(config as never);
      const token = await stack.signIn();
      report = await runCrudVerification(stack, token, config);
      // eslint-disable-next-line no-console
      console.error(formatReport(report));
    }, 60_000);

    afterAll(async () => {
      await stack?.stop();
    });

    it('derives a runtime contract from metadata and boots', () => {
      expect(report.summary.objects).toBeGreaterThan(0);
    });

    it('verifies objects end-to-end over real HTTP', () => {
      expect(report.summary.verified).toBeGreaterThan(0);
    });

    it('has no object that fails to create or read (the hard runtime invariant)', () => {
      // create/read failures = the app's metadata produces a record the runtime
      // refuses or can't read back — a real platform/integration finding (vs
      // `needs-fixture`, the auto-record tripping the app's own validation rules,
      // and `fidelity-gaps`, type leaks tracked separately).
      const hard = report.results.filter((r) => r.status === 'create-failed' || r.status === 'read-failed');
      expect(hard, JSON.stringify(hard, null, 2)).toHaveLength(0);
    });
  });
}
