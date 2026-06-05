---
'@objectstack/rest': patch
---

fix(rest): map schema-mismatch & not-null driver errors to structured 4xx

`mapDataError` collapsed any SQL-looking driver error into a generic
`500 DATABASE_ERROR`, so a bad write payload to the data API leaked a 500
instead of a fixable 4xx (e.g. `POST /data/sys_team` with an unknown field,
or omitting a required column). It now maps unknown-column errors to
`400 INVALID_FIELD { field }` and not-null violations to
`400 VALIDATION_FAILED { fields:[{required}] }` across SQLite/Postgres/MySQL
phrasings, placed before the unknown-object branch so Postgres
`column … of relation … does not exist` is not mis-mapped to 404. Genuine
driver faults still return 500; unique violations still return 409.
