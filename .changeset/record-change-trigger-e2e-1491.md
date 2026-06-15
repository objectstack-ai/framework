---
---

test(trigger-record-change): add end-to-end regression coverage for record-change flows (#1491)

Test-only — no shipped-code change, so no version bump. #1491 reported that
record-change flows never fired on data writes (7.4.1–7.7.0); it no longer
reproduces on current `main` (fixed by the triggers-first-class-dir + flow-engine
alignment refactor). The existing tests only used a fake data engine, so the real
path was uncovered. Adds a full-kernel integration test (ObjectQL + automation +
record-change trigger + in-memory driver) asserting a `record-after-create` flow
fires and its `update_record` writes back — in both registration orderings
(direct `registerFlow`, and registry-pull at `automation.start()` with the
trigger binding on `kernel:ready`).
