---
'@objectstack/plugin-auth': patch
---

Auth: admin-gate self-service SSO provider registration + default-role JIT (ADR-0024 / cloud#551)

`@better-auth/sso`'s `POST /sso/register` only enforces org-admin when `body.organizationId` is supplied — a **global** (org-less) provider passed on nothing but a valid session, so any authenticated env member could register an env-wide external IdP (a JIT-provisioning / login-routing vector). This closed the "registerSSOProvider is admin-only" requirement of ADR-0024's first slice.

- **plugin-auth**: a `before`-hook on `/sso/register` now requires the caller to be a platform admin OR an owner/admin of their active org, regardless of `organizationId`. Fail-closed; unauthenticated requests still fall through to `sessionMiddleware` (→ 401). New helpers `resolveActor()` (hook-order-independent cookie/bearer resolution) and `isOrgOrPlatformAdmin()` (mirrors `customSession`'s role derivation; reads via `withSystemReadContext`).
- **plugin-auth**: `sso()` now receives `organizationProvisioning.defaultRole:'member'` so a first-time federated login lands with an explicit role (over SecurityPlugin's `member_default` baseline).

Additive and fail-closed — no behavior change for legitimate admins. The SSO mechanism stays framework-open (no identity-governance added).
