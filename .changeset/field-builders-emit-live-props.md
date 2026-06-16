---
"@objectstack/spec": minor
---

fix(spec): `Field.rating` / `Field.vector` builders emit live props instead of dead ones

The `Field.rating(n)` and `Field.vector(n)` builders emitted properties the
spec-liveness ledger classifies as **dead** (silent runtime no-ops), so every
field authored through them tripped the `liveness-dead-property` author lint:

- `Field.rating(n)` emitted `maxRating`, but the rating renderer reads the flat
  `max` prop (`RatingField.tsx:13`). The builder now emits `max`.
- `Field.vector(n)` emitted a nested `vectorConfig` block, but the renderer
  reads the flat `dimensions` sibling (`VectorField.tsx:11`) and nothing
  consumes `vectorConfig` (no vector-index DDL). The builder now emits the flat
  `dimensions`.

`dimensions` is also promoted to a **declared, live** top-level `FieldSchema`
property. It was previously only valid nested inside `vectorConfig`, so a flat
`dimensions` authored by hand was silently **stripped** during compile (Zod
drops unknown keys) — the renderer then saw no dimensionality. It now survives
compilation and is governed by the liveness gate.

`maxRating` and `vectorConfig` remain accepted by the schema (still classified
`dead` + `authorWarn`) for back-compat, so hand-authored usages still surface
the advisory warning rather than type-erroring.
