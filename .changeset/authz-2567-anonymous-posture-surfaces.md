---
'@objectstack/runtime': minor
'@objectstack/plugin-hono-server': minor
---

fix(security): enforce the anonymous-deny posture uniformly across HTTP surfaces (#2567)

The ADR-0056 D2 `requireAuth` flip made REST `/data/*` deny-anonymous by
default, but three sibling surfaces reached ObjectQL without passing through the
gate — so the platform's anonymous posture was **inconsistent by surface**: an
anonymous caller denied on `/data` could read the same object data through a
different door. This closes the remaining two gaps (the `/meta` gate had already
landed) and pins every surface with a conformance row.

- **Dispatcher GraphQL** (`runtime/http-dispatcher.ts`, `dispatcher-plugin.ts`):
  `POST /graphql` reached `kernel.graphql`, whose security middleware falls
  **open** for an anonymous context. `handleGraphQL` now applies the same
  `requireAuth` gate as `/data` and `/meta`, resolving identity for the direct
  route that does not flow through `dispatch()`. The dispatcher's `requireAuth`
  default is aligned with the REST plugin's (`?? true`) so a bare host no longer
  denies anonymous `/data` while serving the same rows over `/graphql`; an
  explicit `requireAuth: false` opt-out is honoured and logs a boot warning.

- **Raw-hono standard `/data` routes** (`plugin-hono-server/hono-plugin.ts`):
  these delegate straight to ObjectQL and were only *shadowed* when the REST
  plugin registered the same paths first — so secure-by-default depended on
  plugin registration order. Each route now consults `requireAuth` (secure by
  default, mirroring `rest-server.ts`), making the deny decision a property of
  this entry point too. Order no longer affects the anonymous posture.

**Behaviour change:** on a `requireAuth` deployment (the secure default),
anonymous `POST /graphql` and anonymous raw-hono `/data` now return 401.
Deployments that intentionally serve these surfaces publicly set
`requireAuth: false` (a boot warning is logged). Proven end-to-end on the
platform default in `showcase-anonymous-deny-surfaces.dogfood.test.ts`, with
handler-level regression coverage in `http-dispatcher.requireauth.test.ts` and
`hono-anonymous-deny.test.ts`, and pinned by three new authz-conformance rows.
