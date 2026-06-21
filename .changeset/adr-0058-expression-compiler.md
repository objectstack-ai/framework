---
"@objectstack/formula": minor
"@objectstack/plugin-security": minor
"@objectstack/plugin-sharing": minor
---

ADR-0058 — expression & predicate surface unification. Adds the canonical
CEL→FilterCondition pushdown compiler in `@objectstack/formula`
(`compileCelToFilter`, `isPushdownableCel`, `lowerCelAst`) plus an in-memory
`matchesFilterCondition` backend (one AST, three backends). `plugin-security`
(RLS `using`, via a SQL bridge) and `plugin-sharing` (`celToFilter`) cut over to
it, retiring the bespoke regex/field-equality front-ends. Compound sharing
conditions now compile and enforce end-to-end (closes #1887). The RLS `check`
clause is now enforced on the write post-image (insert/by-id update), fail-closed.
Non-pushdownable predicates (arithmetic, functions, subqueries, cross-object) are
an authoring compile error, never silently dropped (ADR-0049/0055).
