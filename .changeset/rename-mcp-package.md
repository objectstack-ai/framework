---
'@objectstack/mcp': major
'@objectstack/cli': patch
---

refactor(mcp)!: rename `@objectstack/plugin-mcp-server` → `@objectstack/mcp` (ADR-0036)

The outbound MCP-server package drops the legacy `plugin-` prefix and moves to
the top level (`packages/mcp`), parallel to `@objectstack/rest` — both are "your
app exposed over a protocol". Inbound MCP (consuming external servers) stays
`@objectstack/connector-mcp`.

**Breaking:** the package name changed. Update imports
`@objectstack/plugin-mcp-server` → `@objectstack/mcp`. The exported API
(`MCPServerPlugin`, `MCPServerRuntime`, `registerObjectTools`, `McpDataBridge`,
…) is unchanged. The internal plugin id is now `com.objectstack.mcp`. Pre-launch
clean break — no compatibility shim (only `@objectstack/cli` depended on it
internally).
