---
'@objectstack/plugin-node-server': minor
---

feat(transport): second `IHttpServer` adapter on raw node:http — multi-adapter validation (ADR-0076 D11/OQ#10, #2462)

New package `@objectstack/plugin-node-server`: a thin, zero-dependency
`node:http` implementation of the transport port (`IHttpServer`), plus a
cross-adapter conformance suite that boots the dispatcher bridge and the
REST route generator on BOTH this adapter and `plugin-hono-server` and
asserts identical behavior over real sockets (full `/data` CRUD roundtrip,
`:param` routing, 404/405 semantics, SSE streaming, discovery).

This resolves ADR-0076 OQ#10: the port is proven free of hard Hono-isms —
all remaining Hono coupling is confined to the feature-detected
`getRawApp()` escape hatch. Production deployments should keep using
`plugin-hono-server`; this adapter targets the conformance suite and
minimal embedding scenarios.
