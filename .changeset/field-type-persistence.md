---
"@objectstack/driver-sql": minor
"@objectstack/objectql": patch
---

fix: array-valued field types persist, and `Field.time` accepts time-of-day — two field-type runtime gaps found driving the showcase field-zoo (which had no seed data, so neither was ever exercised).

**Array/object fields broke every write (driver-sql).** `multiselect` / `checkboxes` / `tags` / `repeater` / `vector` were absent from the SQL driver's JSON-field classification, so their array values reached the better-sqlite3 binder un-serialized and threw *"SQLite3 can only bind numbers, strings, bigints, buffers, and null"* — a 500 on insert/update for common field types (even `task.labels` on a normal object). The DDL column-type switch and `isJsonField` had drifted into two separate lists; they now share one `JSON_COLUMN_TYPES` source that includes the array/object types, so these columns are created as JSON and round-trip as arrays/objects. A `formatInput` safety net additionally serializes any stray array/object value so an unclassified field degrades to a stored string instead of crashing.

**`Field.time` rejected every valid value (objectql).** The validator reused the date/datetime branch (`Date.parse`), which is `NaN` for any bare time string — so a `time` field could never accept `14:30` or `09:05:30`. `time` now validates a time-of-day (`HH:MM` / `HH:MM:SS`, optional fractional seconds and `Z`/offset) and still accepts a full ISO datetime; `date`/`datetime` are unchanged.

Verified live on app-showcase: the full field-zoo specimen (all input-able field types) now persists and round-trips. Regression tests added for both.
