---
"@objectstack/spec": minor
"@objectstack/plugin-security": minor
"@objectstack/runtime": minor
"@objectstack/lint": minor
---

feat(spec,plugin-security): package-level capability declaration API (ADR-0066 D1)

Packages can now DEFINE their own authorization capabilities explicitly via the
new `defineCapability` factory and a stack's `capabilities` array, instead of
relying on the implicit "derive an untitled capability from whatever a permission
set references in `systemPermissions[]`" back-door.

- `@objectstack/spec`: new `defineCapability` / `CapabilityDeclarationSchema`
  (`{ name, label?, description?, scope, packageId? }`) and a `capabilities`
  field on the stack definition.
- `@objectstack/plugin-security`: new `bootstrapDeclaredCapabilities` seeds
  declared capabilities into `sys_capability` with `managed_by:'package'` +
  `package_id` provenance (new `package_id` field on the object). Idempotent,
  upgrade-aware; refuses to hijack curated platform capabilities or another
  package's rows, never clobbers admin-authored rows, and CLAIMS a pre-existing
  derived placeholder (upgrading it to package provenance). The implicit
  derive-from-`systemPermissions` path still runs for back-compat but now skips
  any explicitly-declared name so it can't clobber authored metadata.
- `@objectstack/runtime`: stack-declared `capabilities` are registered into the
  metadata registry (type `capability`) so the boot seeder can read them.
- `@objectstack/lint`: `validateCapabilityReferences` treats
  `stack.capabilities` names as a known capability source.

A capability is not a contract: DEFINE it (`defineCapability`), GRANT it
(`systemPermissions`), REQUIRE it (`requiredPermissions`) — no `inputs`.
Aligns with ADR-0094 D5 (retire implicit `managed_by`-guessing back-doors).
