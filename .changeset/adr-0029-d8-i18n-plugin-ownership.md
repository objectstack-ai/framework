---
"@objectstack/platform-objects": patch
"@objectstack/plugin-webhooks": patch
"@objectstack/plugin-approvals": patch
"@objectstack/plugin-security": patch
"@objectstack/plugin-sharing": patch
---

ADR-0029 D8 — migrate i18n ownership for the moved domains to their plugins.

The object translations for the domains decomposed in K2.a/K2.b/K2 previously
lived in the `@objectstack/platform-objects` generated bundles even though the
objects now live in their capability plugins. This moves each domain's i18n
extraction + bundles to the owning plugin, preserving every hand-translated
string (zh-CN / ja-JP / es-ES):

- Each plugin gains a build-time `scripts/i18n-extract.config.ts` and a
  `src/translations/` bundle (`{locale}.objects.generated.ts` + an `index.ts`
  barrel), generated with `os i18n extract` and self-baselined so re-runs
  preserve translations.
- Each plugin loads its bundle at runtime on `kernel:ready` via
  `i18n.loadTranslations` (the i18n service is optional — load is best-effort).
  - `plugin-webhooks` ← `sys_webhook`, `sys_webhook_delivery`
  - `plugin-approvals` ← `sys_approval_request`, `sys_approval_action`
  - `plugin-security` ← `sys_role`, `sys_permission_set`,
    `sys_user_permission_set`, `sys_role_permission_set`
  - `plugin-sharing` ← `sys_record_share`, `sys_sharing_rule`, `sys_share_link`
- `@objectstack/platform-objects` translation bundles are regenerated to drop
  those objects' keys (its extract config already excluded them); all other
  objects' translations and the metadata-form bundles are preserved.

Net runtime effect is unchanged (same translations load, now contributed by the
package that owns each object) — closing the D8 follow-up tracked since K2.a.
