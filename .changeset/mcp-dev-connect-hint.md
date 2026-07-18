---
'@objectstack/cli': patch
---

feat(cli): surface the MCP endpoint in the server-ready banner (#3167)

The MCP server (`/api/v1/mcp`) is a default-on core capability, but nothing in
the `os dev` / `os serve` boot output pointed to it — a developer had to already
know it was there to connect an AI client. The server-ready banner now prints
the MCP URL and the `SKILL.md` pointer whenever the surface is enabled
(`isMcpServerEnabled()`, the same switch that auto-loads the plugin and gates
the route), so an agent can operate the running app straight from the dev loop.
Hidden when `OS_MCP_SERVER_ENABLED=false`.
