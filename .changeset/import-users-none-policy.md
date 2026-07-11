---
"@objectstack/plugin-auth": minor
---

feat(auth): `passwordPolicy: 'none'` is the identity import's new default — import provisions identity, not credentials

`POST /api/v1/auth/admin/import-users` now supports (and defaults to)
`passwordPolicy: 'none'`: accounts are created without a credential record
(better-auth's optional-password create), so no password material is
generated, returned, or distributed at all. Users first sign in through a
channel — phone OTP, magic link, or a password-reset link — and the Console's
existing credential-less detection (`hasLocalPassword()` → set-initial-password)
nudges them to set a password afterwards.

The `invite` policy also no longer mints a throwaway password: it creates the
same credential-less account and sends the set-your-password invitation
(better-auth's reset flow creates the credential record on first set).
`temporary` is unchanged and remains the fallback for deployments without
email/SMS infrastructure.

Breaking-ish note: `passwordPolicy` was previously required — requests that
omitted it got a 400. They now succeed with the `none` behavior.
