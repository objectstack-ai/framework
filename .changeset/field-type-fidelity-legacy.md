---
"@objectstack/driver-sql": patch
---

fix(driver-sql): make numeric-scalar type fidelity self-heal on legacy SQLite columns

The #2025 fix mapped `rating`/`slider`/`progress` to numeric columns, but SQLite never alters a column's type in place and the schema reconciler only adds missing columns — so a column created before that fix keeps its TEXT affinity and would still read back `'4'` instead of `4` forever.

A read-side numeric coercion (the new `numericFields` registry, single-sourced from `NUMERIC_SCALAR_TYPES`) now coerces numeric-looking stored strings back to numbers on read, mirroring how `dateFields` already repairs legacy timestamp-typed `Field.date` rows. The fidelity no longer depends on column affinity alone; `null` and genuinely non-numeric legacy values are left intact rather than turned into `0`/`NaN`.
