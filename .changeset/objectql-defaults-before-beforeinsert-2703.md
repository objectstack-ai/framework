---
'@objectstack/objectql': patch
---

fix(data): resolve field `defaultValue`s BEFORE the `beforeInsert` hook (#2703)

Declarative field defaults (including the `current_user` token) were resolved
by `applyFieldDefaults` *after* the user `beforeInsert` hook ran. A hook that
DERIVED one field from another therefore read a stale `null` for any field that
was about to be defaulted — e.g. `sales_person: Field.user({ defaultValue:
'current_user' })` left `sales_person == null` inside the hook, so a derived
`current_status` computed to `unassigned` unless the client passed the field
explicitly.

`applyFieldDefaults` now runs at record-initialization time, before
`beforeInsert`, matching the industry-standard order of execution (Salesforce
field defaults / ServiceNow dictionary defaults are populated before before-
triggers; engine-owned generation — autonumber sequences, encryption, timestamps
— stays after the hook). The hook still has final say: it runs after and may
override any defaulted field. Defaults still only fill fields left `undefined`,
so client-supplied values are untouched, and the caller's input object is no
longer mutated in place.

Behavior note: a `beforeInsert` hook can no longer distinguish "client omitted
field X" from "field X received its default" for fields that declare a
`defaultValue` — the hook now always sees the resolved default. This matches how
Salesforce/ServiceNow behave (before logic sees a fully-initialized record) and
is the intended fix.
