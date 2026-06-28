---
"@objectstack/plugin-auth": minor
"@objectstack/platform-objects": minor
---

feat(auth): opt-in SSO domain verification (ADR-0024 ②)

Add DNS-TXT domain-ownership verification for external SSO providers, gated
behind a new `OS_SSO_DOMAIN_VERIFICATION` flag (off by default — today's
register→login behavior is unchanged). When enabled, `@better-auth/sso` mounts
`/sso/request-domain-verification` + `/sso/verify-domain` and enforces that a
provider's email domain be DNS-verified before it may complete a login.

- `auth-manager.ts`: new `ssoDomainVerification` enabled-flag (readBooleanEnv) →
  passes `domainVerification: { enabled: true }` to `sso()`; public
  `isSsoDomainVerificationEnabled()` helper.
- `register-sso-provider.ts`: `runRequestDomainVerification` /
  `runVerifyDomain` bridges — re-dispatch through the gated better-auth
  endpoints and reshape the response into the `{ success, data }` envelope the
  `sys_sso_provider` action `resultDialog` reads (request → ready-to-paste DNS
  TXT record; verify → clear success/error). A bare 404 from the inner endpoint
  is surfaced as "not enabled for this environment".
- `auth-plugin.ts`: mount the two bridges as rawApp routes
  (`/admin/sso/{request-domain-verification,verify-domain}`).
- `sys_sso_provider`: `domain_verified` field + list column + the two actions;
  `domainVerified` documented in `AUTH_SSO_PROVIDER_SCHEMA`.
