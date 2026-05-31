---
"@objectstack/spec": patch
"@objectstack/rest": patch
"@objectstack/platform-objects": patch
"@objectstack/service-settings": patch
---

Fix system-metadata translations: locale fallback, app/dashboard localization, and coverage gaps.

Switching the UI language left many surfaces in English. Three root causes
are addressed:

- **Locale fallback (server).** The metadata translation resolver
  (`@objectstack/spec` `i18n-resolver`) now resolves a requested locale
  against the locales actually present in the bundle (exact →
  case-insensitive → base-language → variant), so a request for `zh`
  correctly hits the `zh-CN` bundle instead of falling back to English.
  This mirrors `resolveLocale` in `@objectstack/core` and benefits every
  resolver (objects, views, actions, settings, metadata forms).

- **App & dashboard localization (server).** Added `translateApp` and
  `translateDashboard` resolvers and wired `app`/`dashboard` into the REST
  `/meta` translation path. App labels, sidebar/navigation group labels,
  and dashboard titles/widgets were previously never localized at the API
  boundary even though the translation data existed.

- **Coverage & quality (data).** Added translations for the previously
  untranslated platform objects `sys_share_link`, `sys_view_definition`,
  and `sys_metadata_audit` (and registered them in the i18n-extract config
  so future extractions keep them). Replaced English placeholder strings
  left in the `zh-CN` / `ja-JP` / `es-ES` object and metadata-form bundles
  (notably action `confirmText` / `successMessage` prompts). Added the
  missing `es-ES` built-in Settings bundle in `@objectstack/service-settings`.
