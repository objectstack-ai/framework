---
"@objectstack/spec": minor
"@objectstack/service-analytics": minor
---

Propagate a dataset measure's declared currency to the analytics result field.

Adds an optional `DatasetMeasure.currency` (ISO 4217) on the semantic layer and
carries it onto each measure result field alongside `label`/`format`, so a
currency-aware client (Intl symbol) can render `¥1,234` / `$616,000` from a real
currency code instead of a plain number or a `$` baked into `format`. Additive
and optional — existing datasets are unaffected.
