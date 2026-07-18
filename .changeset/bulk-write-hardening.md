---
"@objectstack/core": patch
"@objectstack/objectql": patch
"@objectstack/rest": patch
"@objectstack/metadata-protocol": patch
---

fix: harden the bulk-write path — retries, idempotency, contracts, and summary visibility (#3147–#3152)

Six reliability fixes to the batched seed/import + `engine.insert(array)` path
introduced by the #2678 bulk-write rework:

- **#3151** `bulkWrite` validates that `writeBatch` returns one record per input
  row (a short/long/non-array return is degraded per-row, not backfilled as
  phantom success); `engine.insert(array)` likewise rejects a short driver
  `bulkCreate` return instead of padding afterInsert with `undefined`.
- **#3150** wraps the two remaining un-retried write points (seed
  `writeRecord`/`resolveDeferredUpdates`, import's no-`createManyData`
  fallback) in `withTransientRetry`; `defaultIsTransientError` short-circuits
  definitive logical errors to non-transient.
- **#3148** import `resolveRef` flushes pending creates on a same-object miss so
  a later row can reference an earlier same-file CREATE, and no longer
  negatively caches a miss.
- **#3149** threads an `attempt` counter through `bulkWrite`; seed rechecks by
  `externalId` and import by `matchFields` before re-writing, so a
  commit-then-lost-response retry cannot duplicate a batch.
- **#3147** `recomputeSummaries` retries transient failures and, on exhaustion,
  surfaces `SummaryRecomputeError` (`ERR_SUMMARY_RECOMPUTE`) instead of a
  silent warn; seed/import recover it to a warning without re-writing.
- **#3152** autonumbers are assigned after validation, so a batch that dies in
  validation consumes no sequence value (no number-range gaps).
