---
"@objectstack/plugin-auth": patch
---

fix(auth): guarantee an absolute https origin for every user-facing auth URL

Follow-up to the invitation-link fix. Several other user-facing links were
built from the raw `config.baseUrl` with no scheme guarantee, so a bare-host
`baseUrl` (e.g. `cloud.objectos.ai`) produced relative-looking, unclickable
links. All now flow through the hardened `getCanonicalOrigin()` (prepends
`https://` when the scheme is missing, trims a trailing slash):

- better-auth `baseURL` — the reset-password, verify-email and magic-link
  email links are derived from it.
- OAuth `loginPage` / `consentPage` redirect targets.
- Device-authorization `verificationUri`.
- The phone-invite SMS `{{baseUrl}}`.

Deployments that already configure an absolute `baseUrl` are unaffected.
