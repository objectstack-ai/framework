---
"@objectstack/runtime": minor
---

External Datasource Federation (ADR-0015) — boot-validation gate (Gate 2).

Adds `ExternalValidationPlugin` (`createExternalValidationPlugin`) which, on
`kernel:ready`, validates every federated object against its remote table via
the `external-datasource` service and applies the datasource's
`external.validation.onMismatch` policy: `fail` (throws
`ExternalSchemaMismatchError`, aborting boot — the default), `warn` (logs the
diff), or `ignore`. No-op when federation is unused.
