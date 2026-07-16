---
'@objectstack/spec': minor
'@objectstack/service-automation': minor
'@objectstack/connector-mcp': minor
---

feat(connectors): degrade + retry declarative instances whose upstream is unreachable (#3017)

ADR-0097 kept every declarative-connector materialization failure fatal at
boot. That is right for configuration faults (unknown provider, invalid
`providerConfig`, unresolvable `credentialRef`, name conflict) but wrong for
*operational* ones: a `provider: 'mcp'` instance must contact its MCP server
(`tools/list`) to materialize, and a transient network blip aborted the whole
app boot.

- **spec**: a provider factory can now throw
  `ConnectorUpstreamUnavailableError` (code `CONNECTOR_UPSTREAM_UNAVAILABLE`,
  structural guard `isConnectorUpstreamUnavailable`) to mark a failure as
  "upstream temporarily unreachable — degrade and retry" instead of fatal.
- **service-automation**: the reconcile degrades such an instance in both boot
  and reload modes: it registers an action-less husk (`state: 'degraded'` +
  `degradedReason` on the `GET /connectors` descriptor) so the instance is
  visible instead of silently missing — or, on a changed-config
  re-materialization, keeps the old connector serving. A `connector_action`
  against a degraded instance fails with the reason and a "retries
  automatically" pointer. Degraded instances retry on an exponential backoff
  (5s → 5min, reset by config edits) and on every `metadata:reloaded`
  reconcile; recovery swaps the husk for the live connector atomically.
  Reconcile runs (boot / reload / retry timer) are now serialized.
- **connector-mcp**: the `mcp` provider classifies connect / `tools/list`
  failures as upstream-unavailable; transport-shape validation stays a plain
  (fatal) throw.

Configuration faults remain loud boot failures — the carve-out is only for the
unavailable marker.
