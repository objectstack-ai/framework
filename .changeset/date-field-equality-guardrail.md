---
"@objectstack/formula": minor
---

feat(formula): warn when a `date` field is compared to a temporal function with `==`/`!=` (#3183)

A `Field.date` deserializes as a `YYYY-MM-DD` **string** (ADR-0053 Phase 1), and
cel-js's equality hard-codes `string == <timestamp>` to `false` — it returns
`false` for a string left operand without ever consulting a registered overload,
and refuses cross-type object equality (`@marcbachmann/cel-js` `overloads.js`
`isEqual`). So the most natural "is it due today" predicate —

```cel
record.due_date == today()      // silently false, even when due_date IS today
record.due_date != today()      // silently true for a same-day record
```

— compiles clean, throws nothing, and silently never matches. Same silent-miss
family as #1928; **timezone-independent** (fails identically at UTC) and
cross-cutting (formulas, validation, RLS, flow/action/sharing/hook predicates).

cel-js gives no operator-layer hook to fix the comparison, so this adds a
**build-time advisory warning** (the established ADR-0032 guardrail strategy)
rather than a runtime behavior change. `validateExpression` reuses the shared
`ExprSchemaHint.fieldTypes` (the same per-field type map the #1928 tier-4
soundness check already threads through `@objectstack/lint`) to flag a `==`/`!=`
between a `date` field (`record.`/`previous.`/bare) and
`today()`/`daysFromNow()`/`daysAgo()`/`now()`, with a self-correcting message
pointing at the working idioms: `date(record.d) == today()`, a range
(`>= … && <= …`), or `daysBetween(today(), record.d) == 0`.

Warning severity — never fails the build (the write/validation path may carry a
real `Date`). Restricted to `type: 'date'` (unambiguously a string); `datetime`
is excluded to avoid false positives. Ordering operators (`>=`/`<=`/`<`/`>`)
already work — cel-js *throws* for them, tripping the engine's existing
string-hydration retry — so they are not flagged.

A runtime fix (normalizing the peer of a temporal operand in the data layer)
remains tracked in #3183; a naive "hydrate date fields to `Date`" version would
trade this silent-miss for another (breaking `dateField == "2026-06-20"`), so it
needs its own design.
