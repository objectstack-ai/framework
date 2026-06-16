---
"@objectstack/cli": minor
---

feat(cli): two new flow authoring anti-pattern lints — date-equality filters (#1874) and phantom aggregation (#1870)

Extends the build-time flow anti-pattern lint (advisory warnings, never fail the build):

- **flow-date-equality-filter (#1874)**: a get_record/query filter that binds a
  field directly, or via `$eq`/`$in`, to a time-function value
  (`daysFromNow`/`today`/`now`/…). A `Field.date` stores a time component, so an
  exact match against a re-computed timestamp silently returns nothing. Range
  operators (`$gte`/`$lt` day windows) are the correct shape and are exempt.
- **flow-phantom-aggregation (#1870)**: a node config key naming a capability the
  automation engine does not have (`aggregations`/`aggregate`/`groupBy`/`rollup`/
  `having`). There is no aggregate node, so the key is silently ignored and the
  node computes nothing. Points the author to `Field.summary` / `Field.formula`.
