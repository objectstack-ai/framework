---
"@objectstack/plugin-audit": patch
"@objectstack/service-storage": patch
"@objectstack/runtime": patch
---

feat(i18n): localize collaboration notification titles and the storage objects; wire the notifications REST routes

Three gaps behind one report (a `sys_file "repro.png" assigned to you`
notification that was English on an all-Chinese workspace, opened an English
detail page, and never cleared its unread state):

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

- **runtime** — the in-app notifications REST surface (`GET
  /api/v1/notifications`, `POST /api/v1/notifications/read`, `POST
  /api/v1/notifications/read/all`; ADR-0030) had its `handleNotification`
  dispatch branch and discovery entry, but no `server.<verb>()` mount in
  `dispatcher-plugin`, so only the cloud hosts' hono catch-all reached it — the
  standalone / `os dev` server 404'd every request. That left mark-read with no
  working endpoint (the console's direct `sys_notification_receipt` write is
  rejected by ADR-0103's engine-owned gate), so unread notifications could never
  clear. The three routes are now mounted explicitly, guarded by the
  route-registration regression test.
