# ADR-0102: Sandbox Execution Budget & Engine Variant — CPU-time budget with a wall ceiling; per-invocation sync WASM modules, precompiled

**Status**: Accepted (2026-07-19) — **D1 landed** with Phase 1 (#3295): CPU-time budget + wall ceiling in `QuickJSScriptRunner`, nested-write integration tests now green at the stock 250ms budget. D2 (#3296, drop asyncify) and D3 (#3297, precompile) remain **Proposed**; D3 is explicitly deferrable without weakening D1/D2.
**Deciders**: ObjectStack Protocol Architects
**Builds on**: the #1867 sandbox redesign (deferred-promise host calls + pump loop) — the mechanism that both retired asyncify's only remaining justification (D2) and created the discrete VM-entry points D1 meters. No earlier ADR covers the sandbox runner; prior art is code history (#3232 honor body `timeoutMs`, #3264 test de-flake, #3270 env-overridable defaults).
**Tracking**: framework#3275 (implementation-ready spec) · #3295 / #3296 / #3297 (phases) · #3259 (motivating CI flake, closed by the #3270 stopgap)
**Consumers**: `@objectstack/runtime` (`QuickJSScriptRunner`, the four stock runners in `app-plugin.ts`), `@objectstack/types` (`resolveSandboxTimeoutMs`), `.github/workflows/ci.yml` (the temporary `OS_SANDBOX_HOOK_TIMEOUT_MS=10000` floor this ADR makes removable), `content/docs/deployment/environment-variables.mdx`

---

## TL;DR

The QuickJS sandbox (`packages/runtime/src/sandbox/quickjs-runner.ts`) is the production execution engine for every metadata-authored `Hook.body` / `Action.body` — untrusted tenant/author JS behind a security boundary. Two structural decisions:

1. **D1 — the per-invocation budget charges *script CPU time*, not wall clock.** The existing knobs (`body.timeoutMs`, `hookTimeoutMs` / `actionTimeoutMs`, `OS_SANDBOX_{HOOK,ACTION}_TIMEOUT_MS`) keep their names and defaults but become a **VM-active-time budget**; wall clock survives only as a separate, generous **ceiling** (default 30s) bounding stuck host calls.
2. **D2/D3 — the engine is a fresh, physically isolated *sync* WASM module per invocation (D2), instantiated from a once-compiled `WebAssembly.Module` (D3).** Asyncify is dropped — its only consumer disappeared with the #1867 deferred-promise redesign — while the per-invocation linear-memory isolation is retained as deliberate defense-in-depth.

The tempting third shape — **one shared module with per-invocation contexts — is rejected** (D4) on threat-model grounds and recorded here so it is not re-proposed as an "optimization".

## Context

Every sandbox invocation today creates a fresh **asyncify** WASM module (`newAsyncContext()`), enforces one **wall-clock** deadline over the whole invocation (interrupt handler + pump-loop check), and disposes the module on settle. Three structural problems, all surfaced by the #3259 flake and its investigation:

- **One number, two unrelated meanings.** The wall-clock budget simultaneously bounds "tolerate a slow/loaded host" and "kill a runaway script". An operator who raises `OS_SANDBOX_HOOK_TIMEOUT_MS` for stability on constrained hardware also widens the per-invocation CPU-DoS window for a `while(1)` body — the knob cannot serve both masters. In production a tripped budget is a **failed user write**, load-dependent and hard to reproduce.
- **Nested hooks are billed to the parent.** A hook that performs a nested cross-object write parks on the host call while the *child object's* hook runs its own full invocation (module creation + eval + pump) host-side. Every one of those milliseconds counts against the *parent's* wall clock even though the parent VM executes nothing meanwhile. This is exactly the #1867 rollup pattern the sandbox exists to support.
- **Per-invocation fixed cost, doubled by asyncify.** The asyncify build is bigger (instrumentation), slower to compile/instantiate, and slower per instruction. Under per-row hook storms (bulk writes) the fixed cost is a real tax plus allocation/GC churn — and on an oversubscribed CI runner it alone intermittently blew the 250ms hook default while the VM was still making progress (the #3259 flake signature: variable pump counts, same wall deadline).

Why asyncify is now vestigial: the #1867 redesign moved every host call to a **deferred QuickJS promise settled from the host event loop**, drained by a pump loop (`executePendingJobs`). Nothing suspends the WASM stack anymore — `installApiMethod` deliberately does not use `newAsyncifiedFunction`, and the initial `evalCodeAsync` only runs the wrapped async IIFE to its first `await`. The historical crashes that forced per-invocation modules (`memory access out of bounds`, HostRef double-free) were asyncify's one-suspended-stack-per-module limit — not a property of module sharing per se. The isolation hierarchy in `quickjs-emscripten@0.32.0` (verified against the installed `.d.ts`): separate **module** = own WebAssembly instance + own linear memory ("the most isolation guarantees possible"); separate **runtime** on one module = shared memory, no object exchange; separate **context** = shared memory, objects shareable.

## Decisions

### D1 — The budget is script CPU time; wall clock is only a ceiling

The value resolved by `resolveTimeout()` (body `timeoutMs` › enclosing `opts.timeoutMs` › runner default, smaller-explicit-wins) becomes a **VM-active-time budget**:

- The host stopwatches every VM entry — the initial `evalCode`, and each `executePendingJobs` slice in the pump loop. Idle pump yields (`setImmediate`), host-promise settle time, and nested-hook execution are **not charged**.
- The interrupt handler cuts a runaway synchronous loop mid-slice: `(cpuMs + currentSliceElapsed) > cpuBudget || now > wallDeadline`. A mid-slice interrupt is mapped back to the clean budget error, not surfaced as `InternalError: interrupted`.
- A separate **wall-clock ceiling** — `max(DEFAULT_WALL_CEILING_MS = 30_000, cpuBudget)`, constructor-overridable (`wallCeilingMs`), 30s chosen to match the spec cap on `ScriptBody.timeoutMs` — is the *only* wall bound, and exists solely to cut a hook parked forever on a host call that never settles (the interrupt handler cannot fire while no VM code runs).
- Distinct, greppable errors: `exceeded CPU budget of {N}ms …` vs `exceeded wall-clock ceiling of {N}ms while awaiting host calls …`.
- Accuracy: slice wall-time over-estimates CPU under scheduler preemption — the failure mode is cutting a runaway *early*, never letting it run *late*. A `process.cpuUsage()`-delta refinement is compatible and deferred.

Consequence for the knobs: names, defaults (250ms hooks / 5000ms actions), and precedence are unchanged; only the *dimension* changes. Raising the CPU budget no longer trades away host-latency tolerance, and vice versa. This restores meaning to the 250ms default on any hardware — which is what lets CI drop its 10s floor (a stopgap that today also loosens the runaway bound for every test).

Settled (Phase 1): the ceiling is both a constructor option (`wallCeilingMs`, needed for fast tests) AND env-tunable via `OS_SANDBOX_WALL_CEILING_MS` — symmetric with the CPU knobs and wanted by slow-IO deployments. Precedence: explicit option › env › built-in 30s.

### D2 — Drop asyncify: per-invocation *sync* modules (isolation unchanged)

Switch `newAsyncContext()` → `newQuickJSWASMModule().newContext()` (the sync release variant `@jitl/quickjs-wasmfile-release-sync` is already installed) and `evalCodeAsync` → `evalCode`. The sync surface is otherwise identical (`newPromise`, `executePendingJobs`, `setInterruptHandler`, `setMemoryLimit`, `setMaxStackSize`).

- **Invariant (normative): one fresh, isolated WASM module per invocation.** `newQuickJSWASMModule()` creates a new WebAssembly instance with its own linear memory; nothing may downgrade this to runtime- or context-level sharing (see D4).
- Disposal transfers from the context to the pair: dispose context, then module — the module owns the linear memory.
- Wins: no asyncify state machine on every call (per-instruction speedup), smaller binary, faster compile/instantiate, and removal of an entire class of suspended-stack failure modes the current code only avoids by convention.

### D3 — Compile the WASM once; instantiate per invocation (deferrable)

Cache one compiled `WebAssembly.Module` per process and build a customized variant via `newVariant(RELEASE_SYNC, { wasmModule })` (verified in 0.32: *"Emscripten will instantiate the WebAssembly.Instance from this existing WebAssembly.Module"*), so each invocation pays only instantiation — fresh linear memory, shared stateless bytecode. The `instantiateWasm` Emscripten hook is the lower-level fallback. **`wasmMemory` must never be passed** — injecting a shared memory would silently recreate the rejected D4 shape. If clean access to the variant's `.wasm` bytes proves awkward, D3 defers without weakening D1/D2.

### D4 — No shared singleton module (rejected alternative: shared module + per-invocation contexts)

Rejected, permanently, for this codebase's threat model — the sandbox runs **attacker-authorable JS**:

- A QuickJS C-heap bug (historically recurrent in JS engines) yields arbitrary R/W **within the module's linear memory**. With per-invocation modules the blast radius is the attacker's own invocation; with a shared module it reaches **other concurrent invocations' marshalled record data in the same linear memory** — one engine bug becomes a cross-tenant confidentiality/integrity incident. Physical per-invocation memory is defense-in-depth the platform's "AI agents can operate it safely" promise pays for.
- WASM linear memory never shrinks: a shared module's RSS ratchets to peak concurrency forever; per-invocation modules return everything on dispose.
- After D1–D3 the residual per-call cost is a cheap instantiate; no remaining performance gap justifies the trade.

## Consequences

- **Positive**
  - The #3259 class of flake dies at the root: on a loaded host, idle waits and nested hooks no longer consume the script's budget; the stock 250ms default becomes meaningful everywhere, and CI's `OS_SANDBOX_HOOK_TIMEOUT_MS=10000` floor becomes removable (follow-up PR after Phase 1 soaks).
  - Security posture *tightens*: the CPU-DoS bound decouples from host-latency tolerance, and per-invocation physical isolation is now a written invariant rather than an accident of asyncify's limitations.
  - Hook-storm throughput improves (no asyncify tax; with D3, no per-call compile).
- **Negative / accepted**
  - User-visible error-message change (`timeout of Nms` → `CPU budget of Nms` / `wall-clock ceiling of Nms`) — a semantics change shipped with a changeset stating FROM → TO, plus docs updates.
  - A stuck host call can now hold a VM (and its rolled-back-on-dispose transaction state) up to the 30s ceiling instead of the old small wall budget — bounded, and the correct trade: the old behavior killed *legitimate* slow writes to punish *hypothetical* stuck ones.
  - Slice-based CPU accounting is approximate under preemption (fails toward early cutoff; `process.cpuUsage()` refinement available if it ever matters).
- **Verification** (normative for each phase; details in #3275): the full `src/sandbox/` suite green — including the nested-write integration tests running at the **stock 250ms** budget with the explicit 10s overrides removed; a `quickjs-runner.bench.ts` before/after benchmark; an RSS soak asserting memory returns on dispose (guards D2/D3's isolation invariant); a flake canary (`nested-write` ×N under CPU stress at stock defaults).
