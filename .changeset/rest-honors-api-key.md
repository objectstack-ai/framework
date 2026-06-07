---
'@objectstack/core': minor
'@objectstack/rest': patch
'@objectstack/runtime': patch
---

fix(rest): REST data API honors sys_api_key — one shared verifier with MCP (closes #1633)

Staging e2e found the MCP surface authenticated a `sys_api_key` but the REST data
API (`@objectstack/rest`) returned 401 for the same key — its `resolveExecCtx`
only checked the better-auth session, never the API key.

Converged both surfaces onto ONE verifier so they can't drift:

- **`@objectstack/core/security`** now owns the shared `sys_api_key` primitives
  (`hashApiKey`, `generateApiKey`, `extractApiKey`, `parseScopes`, `isExpired`)
  plus a new `resolveApiKeyPrincipal(ql, headers, nowMs?)` that hashes the
  inbound key, looks it up by the indexed at-rest hash, and rejects unknown /
  revoked / expired / owner-less keys (fail-closed). `core` is the natural home:
  both `rest` and `runtime` depend on it, it depends on neither (no cycle), and
  it's server-side (already uses `node:crypto`).
- **`@objectstack/runtime`** — `security/api-key.ts` re-exports the primitives
  from core (stable import surface) and `resolveExecutionContext` now delegates
  its API-key branch to `resolveApiKeyPrincipal`.
- **`@objectstack/rest`** — `resolveExecCtx` resolves the data engine once and
  tries `resolveApiKeyPrincipal` (x-api-key / `Authorization: ApiKey`) BEFORE the
  session, so `/api/v1/data` + `/api/v1/meta` now authenticate an API key under
  the key's permissions + RLS, exactly like the dispatcher/MCP path.

Tests: core `api-key.test.ts` (primitives + verifier: valid / revoked / expired /
unknown / owner-less / plaintext-not-matched / fail-closed-ql). runtime + rest
suites green.
