---
'@objectstack/plugin-auth': patch
'@objectstack/platform-objects': patch
---

Auth: make the open-source SSO-provider registration form produce a usable IdP (ADR-0024 / cloud#551)

The `sys_sso_provider` `register_sso_provider` UI action posted FLAT form fields to `@better-auth/sso`'s `/sso/register`, which expects the OIDC fields NESTED under `oidcConfig`. The top-level `clientId`/`clientSecret` were Zod-stripped, so the form persisted an `oidc_config = null` provider that could never complete a login ("Invalid SSO provider").

- **plugin-auth**: new shared `runRegisterSsoProviderFromForm` helper reshapes the flat form body into the nested shape and re-dispatches it through the real `/sso/register` (so the admin gate, the public-routable `trustedOrigins` allowance, discovery hydration, and secret handling all still run). Exposed via a new `/admin/sso/register` bridge route on the host `AuthPlugin`. (The cloud per-env runtime mounts the same helper in its `AuthProxyPlugin` — mirrors `set-initial-password`.)
- **platform-objects**: `register_sso_provider` retargets to `/api/v1/auth/admin/sso/register` and gains `discoveryEndpoint`, `scopes`, and attribute-mapping (`mapId`/`mapEmail`/`mapName`) fields. Open mechanism — keeps runtime IdP registration self-service in the OSS edition.

Verified E2E: an admin registers an external OIDC IdP from the flat form → a member logs in through it (JIT-provisioned, `sys_account.provider_id` set); a non-admin is rejected (403) before discovery runs.
