---
"@objectstack/driver-sql": patch
---

fix(driver-sql): round-trip rating/slider/toggle/progress with type fidelity

`rating`/`slider`/`toggle`/`progress` had no case in the DDL column-type switch, so they fell to `default → table.string` (TEXT affinity). SQLite then coerced the written value to a string — `rating: 4` read back `'4'`, `toggle: true` read back `'1'` — so the value persisted but the JS type leaked on read. On a low-code platform where field types are author-driven, a field that silently returns the wrong type is a runtime-fidelity trap the static gates and value-loss tests don't catch.

- `rating`/`slider`/`progress` now map to a REAL (numeric) column.
- `toggle` maps to a boolean column and is registered in the boolean read-coercion path, so stored `1`/`0` come back as real JS booleans.
- The object-valued `record`/`video`/`audio` types are folded into the shared `JSON_COLUMN_TYPES` source, and the DDL `default` case now derives JSON-vs-string from that set, so the column-type switch and `isJsonField` (the read-side deserializer) can no longer drift.
