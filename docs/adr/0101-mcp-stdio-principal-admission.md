# ADR-0101: MCP stdio Principal Admission — env-supplied API-key identity, fail-closed, no system bypass

**Status**: Proposed (2026-07-19)
**Deciders**: ObjectStack Protocol Architects
**Builds on**: [ADR-0096](./0096-execution-surface-identity-admission.md) (execution-surface identity admission — this ADR closes its last unadmitted transport), [ADR-0024](./0024-mcp-connectors.md) §4 (trust model), [ADR-0036](./0036-app-as-rest-api-and-mcp-server.md) (the app *as* an MCP server — the surface being admitted), [ADR-0099](./0099-posture-adjudicated-tiering-and-external-rung.md) (posture rides the `ExecutionContext` this ADR threads)
**Composes with**: framework#3055 (consume-side declarative stdio **spawn** policy — the sibling trust decision: #3055 gates *who may start* a local MCP process from metadata; this ADR gates *as whom* our own stdio server reads data), [ADR-0097](./0097-declarative-connector-instances.md)
**Tracking**: framework#3246 (v1 implementation) · framework#3167 (parent decision issue — deferred this) · PR #3217 / #3228 (PR-B, landed: switch split + HTTP e2e proof)
**Consumers**: `@objectstack/mcp` (`MCPServerPlugin.start()`, `bridgeResources`), `@objectstack/core` (`resolveApiKeyPrincipal` / `resolveAuthzContext` — the shared verify chain), `@objectstack/qa` dogfood (`mcp-stdio-authority` matrix row)

---

## TL;DR

The long-lived MCP **stdio** transport bridges the RAW metadata service + data
engine with **no per-request principal** — a stdio-attached client reads
metadata and records with full, unscoped authority (no RLS / FLS / tenant).
The `mcp-stdio-authority` conformance row records this as `experimental` with
an explicit ADMISSION REQUIREMENT before stdio can ever be promoted or served
beyond a single-operator local tool.

Three decisions close it:

1. **D1 — stdio's identity is an env-supplied API key.** `OS_MCP_STDIO_API_KEY=osk_...`
   is resolved through the **one shared verify chain** (`@objectstack/core`
   `resolveApiKeyPrincipal` → `resolveAuthzContext`, the same path the HTTP
   dispatcher and REST use), yielding the `ExecutionContext` every stdio data
   read runs under. Re-resolved **per call**, so revocation applies to a live
   session.
2. **D2 — fail-closed.** stdio auto-start without a valid key **refuses to
   start** (loud configuration fault). The HTTP surface is unaffected.
3. **D3 — there is NO `system` bypass mode.** Full authority is obtained the
   same way any authority is: provision an identity (platform admin, or better
   a dedicated service identity) and mint a key for it. A supplied credential —
   never a mode that skips identity.

## Context

Two transports, two postures — pinned by ADR-0096's matrix (rows added in
PR #3202, #3167 PR-A):

