---
'@objectstack/spec': minor
'@objectstack/plugin-security': minor
---

feat(spec,security): make ambiguous nav landings unrepresentable + close the field-permission filter oracle (objectui#2251, objectui ADR-0055).

**spec — `ObjectNavItem` target exclusivity.** `NavigationItemSchema` now rejects an object nav item that combines `filters` with `recordId` or `viewName` (custom issue on `filters` with the fix in the message). Runtime precedence would silently ignore the extras — a stale `recordId` hijacking a configured `filters` slice — so the ambiguous combination is now unwritable (ADR-0053 correct-by-construction). FROM `{ filters, viewName }` / `{ filters, recordId }` TO exactly one landing field; the legacy `recordId` + `viewName` combination stays tolerated (documented: `viewName` is ignored). `filters` shipped in the same unreleased minor, so no released metadata is affected.

**plugin-security — field-level predicate guard.** `FieldMasker` strips non-readable fields from RESULTS, but predicates still leaked their values: filtering / sorting / grouping / aggregating by a hidden field changes row presence (a filter oracle — probe `salary >= X` even though the column is masked). The security middleware now rejects (403 `PermissionDeniedError`, `reason: 'field_predicate_denied'`) any caller query whose `where` / `orderBy` / `groupBy` / `having` / `aggregations` / `windowFunctions` reference a field the caller cannot read — evaluated against the caller's AST **before** RLS injection, so RLS policies may keep referencing hidden fields (e.g. `owner_id`). Rejection over silent predicate dropping: removing an `$and` branch widens results and re-opens the oracle. New exports: `assertReadableQueryFields`, `collectQueryFields`, `collectConditionFields`.
