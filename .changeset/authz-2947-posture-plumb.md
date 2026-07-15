---
'@objectstack/spec': minor
'@objectstack/runtime': patch
'@objectstack/rest': patch
---

fix(authz): carry the derived posture rung on ExecutionContext (#2947)

The ADR-0095 D2 posture ladder (`PLATFORM_ADMIN > TENANT_ADMIN > MEMBER >
EXTERNAL`) is derived once by the shared authz resolver from capability grants,
but both HTTP/MCP entry points that build the `ExecutionContext` dropped it —
so any enforcement-side reader of `context.posture` always saw `undefined`
(the same drop that forced the explain layer to re-derive it, #2949).

`ExecutionContextSchema` now carries an optional `posture` field, and both
`rest-server` and the runtime `resolveExecutionContext` plumb the resolver's
value through. Additive and **behavior-preserving**: no enforcement decision
consumes `posture` yet — whether the hot path evaluates *by* posture remains a
larger ADR-level decision — this only stops the already-computed value from
being discarded, so enforcement and explain read the same derived rung.
