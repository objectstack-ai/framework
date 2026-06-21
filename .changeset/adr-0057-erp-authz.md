---
"@objectstack/spec": minor
"@objectstack/plugin-security": minor
"@objectstack/plugin-sharing": minor
"@objectstack/runtime": minor
"@objectstack/platform-objects": minor
"@objectstack/objectql": minor
"@objectstack/plugin-approvals": patch
---

ADR-0057 — ERP authorization core. Adds permission-grant access DEPTH
(`own`/`own_and_reports`/`unit`/`unit_and_below`/`org`), renames `sys_department`
→ `sys_business_unit` (pre-launch, no aliases), introduces the platform-owned
`sys_user_role` assignment, and seeds stack-declared `roles`/`sharingRules` into
`sys_role`/`sys_sharing_rule` at boot (closes #2077). Hierarchy-relative scopes are
delegated to a pluggable `IHierarchyScopeResolver` (open edition fails closed to
owner-only; `defineStack` errors without `requires: ['hierarchy-security']`). Also
fixes a latent over-grant where `engine.find({ filter })` was ignored (driver reads
`where`) — normalized `filter`→`where` in the engine.
