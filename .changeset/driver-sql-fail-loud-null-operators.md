---
"@objectstack/driver-sql": patch
"@objectstack/spec": patch
---

fix(driver-sql): fail-loud on unknown filter operators; real IS NULL / IS NOT NULL; $not support (#2704)

The SQL driver used to forward any filter operator it didn't recognise straight
to Knex. On a null comparand that silently compiled to a whole-table match, so a
permission/assignment-scoped list view could leak every row (e.g. an
`is_null` / `is_empty` operator from the client). It also had no real
null-check: `field = null` never renders `IS NULL` in SQL.

This change makes the driver:

- Render null predicates as real SQL — `is_null` / `isnull` / `is_empty`
  (and the not-null variants) → `IS NULL` / `IS NOT NULL`, unified with
  `equals` + null; `!= null` → `IS NOT NULL`.
- Support the full spec operator set plus client alias spellings across both
  filter shapes (array `[field, op, value]` and object `{field: {$op: value}}`):
  `$between`, `$startsWith`, `$endsWith`, `$notContains`, `$null`, `$exists`,
  and the logical `$not` (a negated sub-condition, matching driver-mongodb /
  driver-memory — CEL `!expr` permission scopes compile to it).
- LIKE-escape `contains` / `startsWith` / `endsWith` values with an explicit
  `ESCAPE '\'` so `%` / `_` in user input can't widen the match.
- **Throw on a genuinely unknown operator** in both paths instead of silently
  passing it through — no more silent whole-table results.

`@objectstack/spec` recognises the client alias operator spellings
(`isnull` / `is_empty` / …) in `VALID_AST_OPERATORS` and maps them to `$null`
so the array-AST → object-filter conversion is consistent with the driver.
