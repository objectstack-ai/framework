---
'@objectstack/driver-sql': patch
---

Fix: present `Field.time` as a wall-clock time-of-day on read (SQLite)

`Field.time` is a tz-naive time-of-day, not an instant (#2004). A
`defaultValue: 'NOW()'` time column historically took the full SQLite
`CURRENT_TIMESTAMP` default, so a defaulted/legacy row read back a full
`'YYYY-MM-DD HH:MM:SS'` timestamp instead of a time-of-day.

`formatOutput` now repairs a `Field.time` value to just its time portion
(`toTimeOnly`): a legacy full timestamp — or a full ISO value that leaked into
the column — is sliced to `HH:MM[:SS[.fff]]`, while a value already stored as a
bare time-of-day is left untouched. This is a deliberately NARROW, read-only
normalization with no write/filter counterpart, so it introduces no write/read
asymmetry and preserves exact round-trips for bare time-of-day values (e.g. the
field-zoo `f_time` guard). Runs for every dialect (a native TIME column already
returns a time-of-day, so it is a no-op there).

Completes the temporal-field read normalization alongside #2346: `datetime`
folds to a canonical ISO-8601-`Z` instant, `date` to `YYYY-MM-DD`, and `time` to
a wall-clock time-of-day.
