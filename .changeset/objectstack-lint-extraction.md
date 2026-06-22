---
"@objectstack/lint": minor
"@objectstack/cli": patch
---

feat(lint): extract static metadata validators into @objectstack/lint (ADR-0019 P3)

New public package `@objectstack/lint` holds the pure, build-time metadata
validators as `(stack) => Finding[]` functions, so the same rules run wherever a
stack can be assembled — the CLI's `os validate`/`compile` and any other
consumer (notably AI-driven authoring), instead of being trapped in CLI
internals where only the CLI could reach them.

First release moves the two validators the AI build needs:

- `validateWidgetBindings` — dashboard widget → dataset → measure/dimension
  reference integrity + measure-aggregation coherence (ADR-0021).
- `validateStackExpressions` — CEL/predicate validity for field conditionals,
  sharing rules, action visible/disabled, lifecycle hooks (ADR-0032).

`@objectstack/cli` now imports both from `@objectstack/lint` (was `./utils/*`);
pure move, no behavior change. Dependency direction is one-way `lint → spec`;
the package never depends on a runtime and is never bundled into a frontend
(that is why the validators do NOT live in the frontend-facing `@objectstack/spec`).

Filesystem-coupled checks (`lint-liveness-properties`) and CLI-command-coupled
ones (`score` → `lintConfig`) deliberately stay in the CLI for now; they can
move in a later increment.
