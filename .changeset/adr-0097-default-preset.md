---
'create-objectstack': minor
---

feat(create-objectstack): scaffold ships the three generic connector executors (#3056)

The blank template's `plugins:` now includes `new ConnectorRestPlugin()`,
`new ConnectorOpenApiPlugin()`, and `new ConnectorMcpPlugin()` (zero-arg =
provider factory only, no hand-wired connector), so a scaffolded app can
declare provider-bound `connectors:` entries (ADR-0097) — `provider: 'rest' |
'openapi' | 'mcp'` — as pure metadata and have them materialize into live,
dispatchable connectors at boot, with no plugin-wiring step. The template
README documents the default providers, the `credentialRef` rule, and the
#3055 `declarativeStdio` opt-in (declarative stdio transports stay denied by
default). Remove unwanted executors by deleting a line from `plugins:`.
