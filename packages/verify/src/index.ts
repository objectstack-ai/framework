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

export { deriveCrudCases } from './derive.js';
export type { CrudCase, DerivedAssert, AssertKind } from './derive.js';

export { runCrudVerification, formatReport } from './verify.js';
export type { VerifyReport, ObjectVerifyResult } from './verify.js';

export { runRlsProofs, formatRlsReport } from './rls.js';
export type { RlsReport, RlsResult } from './rls.js';
