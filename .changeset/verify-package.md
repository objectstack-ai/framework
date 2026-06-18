---
"@objectstack/verify": minor
"@objectstack/cli": minor
---

Add `@objectstack/verify` — boot any ObjectStack app in-process and verify it through the real HTTP stack: auto-derived CRUD round-trip fidelity (`runCrudVerification`) plus the cross-owner RLS invariant (`runRlsProofs`, "you can't write what you can't read"). Also adds an `objectstack verify` CLI command that runs these proofs against an app config and exits non-zero on real failures.

Extracted from the internal dogfood regression gate so third-party and template authors can run the same runtime proofs against their own apps. The private `@objectstack/dogfood` package now consumes this library for its golden regression tests.
