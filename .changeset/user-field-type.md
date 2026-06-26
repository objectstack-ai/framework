---
'@objectstack/spec': minor
'@objectstack/objectql': minor
'@objectstack/driver-sql': minor
'@objectstack/driver-mongodb': minor
'@objectstack/cli': patch
'@objectstack/plugin-approvals': patch
---

feat: add a first-class `user` field type (person picker)

A new `user` field type — the equivalent of Airtable's Collaborator / Notion's
Person / Salesforce's `Lookup(User)`. Authored as `Field.user({ ... })`; use
`{ multiple: true }` for collaborators/watchers and `{ defaultValue: 'current_user' }`
to auto-fill the acting user on create.

**Why a distinct type rather than telling authors to `Field.lookup('sys_user')`:**
selecting a person is table-stakes, but the value is in *modelling
discoverability* — a "User" entry in the Studio/AI field palette instead of
requiring authors (and AI) to know to reference the internal `sys_user` system
object — plus `current_user` defaults and a user-search picker. Storage and
runtime are unchanged.

**Deliberately NOT a new storage primitive.** `user` is a *semantic
specialization of `lookup`* with the target fixed to `sys_user`: it shares the
exact lookup code path — same FK string column (`multiple` ⇒ JSON), same
`$expand` resolution, same indexing — so referential integrity and fresh display
names come for free, and nothing is re-implemented. An existing
`Field.lookup('sys_user')` is therefore equivalent at the storage layer (zero
data migration to adopt `Field.user`).

Ownership semantics are **unchanged**: the existing `owner_id` convention +
`plugin-security` auto-stamp/RLS still apply. A declarative `owner` flag is a
possible future follow-up; intentionally not added here to avoid a second
field type for what is a system role (rationale: keep the `FieldType` surface
lean — see related ADR-0059 freeze discipline).

Changes: `FieldType` gains `'user'` + `Field.user()` builder; the SQL/Mongo
drivers treat `user` exactly like `lookup`; the engine resolves `$expand` for
`user` fields and honours a new `defaultValue: 'current_user'` token (resolved
app-side from the execution context, mirroring the `NOW()` convention); kanban
group-by and symbolic seed references accept `user`; approvals enrich `user`
references. The public API surface is unchanged (additive enum member).
