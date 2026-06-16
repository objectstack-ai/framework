---
"@objectstack/formula": minor
"@objectstack/cli": minor
---

feat(validate): flag bare field references in record-scoped CEL sites at build time

> **Heads-up for downstream:** this adds a NEW build-time error. A `Field.formula`
> or validation predicate that references a field bare (`amount` instead of
> `record.amount`) now fails `objectstack compile`. These expressions were already
> silently broken at runtime (they evaluated to `null` / never fired), so this is a
> fix that surfaces a latent bug — but a stack carrying one will go from
> "builds, silently wrong" to "fails the build" on upgrade. The error message
> states the exact correction (`write record.<field>`).

A `Field.formula` and an object validation predicate evaluate against the
`record` namespace only — there is no field flattening — so a bare top-level
identifier (`amount`, `status`) resolves to nothing and the expression silently
evaluates to `null` / never fires. This is the silent-at-runtime class behind
the broken example-crm formulas (#1927) and is exactly what AI authors get wrong.

`validateExpression` now takes an evaluation `scope` and, for `scope: 'record'`,
reports a bare reference with the corrective form (`write record.<field>`). The
check is schema-free and acts only on cel-js's `Unknown variable` fault, so it
cannot false-positive on arithmetic/comparison/null-guard type overloads. Flow
and automation conditions keep the default `scope: 'flattened'` — the record's
fields ARE spread to top-level there (alongside flow variables), so bare refs
are correct and are NOT flagged. `objectstack compile` wires `record` scope for
field formulas and validation predicates; flow conditions stay flattened.
