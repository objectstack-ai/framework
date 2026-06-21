// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.
//
// @objectstack/verify — public API.
//
// Boot any ObjectStack app in-process and verify it through the real HTTP
// stack. Two proof families, both app-agnostic (derived from your metadata):
//   - data fidelity   : runCrudVerification — author → write → read → assert
//   - authorization   : runRlsProofs        — "you can't write what you can't read"

export { bootStack } from './harness.js';
export type { VerifyStack, BootOptions } from './harness.js';

export { deriveCrudCases, fillRelationalRefs } from './derive.js';
export type { CrudCase, DerivedAssert, AssertKind, RelationalRef } from './derive.js';

export { runCrudVerification, formatReport } from './verify.js';
export type { VerifyReport, ObjectVerifyResult } from './verify.js';

export { runRlsProofs, formatRlsReport } from './rls.js';
export type { RlsReport, RlsResult } from './rls.js';

// ADR-0060 — reusable conformance-ledger helper (static complement to the
// runtime harness): classify every declarable property, fail closed on drift.
export { checkLedger } from './conformance.js';
export type { ConformanceRow, ConformanceState, CheckLedgerOptions } from './conformance.js';
