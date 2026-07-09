---
'@objectstack/spec': minor
'@objectstack/plugin-auth': minor
'@objectstack/runtime': minor
'@objectstack/mcp': minor
---

feat(mcp): spec-compliant OAuth 2.1 authorization for `/api/v1/mcp` (#2698)

Any OAuth-capable MCP client (claude.ai custom connectors, Claude Desktop,
Claude Code) can now connect to a deployment **self-serve**: no admin-minted
API key, no central registry — you sign in through the browser as yourself and
every tool call runs under your own permissions and row-level security.

**Each deployment is its own authorization server**, backed by the embedded
better-auth instance (`@better-auth/oauth-provider`). Rationale for the design
decisions lives in #2698; the moving parts:

- **Discovery**: `/.well-known/oauth-protected-resource` (RFC 9728, incl. the
  path-inserted variant for `/api/v1/mcp`) and
  `/.well-known/oauth-authorization-server` (RFC 8414, incl. the path-inserted
  variant for the `/api/v1/auth` issuer) are served from the deployment origin.
  401s from `/api/v1/mcp` advertise the resource metadata via
  `WWW-Authenticate`, so clients bootstrap the flow automatically.
- **Dynamic Client Registration (RFC 7591)** is enabled (unauthenticated, as
  the MCP spec requires) whenever the MCP surface is on — every deployment is a
  distinct AS, so clients cannot ship pre-registered IDs. Force it either way
  with `OS_OIDC_DCR_ENABLED` or the new `plugins.dynamicClientRegistration`
  auth-config field. The embedded AS itself now auto-enables when
  `OS_MCP_SERVER_ENABLED=true` (explicit `OS_OIDC_PROVIDER_ENABLED=false` still
  wins).
- **Authorization-code + PKCE** flow with RFC 8707 resource binding: access
  tokens are minted with `aud=<origin>/api/v1/mcp` and verified locally
  (signature/issuer/audience/expiry) against the deployment's own JWKS —
  fail-closed parity with API keys: unknown/expired/wrong-audience tokens,
  sub-less M2M tokens, or a presented-but-invalid bearer never fall back to an
  ambient session, they 401.
- **Token → ExecutionContext**: a valid access token resolves to the same
  principal-bound `ExecutionContext` as every other credential, single-sourced
  through `resolveAuthzContext` — OAuth adds a second *provenance* for the
  principal, not a second authz model. `ExecutionContext` gains an optional
  `oauthScopes` field carrying the token's granted scopes.
- **Coarse scopes → tool families**, enforced at tool dispatch: `data:read`
  (list/describe/query/get), `data:write` (create/update/delete),
  `actions:execute` (list_actions/run_action). Constants live in
  `@objectstack/spec/ai` (`MCP_OAUTH_SCOPES`). Tools outside the grant are not
  registered — and therefore rejected — for that request. API-key and session
  principals are unaffected (not scope-limited).
- **TLS required, localhost exempt** (OAuth 2.1): on a plain-HTTP non-loopback
  origin the OAuth track stays dark (no metadata, no bearer acceptance) and the
  endpoint remains API-key-only. Local clients reach intranet deployments;
  claude.ai web connectors additionally need public HTTPS reachability.

**API keys are unchanged** (dual-track): `x-api-key` / `Authorization: ApiKey` /
`Authorization: Bearer osk_…` keep working exactly as before for CI and
headless agents — covered by new regression tests.
