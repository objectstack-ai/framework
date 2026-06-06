---
'@objectstack/spec': minor
'@objectstack/objectql': minor
'@objectstack/driver-sql': minor
---

fix(autonumber): one owner for autonumber generation — the persistent driver sequence (#1603)

Autonumber values were generated in TWO places: the SQL driver's persistent,
atomic `_objectstack_sequences` table AND a non-persistent in-memory counter in
the ObjectQL engine. Because the engine pre-filled the field BEFORE calling the
driver, the driver always saw a value already set and skipped — so the
persistent sequence was effectively dead code, and a multi-instance / post-restart
deployment could mint duplicate numbers from the in-memory counter.

This makes generation single-owner:

- **`@objectstack/spec`** — `DriverCapabilities` gains an optional `autonumber`
  flag: "driver natively generates persistent autonumber/sequence values".

- **`@objectstack/driver-sql`** — advertises `supports.autonumber = true`.
  `bulkCreate()` now fills autonumber fields too (previously only `create()` /
  `upsert()` did), so bulk inserts also draw from the persistent sequence.
  Field parsing now honors either the spec-canonical `autonumberFormat` key OR
  the `format` shorthand (both appear in metadata).

- **`@objectstack/objectql`** — when the driver advertises native autonumber
  support, the engine NO LONGER pre-fills (it defers entirely to the persistent
  driver sequence as the single source of truth). For drivers without native
  support (memory, mongodb) the in-memory fallback is unchanged. The fallback
  also now reads either `autonumberFormat` or `format`. Record-validation
  exempts `autonumber` fields from the `required` check — the value is
  runtime-owned and assigned after validation, so a required record number is
  never rejected as "missing".

No metadata changes required. Existing data is respected: the driver bootstraps
each sequence from the current max numeric tail on first use.
