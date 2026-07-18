---
"@objectstack/runtime": patch
---

feat(runtime): seed-replayer reports `skipped` so hosts can stamp seed-once on progress

The `seed-replayer` kernel service returned `{ inserted, updated, errors }` but
not `skipped`. A cloud host therefore could not tell an **all-skip replay**
(the env's seed data is already present — a no-op) apart from the
zero-summary early-returns that never ran the loader (no organization, no
metadata service, no datasets). Both looked like `inserted = updated = 0`, so
the host could not safely stamp its seed-once record for the all-skip case and
re-ran the full remote replay on every cold boot.

Add `skipped: result.summary.totalSkipped` to the replayer's return; the
early-returns report `skipped: 0`. This lets a host (cloud#853's
`decideSeedStamp`) stamp on progress — including an all-skip replay — while
still declining to stamp a genuine no-loader zero-summary. Additive and
backward compatible; existing consumers ignore the new field.
