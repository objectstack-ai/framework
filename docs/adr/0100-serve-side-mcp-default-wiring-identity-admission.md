# ADR-0100: Default wiring for the serve-side MCP server — identity admission is the gate, not the dev/prod default

**Status**: Proposed (2026-07-18)
**Deciders**: ObjectStack Protocol Architects
**Builds on**: [ADR-0096](./0096-execution-surface-identity-admission.md) (execution-surface identity admission — the D4 conformance matrix + meta-test this ADR registers MCP with), [ADR-0090](./0090-permission-model-v2-concept-convergence.md) (D10 agent ceiling∩user intersection — the agent posture MCP runs OAuth callers under), [ADR-0097](./0097-declarative-connector-instances.md) / framework#2977 / framework#3056 (the CONSUME side — ObjectStack calling external MCP servers; this ADR is its serve-side counterpart), [ADR-0024](./0024-mcp-connectors.md) §4 (trust model)
**Composes with**: [ADR-0099](./0099-posture-adjudicated-tiering-and-external-rung.md) — 0096/0099 split admission (may this call reach the engine, as whom) from tiering (which rows each layer grants). This ADR is a pure *admission* application: it registers one more execution surface (MCP tool-execution) with the 0096 matrix.
**Tracking**: framework#3167 (this decision issue); framework#2698 (the default-on MCP HTTP surface + OAuth admission this ADR ratifies); ADR-0096 Evidence E1 (the stdio `bridgeResources` context-less read this ADR classifies)

---

## TL;DR

The premise of #3167 — "the `MCPServerPlugin` is wired nowhere by default" — is **stale against current `main`**. As of the #2698-era work, the serve-side MCP server is already a **default-on core capability**: `isMcpServerEnabled()` defaults ON (`packages/types/src/env.ts`), the CLI pushes the `mcp` capability into `os serve` / `os dev` unless opted out (`packages/cli/src/commands/serve.ts`), and the dispatcher route gate consults the same single decision point. So "an endpoint that answers but a capability never registered" no longer describes `main` — the plugin **is** registered by the same env decision that serves the route.

What is genuinely missing is exactly what #3167 names as decision #1 and calls the gate: **the MCP tool-execution surface is not registered in the ADR-0096 D4 authz conformance matrix.** MCP appears in that matrix only incidentally (the readonly-strip row names the MCP create ingress); there is **no row that pins _whose_ `ExecutionContext` runs a `tools/call`, and no source probe that fails CI if that answer regresses.** ADR-0096's own Evidence table asserts "REST/MCP object CRUD — caller's `ExecutionContext`, threaded — by design," but that is prose, not a CHECKED artifact.

This ADR therefore:

1. **Pins the identity answer (D1)** and lands it as ADR-0096 D4 conformance rows + source probes (this PR), so the answer is a red-CI-on-regression property, not a comment.
2. **Reframes the dev/prod question (D2)**: the safety asymmetry #3167 worries about is delivered by the **fail-closed identity gate + the off-switch**, not by a dev-vs-prod default flip. The single `isMcpServerEnabled()` decision point stays; `OS_MCP_SERVER_ENABLED=false` is the deliberate prod-off lever (and gates both plugin registration and the route).
3. **Keeps the default surface HTTP-only (D3)**: stdio auto-start stays explicit opt-in — `os dev` owns the process, and the stdio resource path still carries the ADR-0096 E1 context-less read (now classified, with a tripwire, so it cannot silently ride onto a networked transport).
4. **Bounds default exposure (D4)** to what already ships: a fixed generic tool set over `apiEnabled` objects (`sys_*` fail-closed), business actions only when the author sets `ai.exposed`, OAuth scopes narrowing tool families. Metadata-declared per-surface exposure is the future story.

Nothing in #3167 "proceeds before" the identity gate — and the gate is the only part that was actually missing, so it is the only new runtime-facing artifact this ADR lands.

---

## Context — the verified current state (against `main`)

### The wiring is already default-on (the #3167 premise is stale)

