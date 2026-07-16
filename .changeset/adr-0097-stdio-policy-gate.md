---
'@objectstack/connector-mcp': minor
---

feat(connector-mcp)!: policy-gate declarative stdio transports — default-deny + host allowlist (#3055)

A declarative `provider: 'mcp'` entry with a stdio transport spawns a local
child process **from metadata** — which a runtime Studio publish can introduce.
Declarative stdio is now **denied by default**; hosts opt in deliberately:

```ts
new ConnectorMcpPlugin({ declarativeStdio: ['my-mcp-server'] }) // command allowlist
new ConnectorMcpPlugin({ declarativeStdio: true })              // allow any (full trust)
```

Behavior change: a declarative stdio instance that materialized before now
fails as a **configuration fault** (fatal at boot / skipped on reload) with an
actionable opt-in message, and is never classified upstream-unavailable — a
security rejection must not be retried into existence. `http` transports and
**hand-wired** connectors (plugin instance options / `createMcpConnector`) are
unaffected. This is the security precondition for shipping `connector-mcp` in
default presets (#3056); see ADR-0097 §"Declarative stdio policy" and
ADR-0024 §4.
