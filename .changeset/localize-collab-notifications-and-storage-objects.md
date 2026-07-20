---
"@objectstack/plugin-audit": patch
"@objectstack/service-storage": patch
---

feat(i18n): localize collaboration notification titles and the storage objects

Two gaps left the notification surface English-only on localized workspaces
(observed as `sys_file "repro.png" assigned to you` over an all-Chinese UI):

- **plugin-audit** — the assignment (`collab.assignment`) and @mention
  (`collab.mention`) bell titles were hardcoded English literals built from the
  raw object API name. They now resolve through the i18n service with the same
  key shapes as the activity summaries (framework#3039): new
  `messages.assignedToYou` / `messages.mentionedYou` /
  `messages.mentionedYouAnonymous` templates (en / zh-CN / ja-JP / es-ES), the
  object named by its translated label (`objects.{name}.label` → authored def
  label → API name), and the locale resolved for the **recipient** (they read
  the bell), not the acting user. Every step stays best-effort: no locale / no
  i18n / key miss degrades to the English literal — which now also prefers the
  authored object label over the API name.

- **service-storage** — `sys_file` / `sys_upload_session` had no translation
  bundle at all, so the file detail page (labels, and the Pending Upload /
  Committed / Deleted status pipeline) rendered English on every locale. The
  service now ships its own ADR-0029 D8 bundle (en / zh-CN / ja-JP / es-ES,
  `src/translations` + `scripts/i18n-extract.config.ts`) and contributes it via
  `i18n.loadTranslations` on `kernel:ready`, matching service-messaging.
  (`sys_attachment` stays in platform-objects' bundles pending the
  storage-domain decomposition.)
