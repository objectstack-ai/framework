---
'@objectstack/core': minor
'@objectstack/runtime': patch
'@objectstack/rest': patch
'@objectstack/plugin-hono-server': patch
---

refactor(security): converge the anonymous-deny decision into one shared function + a source-enumerating ratchet (#2567 Phase 2)

Phase 1 gated every HTTP surface (REST `/data`, dispatcher `/graphql` + `/meta`,
raw-hono `/data`) against the secure-by-default `requireAuth` posture, but each
seam hand-rolled the same `!userId && !isSystem → 401` check. Phase 2 removes
that duplication and pins the surfaces so a new ungated entry point fails CI.

- **New `shouldDenyAnonymous` in `@objectstack/core`** (`security/anonymous-deny.ts`)
  — the single anonymous-deny decision + shared 401 body/constants, mirroring the
  `auth-gate.ts` pattern (pure function so the seams can never drift). All five
  seams — REST `enforceAuth`, dispatcher `handleGraphQL` / `handleMetadata` /
  `handleAI`, hono `denyAnonymous` — now delegate to it. **Pure refactor: no
  runtime behavior change** (verified by the unchanged Phase-1 handler + e2e
  proofs). Identity resolution and the dynamic exemptions (public-form grants,
  share-link tokens) are untouched — they run upstream and only ever hand the
  seam an already-resolved context.
- **A `discover()` ratchet on the authz-conformance matrix** — it statically
  enumerates the data/meta/graphql HTTP entry points from source (curated
  per-file probes, control-plane routes excluded) and asserts each is classified
  by a matrix `covers` key. A new `/data`/`/meta`/`/graphql` route (or a
  removed/stale `covers`) now fails CI as UNCLASSIFIED / STALE, not in review. A
  companion negative test proves the ratchet bites.

A design trap is guarded: `isAuthGateAllowlisted(undefined)` returns `true`, so a
body-routed seam (GraphQL, which has no request path) must pass no path — the
shared function's non-empty-path guard denies anonymous unconditionally there,
never falling through to the control-plane allowlist.
