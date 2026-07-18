---
'@objectstack/types': minor
'@objectstack/mcp': minor
'@objectstack/cli': minor
'create-objectstack': patch
---

feat(mcp): decouple the stdio auto-start switch from the HTTP surface + surface the MCP endpoint on `os dev` boot (#3167)

The MCP HTTP surface (`/api/v1/mcp`) and the long-lived stdio transport used to
share one env var: `OS_MCP_SERVER_ENABLED=true` turned the HTTP surface on **and**
silently auto-started the stdio transport — which bridges the raw metadata service
+ data engine with no per-request principal (unscoped). An operator setting it to
"make sure MCP is on" got an unscoped transport as a side effect.

- **`@objectstack/types`** — new `resolveMcpStdioAutoStart()`. Stdio auto-start is
  now its own switch, `OS_MCP_STDIO_ENABLED` (default off); `OS_MCP_SERVER_ENABLED`
  governs only the HTTP surface. The legacy `OS_MCP_SERVER_ENABLED=true` trigger
  still starts stdio for one release, flagged as deprecated. `=false` is unchanged
  (it only ever gated HTTP).
- **`@objectstack/mcp`** — `MCPServerPlugin.start()` gates stdio on the new switch
  and logs a one-time deprecation warning when started via the legacy alias.
- **`@objectstack/cli`** — `os dev` now prints the MCP endpoint, the agent-skill
  URL, and a ready-to-paste `claude mcp add` command on boot (gated on the HTTP
  surface being on), so the "an agent operates the app it's building" loop is
  discoverable at dev time.
- **`create-objectstack`** — the blank scaffold README documents that the app is
  itself an MCP server (the serve side), distinct from the consume-side connector.
