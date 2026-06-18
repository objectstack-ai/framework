// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.
//
// Point the verifier at ANY app's built artifact — the embryonic
// `objectstack verify <app>`. This is the consumer-facing use: a third-party app
// (e.g. hotcrm) runs it against its OWN metadata to learn where its declared
// behavior doesn't hold at runtime.
//
// Gated on OS_VERIFY_ARTIFACT so it never runs in framework CI (the external app
// isn't in the workspace). Run locally:
//   OS_VERIFY_ARTIFACT=/abs/path/to/app/dist/objectstack.json \
//     pnpm --filter @objectstack/dogfood exec vitest run test/verify-external.dogfood.test.ts

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { bootDogfoodStack, type DogfoodStack } from '../src/harness.js';
import { runCrudVerification, formatReport, type VerifyReport } from '../src/verify.js';

const ARTIFACT = process.env.OS_VERIFY_ARTIFACT;

describe.skipIf(!ARTIFACT || !existsSync(ARTIFACT))('objectstack verify: external app artifact', () => {
  let stack: DogfoodStack;
  let report: VerifyReport;

  beforeAll(async () => {
    const config = JSON.parse(readFileSync(ARTIFACT as string, 'utf8'));
    stack = await bootDogfoodStack(config);
    const token = await stack.signIn();
    report = await runCrudVerification(stack, token, config);
    // eslint-disable-next-line no-console
    console.error(formatReport(report));
  }, 120_000);

  afterAll(async () => {
    await stack?.stop();
  });

  it('boots the external app and auto-derives a runtime contract', () => {
    expect(report.summary.objects).toBeGreaterThan(0);
  });
});
