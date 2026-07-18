---
"@objectstack/spec": patch
---

Remove the dead `'delete'` member from the validation-rule `events` enum (#3184). The rule evaluator only runs on the insert/update write path — `engine.delete` never invokes it — so a rule declaring `events: ['delete']` was a silent no-op (flagged in #3106 and `docs/audits/2026-06-validationschema-property-liveness.md`). The enum now admits only `insert`/`update`; guard deletions with a `beforeDelete` lifecycle hook instead. No shipped metadata declares `events: ['delete']`; any off-spec metadata that did now fails loudly at `os validate` / registration rather than parsing and doing nothing. Also narrows the two hand-written mirrors (`rule-validator.ts` `BaseRule`, `metadata-protocol` JSON-schema form helper — whose stale `type` enum listing removed `unique`/`async`/`custom` variants is corrected in the same pass), updates the doc comments, the published data skill, and the hand-written validation doc.
