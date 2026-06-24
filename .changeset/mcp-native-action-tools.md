---
'@objectstack/mcp': minor
'@objectstack/runtime': minor
---

Native MCP business-action execution (`list_actions` / `run_action`)

The open-source MCP server now natively exposes the app's **business actions**, so a self-host / Community-Edition runtime (open framework + `@objectstack/mcp`, no cloud studio) can *operate* an app over MCP — not just CRUD records. Previously action execution rode on `@objectstack/service-ai`'s tool registry, which is empty in a headless CE runtime after the in-UI `ask` agent moved to the cloud package.

- **`@objectstack/mcp`**: new `registerActionTools()` registering two native tools alongside the object-CRUD tools, plus a `McpActionBridge` seam (`McpActionSummary`, `RegisterActionToolsOptions`):
  - `list_actions` — enumerate the invokable business actions the caller may run (permission- + visibility-filtered, system-object actions held back fail-closed).
  - `run_action` — invoke an action by name with `recordId` / `params`.
  - Wired into `handleHttpRequest` by capability: only registered when the runtime bridge can resolve the action mechanism (graceful degradation). No dependency on `@objectstack/service-ai`.
- **`@objectstack/runtime`**: the principal-bound MCP bridge (`buildMcpBridge`) now resolves + dispatches actions through the framework's own mechanism — `IDataEngine.executeAction` (script/body) / automation flow runner (flow) — bound to the caller's `ExecutionContext`, the same permission + RLS path the REST `/actions/...` route uses. The ADR-0066 D4 `requiredPermissions` capability gate is now single-sourced and enforced for both surfaces.
