---
'@objectstack/objectql': patch
---

fix(security): enforce `readonlyWhen` on the multi-row UPDATE path (#3042)

Conditional `readonlyWhen` field locks were stripped only on the single-id
UPDATE path; the bulk `update({ multi: true, where })` path enforced static
`readonly` (#2948) but never `readonlyWhen`. A programmatic/embedded caller (or
a plugin) issuing a multi-row update in a user context could therefore write a
field its own `readonlyWhen` predicate should have locked — the conditional
lock held for a `PATCH /data/:object/:id` but not for a bulk where-predicate
update. (The external REST/SDK `updateMany` endpoint was unaffected: it loops
single-id `engine.update` calls, which already strip `readonlyWhen`.)

`engine.update` now, on the multi-row path and only when the payload actually
writes a `readonlyWhen` field, reads the row-scoped match set with the same
composed AST the write binds (one query) and drops any field whose predicate is
TRUE for at least one matched row — a single bulk payload cannot keep a field
for some rows and drop it for others, so a field locked in any target row is
fail-safe-dropped for the batch (narrow the `where` to reach the rows where it
is unlocked). A conditional field NO matched row locks is written normally, so a
legitimate bulk edit is unaffected. Symmetric with the single-id
`stripReadonlyWhenFields` and with the static-`readonly` bulk strip; INSERT
stays exempt. No change for any single-id update or any object without
`readonlyWhen` fields.
