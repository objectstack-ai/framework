---
"@objectstack/plugin-auth": patch
---

fix(auth): invitation accept link is now an absolute URL under the Console base

`sendInvitationEmail` built the accept URL straight from `config.baseUrl` with
no scheme guarantee and no UI mount prefix — `${baseUrl}/accept-invitation/<id>`.
Two problems surfaced in real deployments:

1. When `baseUrl` was a bare host (e.g. `cloud.objectos.ai`, no scheme), the
   emailed link was relative-looking; email clients would not linkify it and
   clicking it went nowhere.
2. The accept-invitation page is a Console SPA route mounted under `uiBasePath`
   (default `/_console`) — the same router/basename as `/login`, `/register`
   and `/oauth/consent`, and the exact link the Console itself generates for its
   "copy invitation link" action (`${origin}${BASE_URL}accept-invitation/<id>`).
   The root-path link omitted that prefix, so it 404'd at the host root instead
   of resolving to the page.

The link is now built as
`${origin}${uiBasePath}/accept-invitation/<id>` via a hardened
`getCanonicalOrigin()` that guarantees an absolute origin (prepends `https://`
when `baseUrl` has no scheme). The scheme hardening also applies to the OAuth
issuer / consent / device-flow URLs that share the helper. Deployments that
mount the Console elsewhere are honoured through the existing `uiBasePath`
config.
