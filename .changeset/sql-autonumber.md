---
'@objectstack/driver-sql': minor
---

Generate `auto_number` / `autonumber` field values on insert. The driver
parses the field's `format` template (e.g. `CTR-{0000}`) to extract the
prefix and pad-width, then scans existing rows with the same prefix and
emits `prefix + padded(maxN + 1)` for any row that omits the field.

Note: per-call MAX+1 — not atomic across concurrent writers. Fine for
seed-data and low-write demo loads; production deployments should layer
a dedicated sequence table.
