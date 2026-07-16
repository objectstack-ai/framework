---
'@objectstack/spec': patch
---

docs(security): document that `requireAuth` denies anonymous across ALL HTTP surfaces (#2567)

The `api.requireAuth` schema description and JSDoc said the anonymous-deny
posture applied to REST `/data/*` only. Post-#2567 the same value is threaded to
every entry point that reaches object data — REST `/data`, the metadata
endpoints (`/meta`), the dispatcher GraphQL endpoint (`/graphql`), and the
raw-hono standard `/data` routes — sharing one decision (`shouldDenyAnonymous`).
The description now reflects the uniform, by-surface posture and the single
opt-out (`requireAuth: false`). Doc-only; no behavior change.

(Accompanying hand-written docs — `permissions/authorization.mdx` and the
regenerated `references/api/rest-server.mdx` — are updated to match.)
