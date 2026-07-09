---
'@objectstack/types': minor
'@objectstack/runtime': minor
'@objectstack/rest': minor
'@objectstack/cli': minor
'@objectstack/mcp': minor
'@objectstack/plugin-auth': minor
---

feat(mcp): the MCP surface is now **default-on** — a core platform capability (#2698)

`/api/v1/mcp` is served (and advertised in `/discovery`) out of the box; the
OAuth 2.1 authorization track and Dynamic Client Registration follow it, so a
fresh deployment is connectable by any MCP client with zero configuration.
Operators opt OUT with `OS_MCP_SERVER_ENABLED=false`.

- New single decision point `isMcpServerEnabled()` in `@objectstack/types`
  (default on; explicit `false`/`0`/`off`/`no` disables). The runtime
  dispatcher's `/mcp` route gate, the CLI's MCP plugin auto-load, the REST
  `/discovery` advertisement, and the auth service's OAuth/DCR follow-defaults
  all delegate to it — the served route, the advertised route, and the
  authorization track can never disagree.
- The env var is now effectively tri-state: unset → HTTP surface on;
  explicit `true` → additionally auto-start the long-lived **stdio** transport
  at boot (unchanged, still opt-in — a default must not claim the process's
  stdin/stdout); explicit `false` → everything off, fail-closed (404, no
  metadata, no DCR).
- The OAuth 2.1 TLS rule is unaffected: on a plain-HTTP non-loopback origin
  the OAuth track stays dark and the default-on surface remains API-key-only.
