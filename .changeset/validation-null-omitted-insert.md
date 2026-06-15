---
"@objectstack/objectql": patch
---

fix(objectql): `record.<field> == null` validation fires on insert when the field is omitted (#1871)

A `script` / `cross_field` validation predicate like `record.due_date == null`
did not fire on **insert** when the optional field was omitted entirely from the
payload — the CEL `record` scope lacked the key, so `record.x == null` saw a
missing key (not null) and silently couldn't match. It worked on update (the
prior record supplies the field) and when the field was explicitly `null`.

Fix: on insert, default declared-but-absent schema fields to `null` in the rule
evaluation scope, so an omitted optional reads as `null` — matching an explicit
`null` and the update path.
