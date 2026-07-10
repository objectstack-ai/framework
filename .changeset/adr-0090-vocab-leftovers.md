---
"@objectstack/spec": minor
"@objectstack/plugin-sharing": patch
"@objectstack/example-showcase": minor
---

ADR-0090 vocabulary leftovers (#2722, #2723, #2724) — the last "role"/"profile"
surfaces are renamed one-step, no aliases (launch-window discipline).

**`PortalSchema.profiles` → `positions`** (#2723, D2 removal miss). FROM → TO:
`profiles: ['client_portal_user']` → `positions: ['client_portal_user']` —
portal admission is now position-scoped; use the built-in `guest` position
for anonymous-only portals. The removed `profiles` key is a loud tombstone:
authoring it fails with the prescription instead of silently stripping. The
showcase Client Portal is migrated and now admits a real declared position
(`client_portal_user`).

**`RLSUserContextSchema.role` → `positions`** (#2722, D3 rename miss). FROM →
TO: `role: string | string[]` → `positions: string[]` — matches the runtime
shape the RLS compiler resolves as `current_user.positions`. No runtime
consumer read the old field (the compiler has its own context type); public
export names are unchanged.

**`sys_record_share.recipient_type` `'role'` → `'position'`** (#2724, D3).
The record-share enum and the `ShareRecipientType` contract type now match
the already-migrated spec zod enum. No stored-data migration is required:
no reader expands non-`user` record-share rows (rules materialize per-user
grants), so legacy `'role'` rows were inert. The plugin-sharing translation
bundles are regenerated — fixing the pre-stale `sys_sharing_rule` options
block too — with zh-CN/ja-JP labels patched per the generated-file contract
(业务单元及下级 / ビジネスユニットと下位階層).
