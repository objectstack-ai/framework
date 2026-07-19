---
'@objectstack/mcp': minor
---

feat(mcp)!: stdio transport requires an API-key principal — fail-closed, no unscoped bridge (ADR-0101, #3246)

The long-lived MCP **stdio** transport no longer reads data unscoped. It now runs
under an env-supplied identity, closing the platform's last identity-less
execution surface (the `mcp-stdio-authority` conformance row graduates
`experimental` → `enforced`).

- `OS_MCP_STDIO_API_KEY=osk_...` supplies the stdio identity, resolved through
  the SAME `@objectstack/core` verify + authorization chain as the HTTP/REST
  surfaces; the `record_by_id` resource reads via `ql.find(obj, { where:{id},
  context })`, so RLS/FLS/tenant apply exactly as on REST `/data`. Re-resolved
  per read, so a revoked/expired key stops working on a live session.
- **Fail-closed** — enabling stdio auto-start (`OS_MCP_STDIO_ENABLED=true` /
  `autoStart`) without a resolvable key throws and refuses to start. There is no
  unscoped fallback and deliberately no `system` bypass; full authority is a key
  minted on a platform-admin or dedicated service identity.

**BREAKING (stdio auto-start only):** previously `OS_MCP_STDIO_ENABLED=true`
(or the plugin `autoStart` option) started stdio with full, unscoped authority
and no credential. It now requires `OS_MCP_STDIO_API_KEY`; without it, boot
fails closed. The default-on HTTP surface and any deployment that never enables
stdio auto-start are unaffected.
