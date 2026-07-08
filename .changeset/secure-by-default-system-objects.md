---
'@objectstack/platform-objects': minor
---

Secure-by-default posture for sensitive system objects (ADR-0066 ④, system-object
slice) — the platform's raw secret/credential stores no longer ride the wildcard
`'*'` permission grant.

`sys_secret` (encrypted settings/datasource secrets), `sys_jwks` (JWT signing
keys), `sys_verification` (password-reset / verify tokens),
`sys_oauth_access_token`, `sys_oauth_refresh_token` (live bearer credentials),
and `sys_device_code` (pending device-grant codes) now declare
`access: { default: 'private' }`: an ordinary member's generic data-layer
read/write gets 403 instead of being covered by `member_default`'s
`'*': allowRead`. Platform admins retain access via the posture-gated
`viewAllRecords`/`modifyAllRecords` superuser bypass, and every runtime consumer
is unaffected — better-auth reads via its adapter (system context),
`engine.resolveSecret` reads at driver level, and SettingsService / the
datasource secret-binder read principal-less (middleware falls open for internal
calls).

`sys_scim_provider` (SCIM bearer-token config) gains the object-level
`requiredPermissions: ['manage_platform_settings']` capability gate, mirroring
its sibling `sys_sso_provider`. The Setup nav item for Signing Keys (JWKS) is
now capability-gated like API Keys, so non-admins don't see a menu entry that
can only 403.

Member self-service objects (`sys_session`, `sys_api_key`,
`sys_oauth_application`, `sys_two_factor`) deliberately keep the public posture —
the Account app ("My Sessions" / "My API Keys" / "My Apps" / 2FA "My
Enrollment") reads them through the generic data layer as the member; row
scoping remains their guard. The declarations are pinned by
`platform-objects.test.ts` and the ADR-0056 D10 conformance-matrix row
`secure-by-default-posture`, so dropping the flag from a secret store fails CI.
