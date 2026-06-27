---
'@objectstack/service-settings': minor
'@objectstack/plugin-auth': minor
---

Auth: password complexity policy (ADR-0069 D1, P1)

Adds `password_require_complexity` (toggle, default off) + `password_min_classes` (1–4, default 3) to the `auth` password-policy settings. A custom validator runs in the better-auth `before` hook on `/sign-up/email`, `/reset-password`, and `/change-password`, rejecting passwords that use fewer than `password_min_classes` of the four character classes (upper / lower / digit / symbol) with `PASSWORD_POLICY_VIOLATION` — better-auth natively enforces only min/max length.

Default-off and additive (no upgrade behavior change); per ADR-0049 the setting ships with its enforcement. No new identity fields. Continues the ADR-0069 P1 password-policy work alongside the HIBP breached-password reject (#2361).
