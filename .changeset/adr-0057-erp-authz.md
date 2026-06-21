---
"@objectstack/platform-objects": major
"@objectstack/plugin-sharing": major
"@objectstack/spec": minor
"@objectstack/plugin-security": minor
"@objectstack/runtime": minor
"@objectstack/objectql": minor
"@objectstack/plugin-approvals": patch
---

**BREAKING:** the system object `sys_department` is renamed to `sys_business_unit`
— object + member table (`sys_department_member` → `sys_business_unit_member`),
fields, and i18n — with **no compatibility alias**. Any deployment holding
`sys_department` rows, or metadata that references the object by name (lookups,
list views, queries, sharing/approval scopes), must migrate to `sys_business_unit`.
A renamed shipped system object is a breaking change to the platform's public
data surface, so this lands as a **major**. Verified per ADR-0059's pre-publish
hotcrm gate: no published downstream consumer references the old name.

ADR-0057 — ERP authorization core. Adds permission-grant access DEPTH
(`own`/`own_and_reports`/`unit`/`unit_and_below`/`org`), renames `sys_department`
→ `sys_business_unit` (no aliases — see BREAKING above), introduces the platform-owned
`sys_user_role` assignment, and seeds stack-declared `roles`/`sharingRules` into
`sys_role`/`sys_sharing_rule` at boot (closes #2077). Hierarchy-relative scopes are
delegated to a pluggable `IHierarchyScopeResolver` (open edition fails closed to
owner-only; `defineStack` errors without `requires: ['hierarchy-security']`). Also
fixes a latent over-grant where `engine.find({ filter })` was ignored (driver reads
`where`) — normalized `filter`→`where` in the engine.
