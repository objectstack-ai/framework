---
'@objectstack/spec': minor
'@objectstack/lint': minor
'@objectstack/plugin-security': patch
'@objectstack/cli': patch
---

Author-time capability-reference lint (ADR-0066 ⑨) — `os validate` / `os lint`
now warn when a `requiredPermissions` names a capability that is registered
nowhere.

`requiredPermissions` (on objects, fields, apps, actions) is a free string, so a
typo like `mange_users` is schema-valid and fails closed at runtime (the caller
is denied) — safe, but silent. The new `validateCapabilityReferences` rule
(`@objectstack/lint`) resolves every reference against the author-time known set
and warns on the unresolved ones:

- built-in platform capabilities — now sourced from a single canonical list in
  `@objectstack/spec` (`security/capabilities.ts`: `PLATFORM_CAPABILITIES` /
  `PLATFORM_CAPABILITY_NAMES`), which `@objectstack/plugin-security`'s
  `bootstrapSystemCapabilities` also seeds from (one source of truth, no drift),
- any capability a permission set in the stack grants via `systemPermissions`
  (granting is what declares it — mirrors the runtime derived-defaults rule), and
- any `sys_capability` row shipped as seed data.

It is a **warning**, not an error: a single package can't see capabilities
declared by other installed packages, and the reference fails closed anyway.
`systemPermissions` itself is never flagged — it is the declaration side, and a
package legitimately introduces new capabilities there. The object case also
understands the per-operation `requiredPermissions` map form (ADR-0066 ⑤) and
points a finding at the exact operation slice.
