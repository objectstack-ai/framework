---
'@objectstack/mcp': minor
'@objectstack/runtime': minor
---

feat(mcp): Streamable HTTP transport — every app is a network-reachable MCP server (ADR-0036 Phase 2)

The MCP server plugin spoke **stdio only**, so a remote agent (Claude Desktop /
Cursor) could not connect to a hosted env. This adds the **Streamable HTTP**
transport and wires it into the runtime's request path, building on the Phase 1a
`sys_api_key` auth foundation.

- **`@objectstack/mcp`** (renamed from `@objectstack/plugin-mcp-server` — see the rename changeset)
  - `MCPServerRuntime.handleHttpRequest(request, { bridge, parsedBody })` —
    serves one MCP request over the Web-standard `WebStandardStreamableHTTPServerTransport`
    (runs on Node 18+, Workers, Deno, Bun). **Stateless**: a fresh, isolated
    `McpServer` + transport is built per request (the SDK-recommended pattern),
    in JSON-response mode so the response is fully buffered — no streaming
    pass-through concerns over the Worker→container hop.
  - New `registerObjectTools` + `McpDataBridge` (`mcp-http-tools.ts`): the
    object-CRUD tool set (`list_objects`, `describe_object`, `query_records`,
    `get_record`, `create_record`, `update_record`, `delete_record`). All
    execution is delegated to an injected, **principal-bound** bridge — the tool
    layer never touches the data engine directly. System (`sys_*`) objects are
    **not exposed** by default (fail-closed guard on every object-scoped tool).
    The internal AI/authoring toolRegistry is deliberately NOT bridged onto the
    external surface.

- **`@objectstack/runtime`**
  - `HttpDispatcher` serves `/mcp`: **opt-in** via `OS_MCP_SERVER_ENABLED=true`
    (404 when off, so the surface isn't advertised); **fail-closed auth**
    (anonymous → 401 — requires the principal resolved by Phase 1a's API-key
    path or a session). It builds an `McpDataBridge` that runs every operation
    through the existing `callData` path bound to the request's
    `ExecutionContext`, so external agents run under the key's permissions + RLS,
    never a parallel or escalated path. The discovery endpoint advertises `mcp`
    only when enabled.

Security: every external MCP entry runs as the scoped `sys_api_key` principal
under existing object permissions + RLS; MCP is opt-in per env; no raw keys or
secrets cross the wire. Fully unit-tested (transport handshake/tools, gate,
auth, principal binding).
