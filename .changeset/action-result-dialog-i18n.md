---
"@objectstack/spec": minor
"@objectstack/cli": patch
"@objectstack/platform-objects": patch
---

feat(i18n): translation slot for action `resultDialog` copy — the one-shot secret-reveal dialogs are now localizable

The post-success `resultDialog` (temporary passwords, 2FA backup codes, OAuth
client secrets) had no slot in the translation protocol, so its title /
description / acknowledge button / field labels always rendered the hardcoded
English metadata literals even on fully-translated locales.

- **spec.** `_actions.<action>` (object + object-first node) and
  `globalActions.<action>` gain an optional `resultDialog` translation node
  (`ActionResultDialogTranslationSchema`): `title`, `description`,
  `acknowledge`, and `fields` keyed by the **literal** result-field path
  (e.g. `"user.email"` — keys may contain dots; resolvers index the record
  directly, never split on `.`). New `resolveActionResultDialog` overlay
  resolver, wired into `translateAction` for API-boundary translation.
- **cli.** `os i18n extract` emits the new `resultDialog.*` keys (title /
  description / acknowledge / `fields.<path>` for labelled fields), so
  coverage and skeleton generation see them.
- **platform-objects.** en / zh-CN / ja-JP / es-ES bundles ship the
  resultDialog copy for all six shipped dialogs: `sys_user.create_user`,
  `sys_user.set_user_password`, `sys_two_factor.enable_two_factor`,
  `sys_two_factor.regenerate_backup_codes`,
  `sys_oauth_application.create_oauth_application`, and
  `sys_oauth_application.rotate_client_secret`.

Client-side rendering lands in objectui (`actionResultDialog` resolver in
`@object-ui/i18n` + result-dialog handlers). Purely additive — untranslated
locales keep falling back to the metadata literals.