- **HTTP `/api/v1/mcp`** — `enforced`: `handleMcp` denies anonymous (401),
  OAuth scopes narrow tool families, `buildMcpBridge(context)` threads the
  caller `ExecutionContext` into every data op. End-to-end proven
  (`showcase-mcp-http-identity.dogfood.test.ts`, PR #3228).
- **stdio** — `experimental`: `MCPServerPlugin.start()` bridges resources onto
  the long-lived server from the raw services. The `record_by_id` resource
  calls `dataEngine.findOne(...)` with **no context** — RLS/FLS/tenant never
  run. Opt-in only (`OS_MCP_STDIO_ENABLED` / `autoStart`, split from the HTTP
  switch in PR #3217 precisely because the shared switch silently attached
  this unscoped transport).

Today's posture is *bounded*: stdio is opt-in, local, single-operator — whoever
can attach stdio already owns the process and its dev database. This ADR is
not an incident response; it is the hardening that must precede any promotion
(default-on, multi-user, hosted) and the removal of the platform's last
identity-less execution path.

### Why the transport itself stays credential-less (and that is correct)

The MCP specification splits the problem into two layers:

- **Transport auth (client ↔ server)**: HTTP transports SHOULD implement the
  MCP Authorization spec; **stdio SHOULD NOT** — the server is a child process
  of the client, and transport trust is inherited from local process execution.
  We comply: no OAuth handshake is added to stdio.
- **Backend identity (server ↔ data)**: the spec's guidance is that stdio
  servers take credentials **from the environment** and act with *that
  credential's* authority. This is exactly how the ecosystem's backend-shaped
  servers behave: a Postgres MCP server connects with the supplied role's
  grants (superuser only if you supplied superuser); the GitHub MCP server acts
  as the PAT's user with the PAT's scopes. Anthropic's own agent-identity model
  is the same shape — agents run under **admin-provisioned, scoped, revocable
  service identities**, never an identity-less full-authority mode.

ObjectStack's stdio today is *weaker than all of these*: it demands no
credential and grants full authority. The native ObjectStack analogue of
`POSTGRES_PASSWORD` / `GITHUB_TOKEN` is an **`osk_` API key**. Use it.

## Decisions

### D1 — `OS_MCP_STDIO_API_KEY` is the stdio principal, resolved via the shared chain

At `MCPServerPlugin.start()` (stdio auto-start path only):

- Read `OS_MCP_STDIO_API_KEY`. Resolve it through
  `resolveApiKeyPrincipal(ql, { 'x-api-key': key })` →
  `resolveAuthzContext(...)` in `@objectstack/core` — the **same** verify +
  context chain the HTTP dispatcher and REST `/data` use (`@objectstack/mcp`
  already depends on `core`; no new auth surface is invented).
- Build the `ExecutionContext` mirroring the runtime's
  `resolve-execution-context` mapping (userId, tenantId, permissions →
  posture per ADR-0099), and thread it into a **principal-bound resource
  bridge**: `record_by_id` and every other data-touching resource goes through
  the engine **with `{ context }`** — never the raw `dataEngine`.
- **Per-call re-resolution**: each resource read re-verifies the key (indexed
  at-rest-hash lookup — cheap). A revoked or expired key takes effect on the
  next call of a *live* stdio session, matching HTTP semantics. No long-lived
  cached authority.

### D2 — Fail-closed on a missing/invalid key

`OS_MCP_STDIO_ENABLED=true` (or `autoStart`) **without** a resolvable key is a
configuration fault: stdio does not start, the error says exactly how to mint
a key (Setup → Connect an Agent, or `POST /api/v1/keys`). The HTTP surface —
default-on, independently admitted — is untouched. Fall-open (start unscoped
anyway) is exactly the ADR-0096 failure class this ADR exists to remove.

### D3 — No `system` bypass (rejected alternative: `OS_MCP_STDIO_IDENTITY=system`)

A configurable "run as system" mode was considered as a local-dev escape hatch
and **rejected**. Against the native alternative — mint a key for a
platform-admin or dedicated service identity — it is strictly worse:

| | admin/service `osk_` key | `OS_MCP_STDIO_IDENTITY=system` |
|---|---|---|
| Audit | attributable to a real identity/key | synthetic `system`, attributable to no one |
| Revocation | revoke the key, access ends | no credential to revoke; edit config + restart |
| Rotation / expiry | supported (`sys_api_key`) | none |
| Scope | that identity's grants, under posture rules (ADR-0099) | `isSystem` skips *everything*, incl. the tenant wall |
| Nature | a supplied credential (industry shape) | an RLS bypass switch |

The deeper reason: "run as superuser" in the Postgres analogy means *you
supplied a superuser credential* — it does not mean *the server offers a mode
that skips authentication and disables RLS*. No mainstream backend MCP server
ships the latter. And `OS_MCP_SERVER_ENABLED=true` silently attaching an
unscoped transport was the footgun PR #3217 just closed; a blessed
`IDENTITY=system` env var recreates it with a nicer name. Naming a fall-open
does not make it not a fall-open.

Full authority remains available — by provisioning it: mint a key for a
platform-admin identity, or (better, matching the agent-identity pattern) a
dedicated service identity with exactly the grants the agent needs.

## Consequences

- **`mcp-stdio-authority` graduates** `experimental` → `enforced` when #3246
  lands: the surface admits a declared principal, fail-closed. The
  `bridgeResources(metadataService, dataEngine)` probe key goes STALE by
  design — the re-classification this forces in CI *is* the change.
- **Bootstrap friction, accepted**: a fresh database needs a minted key before
  stdio can start (log in once, mint). Same class as "create a role before
  connecting to Postgres". The common dev loop is unaffected — the HTTP
  surface (OAuth as the dev admin, principal-bound, default-on) already covers
  "point a coding agent at the running app", and `os dev` prints exactly that.
- **v2 conveniences (tracked in #3246, not blocking)**: `os dev` may auto-mint
  and print a local, scoped, revocable dev key from the seeded dev-admin — a
  credential, not a bypass — and named service identities / restricted
  permission sets + rotation guidance address the static-token failure mode.
- **One identity model across transports**: HTTP = per-request caller
  credential; stdio = per-process env credential; both resolve through the
  same chain to the same `ExecutionContext` shape. Every future transport
  inherits the rule: *no principal, no data*.
