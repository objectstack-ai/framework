// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.
//
// ADR-0056 D10 — the authorization conformance matrix is a CHECKED artifact.
// Refactored onto the reusable ADR-0060 `checkLedger` helper: one call asserts
// every shared invariant (valid state, enforced-has-site, experimental/removed-
// has-note, proof-file-exists, high-risk-has-proof). A new fail-open or a deleted
// proof breaks the build.

import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { checkLedger } from '@objectstack/verify';
import { AUTHZ_CONFORMANCE } from './authz-conformance.matrix.js';

const HERE = dirname(fileURLToPath(import.meta.url));

describe('ADR-0056 D10 — authorization conformance matrix', () => {
  it('is a sound conformance ledger (ADR-0060 checkLedger)', () => {
    const problems = checkLedger(AUTHZ_CONFORMANCE, {
      proofRoot: HERE, // proofs are dogfood test files alongside this one
      highRisk: ['owd-private', 'owd-public-read', 'controlled-by-parent', 'anonymous-deny', 'default-profile'],
    });
    expect(problems, problems.join('\n')).toEqual([]);
  });
});