| Concern | #3167's stated state | Verified on `main` |
|:---|:---|:---|
| HTTP surface `/api/v1/mcp` | default-ON (correct) | default-ON — `handleMcp` in `runtime/http-dispatcher.ts`, gated by `isMcpEnabled()` → `isMcpServerEnabled()` |
| `MCPServerPlugin` registration | "wired nowhere by default" | **default-ON** — `cli/src/commands/serve.ts`: `if (isMcpServerEnabled() && !requires.includes('mcp')) requires.push('mcp')`, resolved via `CAPABILITY_PROVIDERS.mcp` → `kernel.use(new MCPServerPlugin())`. `os dev` inherits it (it spawns `os serve --dev`). |
| off-switch | `OS_MCP_SERVER_ENABLED=false` disables the HTTP surface | disables **both** the route gate **and** the capability push (same helper), so the plugin is not registered either |
| stdio transport | optional via `autoStart`/`=true` | unchanged — `MCPServerPlugin.start()` connects stdio only under `autoStart` or `OS_MCP_SERVER_ENABLED==='true'` (strict); the dispatcher never networks stdio |

The single decision point is `isMcpServerEnabled()` (`packages/types/src/env.ts`): unset ⇒ ON; `false`/`0`/`off`/`no` ⇒ OFF; `true` ⇒ ON **and** stdio auto-starts. Every consumer (route gate, CLI capability push, REST `/discovery` advertisement, auth OAuth/DCR follow-default, the Connect-an-Agent UI) reads that one helper.

### Whose `ExecutionContext` runs a `tools/call` today (the answer #3167 D1 asks for)

On the **HTTP surface** (the only networked one), the answer is already correct and fail-closed — it is just unregistered:

