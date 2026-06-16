---
"@objectstack/objectql": patch
---

fix(objectql): thread execution context into read-time formula evaluation

`applyFormulaPlan` — which computes `Field.formula` virtual fields after a `find`/`findOne` — evaluated each expression with only `{ record }`. So a formula using `now()`/`today()` ran against a fresh wall-clock read on every evaluation (no determinism), and a formula referencing the caller (`os.user.id`, `os.org.id`) faulted and fell back to `null` because the user/org were never in scope.

It now builds the eval context the same way `applyFieldDefaults` already does: a `now` snapshot **pinned once per operation** (every row and every formula field in one read observes the same instant) plus `os.user` / `os.org` resolved from the `ExecutionContext`. Read-time formulas behave consistently with default-value expressions, and computed fields can reference the caller.

This is independent of timezone; it is the read-path prerequisite for ADR-0053 Phase 2 (#1980 will additionally thread `timezone` here once `ExecutionContext.timezone` exists).
