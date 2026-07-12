---
'@objectstack/plugin-sharing': minor
'@objectstack/spec': minor
---

**Security fix (#2851): the share-link HTTP routes no longer trust spoofable identity headers, and the service enforces ownership.**

The raw-app share-link routes (`POST/GET/DELETE /api/v1/share-links`, registered by `SharingServicePlugin`) derived the caller from `x-user-id` / `x-tenant-id` request headers, and the service ignored the caller context on revoke. So a client could forge link attribution, enumerate another user's link tokens (`GET ?createdBy=<victim>` → tokens that resolve records under a system context, bypassing RLS), and revoke arbitrary users' links.

Fixes:

- **Verified identity.** `SharingServicePlugin` now derives the caller (and their positions/permissions) from the platform's verified resolution (`resolveAuthzContext` — session / API key / OAuth), never from headers. The route default is SECURE (anonymous). Create / list / revoke require a signed-in principal (401 otherwise); the public `/:token/resolve` route stays public (the token is the authorization) but keys its `audience: 'signed_in'` check off the verified session rather than a spoofable `x-user-id`.
- **List scoping.** `GET /api/v1/share-links` is forced to the caller's own links — a client can no longer pass `?createdBy=<victim>` to enumerate others' tokens.
- **Revoke ownership.** `revokeLink` now requires the caller to be the link's creator (system/internal callers bypass). Previously the caller context was ignored, so anyone could revoke any link (sharing DoS).
- **Create access check.** `createLink` verifies the record is visible to the caller (read under the caller's own RLS) before minting a link — you can only share a record you can actually see. Internal (system) callers are unchanged.

`ShareLinkExecutionContext` gains optional `positions` / `permissions` so the record-access check evaluates the real principal.

Found by an adversarial security review of the request→ExecutionContext trust boundary (companion to the settings-routes fix, #2848).