- **Fail-closed admission.** `handleMcp` (`runtime/http-dispatcher.ts`) rejects any request whose resolved context lacks a real principal — `if (!ec || (!ec.userId && !ec.isSystem)) → 401`. A **guest** context (which the resolver will happily produce) has no `userId`, so it never reaches a tool. There is **no dev-admin fallback and no fall-open** on this surface.
- **Principal provenance** (`runtime/src/security/resolve-execution-context.ts`, `acceptOAuthAccessToken` true only on `/mcp`): an `osk_` API key → its **owning user**; a better-auth session → the **logged-in human**; an OAuth 2.1 access token → an **agent principal on behalf of** the human `sub`, whose reach is the **scope-derived ceiling ∩ the user's own grants** (ADR-0090 D10 — confused-deputy prevention). A JWT-shaped bearer that fails to verify resolves hard-anonymous (no cookie fallback) → 401.
- **Tool execution runs AS that principal.** `buildMcpBridge` binds every object-CRUD / query / aggregate call to the request `ec` via `callData(..., ec)` — the exact RLS/FLS/permission path REST `/data` uses; an agent can never exceed the credential's authority. OAuth callers are further narrowed by a scope → tool-family gate (#2698: no MCP scope ⇒ 403 `insufficient_scope`).
- **Business actions** are gated at invoke time by `ai.exposed` (author opt-in, #2849) + the ADR-0066 D4 capability gate + record load under the caller's RLS; the handler body then runs **trusted** by design (per #2964's `buildActionEngineFacade`) — the same posture actions already carry everywhere.

In dev, that principal is the seeded `admin@objectos.ai` platform admin (`plugin-auth` `maybeSeedDevAdmin`, hard-gated to `NODE_ENV==='development'`), authenticated by its session or an API key it mints — **not** an implicit dev bypass; `handleMcp`'s `userId || isSystem` gate holds even under single-tenant `requireAuth:false`.

### The one real fall-open — stdio resources (ADR-0096 E1)

The **persistent** `MCPServerRuntime` (the object that carries `bridgeResources`/`bridgeTools`/`bridgePrompts`) is only reachable over **stdio**. Its `record_by_id` resource template calls `dataEngine.findOne(objectName, { where: { id } })` with **no `ExecutionContext`** (`mcp/src/mcp-server-runtime.ts`) → the plugin-security empty-principal skip = full-authority cross-tenant read. This is ADR-0096's E1 evidence. It is **not** reachable on the default HTTP surface (which builds a fresh per-request `McpServer` with only the principal-bound object/action tools), and stdio is opt-in — but it is a genuine context-less read that must not silently ride onto any future networked transport.

---

## Decisions

### D1 — Identity admission: caller-principal posture, registered as a CHECKED artifact (the gate)

**The answer.** MCP tool execution runs under the **caller's principal** (ADR-0073 posture: `user`), resolved from the request credential, fail-closed to 401 when absent. Object CRUD is RLS/FLS/permission-bounded as that principal; OAuth callers run as `agent` on-behalf-of the human at the ADR-0090 D10 ceiling∩user intersection; actions are `ai.exposed` + capability gated with trusted bodies.

**The gate.** That answer is registered in the ADR-0096 D4 authz conformance matrix (`packages/qa/dogfood/test/authz-conformance.matrix.ts`) as an **enforced** row, with source **probes** (`authz-conformance.test.ts`) that pin (a) the fail-closed identity gate and (b) the `buildMcpBridge` context threading. Dropping either makes a `covers` key STALE → red CI. This is what turns "REST/MCP CRUD is caller-scoped by design" from ADR-0096 prose into a checked property — and it is the precondition #3167 says everything else waits on. **This PR lands it.**

**The stdio fall-open (E1)** is registered honestly in the same matrix as an **experimental** row (posture `system`, trusted-local, opt-in) with a probe on the context-less `dataEngine.findOne(` so it is classified rather than silent. It is **not** patched with an ad-hoc `{ isSystem: true }` literal — ADR-0096 D2 retires those, and the D2 `systemContext(reason)` constructor does not exist yet. The **admission requirement** before stdio is ever networked or default-wired: thread the caller/session `ExecutionContext` (or an explicit D2 grant) into the resource reads. Until then the tripwire keeps it from leaking onto a transport unreviewed.

### D2 — The dev/prod boundary: identity + off-switch, not a default flip

#3167 proposed "dev default-on, prod explicit." Given the verified state, that split is **superseded**: MCP already ships default-on in both, and the safety asymmetry #3167 rightly cares about is delivered by **D1's fail-closed identity gate** (a principal-less caller gets nothing) plus a clean **off-switch** — `OS_MCP_SERVER_ENABLED=false` is the *deliberate* prod-off choice, and it gates plugin registration and the route together.

**Recommended (this ADR):** keep the single `isMcpServerEnabled()` decision point; wiring follows that env answer uniformly in dev and prod. The "deliberate choice in prod" is expressed by setting the off-switch, not by a code-level dev/prod fork — one decision point, no drift between the route gate and the plugin loader.

**Amendment option (for ratification):** if the maintainers want prod to be opt-*in* rather than opt-*out*, make `isMcpServerEnabled()`'s **default** `NODE_ENV`-aware (ON in dev, OFF otherwise) — the single helper, so every consumer stays consistent. This is a one-line default change behind the same seam; it is a behavior change for existing default-on deployments and should be a conscious ratification, which is why it is called out separately rather than assumed.

Either way, **D1 is unchanged and is the actual gate** — the dev/prod default is a policy dial on an already-fail-closed surface, not the thing that makes it safe.

### D3 — Transport & mount: HTTP-only default; stdio stays explicit

The default surface is the **per-request HTTP** transport. Stdio auto-start remains explicit opt-in (`autoStart` / `OS_MCP_SERVER_ENABLED=true`): `os dev` owns the process, spawning a second stdio MCP server under it is redundant, and the stdio path still carries the E1 context-less resource read (D1). **No stdio in the dev default.**

Dev-boot affordance (low-risk DX, recommended follow-up, not required by the gate): print the resolved MCP URL + a connect hint on `os dev` boot — the `connect-ui` Setup page and the public `GET /api/v1/mcp/skill` download already exist; surfacing the URL at boot completes the "point your coding agent at the app you're building" loop the dispatcher's skill/connect pieces were built for.

### D4 — Default exposure scope: what already ships, bounded

The default tool surface is a **fixed generic set** — `list_objects`, `describe_object`, `query_records`, `aggregate_records`, `get_record`, `create_record`, `update_record`, `delete_record`, plus `list_actions` / `run_action` — **not** one CRUD tool per object (which would explode the list and the misuse surface). Exposure is bounded by, in layers: `sys_*` objects fail-closed (unless `allowSystemObjects`); the `apiEnabled` / `apiMethods` object gate enforced at execution via `callData` (the same gate REST honors); RLS/FLS by principal; business actions only when the author sets `ai.exposed`; OAuth scopes narrowing tool families at registration.

Future story (ADR-0097 metadata-first, out of scope here): a **metadata-declared per-object / per-action MCP exposure config**, so "what is exposed to AI" is itself an authorable, reviewable artifact rather than derived only from `apiEnabled` + `ai.exposed`.

---

## Optional extension (after the above, separately gated)

With a stable in-repo serve-side endpoint, the showcase's declarative `provider: 'mcp'` connector gains a second demo target: **the platform connecting to itself**. As #3167 notes, this was rejected for boot-ordering (automation `start()` runs before HTTP listens); the #3049 degrade+retry heals the self-connection seconds after boot, but the dogfood gate must not become timing-sensitive. Treat as a separate, carefully-gated follow-up — **not** part of the identity-admission gate.

---

## Consequences

**Positive**
- The "whose identity runs a `tools/call`" question becomes a red-CI-on-regression property (D1), joining GraphQL and realtime in the ADR-0096 D4 matrix — the next refactor that drops the MCP fail-closed gate or the bridge threading gets a failing build with a checklist, not an adversarial-review finding later.
- The stale #3167 premise is corrected in the record: MCP is default-on and fail-closed today; the only missing piece (the matrix registration) is now landed.
- The E1 stdio fall-open stops being silent — it is classified, tripwired, and carries its admission requirement, so it cannot leak onto a networked transport unreviewed.

**Negative / costs**
- Two more conformance rows + three probes to maintain; a formatting refactor near the pinned sites can trip the ratchet (intended — that is a re-review prompt, not a false positive).
- D2 leaves prod default-on (behind the off-switch). Deployments that want MCP off in prod must set `OS_MCP_SERVER_ENABLED=false`; the amendment option exists if the maintainers prefer opt-in.

**Explicitly unchanged**
- The HTTP identity path, the OAuth admission (#2698), the `ai.exposed` + capability action gate, and the trusted-body posture — all already landed; this ADR registers them, it does not alter them.
- ADR-0096 D2/D3/D5 (the `systemContext` constructor, the identity-required signatures, strict mode) — untouched; the stdio row's hardening is deferred onto them.

---

## References
- framework#3167 — this decision issue
- framework#2698 — the default-on MCP HTTP surface + OAuth 2.1 admission (RFC 9728) this ADR ratifies
- ADR-0096 — execution-surface identity admission (the D4 matrix + meta-test); Evidence E1 (`mcp/src/mcp-server-runtime.ts` context-less resource read)
- ADR-0090 D10 — agent ceiling∩user intersection (the OAuth caller posture)
- ADR-0097 / framework#2977 / framework#3056 — the consume-side declarative MCP connector (closed); this ADR is the serve-side counterpart
- `packages/mcp` (`MCPServerPlugin`, `MCPServerRuntime`, `connect-ui`, `skill`), `packages/runtime/src/http-dispatcher.ts` (`handleMcp`, `buildMcpBridge`), `packages/cli/src/commands/serve.ts` (the capability push), `packages/types/src/env.ts` (`isMcpServerEnabled`)
- `packages/qa/dogfood/test/authz-conformance.matrix.ts` + `authz-conformance.test.ts` — the D4 matrix + ratchet this ADR registers MCP with
