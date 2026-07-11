---
"@objectstack/plugin-auth": minor
---

feat(auth/i18n): localised, tenant-customisable phone SMS texts (#2815)

The OTP and invitation SMS bodies were hard-coded English. They now resolve
in two layers: a `sys_notification_template` row for
`(auth.phone_otp | auth.phone_invite, channel 'sms', locale)` — editable in
Setup, seeded once with built-in en/zh rows, tenant edits never overwritten —
falling back to the bundled bilingual texts. The locale follows the
deployment default (`localization.locale` setting, live-rebound); per-user
locale is deferred until `sys_user` grows a locale column. The OTP wording
is purpose-neutral (one provider template covers sign-in and reset, and the
SMS reveals nothing about what the code unlocks). Template lookups are
best-effort — an outage never blocks an OTP send — and the no-OTP-in-logs
red line is unchanged.
