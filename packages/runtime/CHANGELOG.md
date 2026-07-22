# @objectstack/runtime

## 16.1.0

### Patch Changes

- 818e6a3: fix(server-timing): emit the per-request, admin-gated `Server-Timing` header on the standard server (`os serve`/`dev`) (#3361)

  The per-request `Server-Timing` path (#2408) — where an admin sends
  `X-OS-Debug-Timing: 1` (or `json`) and gets phase timings while an ordinary user
  gets nothing — never emitted on the shipped Hono server. The disclosure gate the
  Hono middleware opens is only ever flipped by the runtime dispatcher's
  `timedResolveExecutionContext`, but the data (`/api/v1/data/*`) and metadata
  (`/api/v1/meta/*`) routes on `os serve`/`dev` are served by `@objectstack/rest`'s
  `RestServer` (which shadows the Hono plugin's own CRUD), and its identity
  resolver never opened the gate. Only global mode (`OS_SERVER_TIMING=true`) — which
  discloses to _every_ caller, not just admins — worked.

  - **observability**: the disclosure predicate `isPerfDisclosurePrincipal(ec)` now
    lives here (the home of the gate), the single definition of "who may pull
    per-request timings" shared by every HTTP entry point. `@objectstack/runtime`
    re-exports it for back-compat.
  - **rest**: `RestServer.resolveExecCtx` opens the gate for an admin/service
    principal (via the carried `posture` rung), the REST-server analog of the
    dispatcher — this is the fix that makes `os serve`/`dev` emit.
  - **plugin-hono-server**: the standalone CRUD surface's self-contained
    `resolveCtx` opens the gate too (deriving the rung for the gate decision only,
    never writing it onto the enforcement context). Adds an e2e test that boots the
    Hono app and asserts an admin gets `Server-Timing` while a member/anon does not.

- Updated dependencies [9e45b63]
- Updated dependencies [b20201f]
- Updated dependencies [818e6a3]
  - @objectstack/spec@16.1.0
  - @objectstack/core@16.1.0
  - @objectstack/observability@16.1.0
  - @objectstack/rest@16.1.0
  - @objectstack/metadata@16.1.0
  - @objectstack/plugin-auth@16.1.0
  - @objectstack/plugin-security@16.1.0
  - @objectstack/formula@16.1.0
  - @objectstack/metadata-core@16.1.0
  - @objectstack/objectql@16.1.0
  - @objectstack/driver-memory@16.1.0
  - @objectstack/driver-sql@16.1.0
  - @objectstack/driver-sqlite-wasm@16.1.0
  - @objectstack/service-cluster@16.1.0
  - @objectstack/service-datasource@16.1.0
  - @objectstack/service-i18n@16.1.0
  - @objectstack/types@16.1.0

## 16.0.0

### Major Changes

- 6c270a6: **BREAKING: remove the deprecated `ctx.session.tenantId` / `ctx.user.tenantId` alias from the hook & action authoring surface — converge on `organizationId` (#3290).**

  #3280 made `organizationId` the blessed developer-facing name for the caller's active org across the JS authoring surface and kept `tenantId` as a `@deprecated` alias carrying the identical value. That alias is now **removed** from the hook `ctx.session`, the action-body `ctx.session`, and the action-body `ctx.user`. Read the caller's active org under the single blessed name:

  ```diff
  - const org = ctx.session.tenantId;   // hook or action body
  + const org = ctx.user?.organizationId ?? ctx.session?.organizationId;
  ```

  **FROM → TO migration** (in any `*.hook.ts` / `*.action.ts` body):

  - `ctx.session.tenantId` → `ctx.session.organizationId`
  - `ctx.user.tenantId` (action body) → `ctx.user.organizationId`

  The value is unchanged — `organizationId` is the same active-org id, matching the `organization_id` column and `current_user.organizationId` in RLS/sharing. `ctx.user` is `undefined` for system / unauthenticated writes, so read `ctx.session?.organizationId` when a hook or action must work regardless of a resolved user.

  What changed internally:

  - **`@objectstack/spec`** — `HookContextSchema.session` drops the `tenantId` field (only `organizationId` remains). A stray `tenantId` on a constructed session is now stripped by the schema.
  - **`@objectstack/objectql`** — the engine's `buildSession()` no longer emits `session.tenantId`; the audit-stamp plugin sources the `tenant_id` column from `session.organizationId`.
  - **`@objectstack/runtime`** — `buildActionSession()` and the REST action `ctx.user` no longer emit `tenantId`.
  - **`@objectstack/trigger-record-change`** — reads `session.organizationId` (was `session.tenantId`) when forwarding the writer's org to a `runAs:'user'` flow; behavior is identical.

  **Explicit non-goal (unchanged):** the generic **driver-layer** tenancy abstraction is _not_ touched — `ExecutionContext.tenantId`, `DriverOptions.tenantId`, `SqlDriver.applyTenantScope` / `TenancyConfig.tenantField`, and `ExecutionLog.tenantId`. That isolation column is configurable and legitimately carries an _environment_ id in database-per-tenant kernels; it is a distinct axis from the developer-facing org. The build-time `check:org-identifier` guard now also covers `packages/**` to keep reference bodies off the removed name.

### Minor Changes

- 2049b6a: feat(observability): admin-gated per-request `Server-Timing` via `X-OS-Debug-Timing` (#2408)

  Perf-tuning mode was previously global-only (`serverTiming` option /
  `OS_SERVER_TIMING`), which discloses internal phase durations — a mild
  backend-fingerprinting surface — to every caller. This adds the per-request
  gating path from the design so an operator can pull a single request's
  `Server-Timing` breakdown on a live environment without turning the header on
  for everyone.

  - **observability**: a request-scoped disclosure gate (`runWithPerfDisclosure`,
    `allowPerfDisclosure`, `isPerfDisclosureAllowed`, `PerfDisclosureGate`) kept
    separate from the pure `PerfTiming` collector and pinned to its own
    `Symbol.for` store so the middleware and dispatcher share it across module
    copies.
  - **plugin-hono-server**: the Server-Timing middleware is registered by default
    (unless `serverTiming: false`). It runs the collector when timing is global
    **or** the request sends `X-OS-Debug-Timing: 1`, and emits the header only
    when the gate is open. `OS_PERF_TIMING=1` now also enables global mode.
  - **runtime**: after resolving the execution context, the dispatcher opens the
    gate for admin/service/system principals, so ordinary callers never receive
    the header even if they send the debug header.

  Existing global-mode behavior is unchanged.

- 92f5f19: feat(runtime): sandbox budget is script CPU-time, not wall clock (ADR-0102 D1, #3295)

  The QuickJS sandbox now meters each hook/action invocation against how much
  **VM-active (CPU) time** the body burns, not wall clock. Idle host-await time and
  a nested hook's own execution (which runs host-side while the caller's VM is
  parked) are no longer charged to the caller — so a slow/loaded host or a deep
  nested-write chain can't trip the budget while a script is merely waiting (the
  root cause of the #3259 CI flake). A separate, generous **wall-clock ceiling**
  (default 30s, `max(ceiling, cpuBudget)`) remains as the backstop for a body stuck
  on a host call that never settles.

  What changes for consumers (behaviour, not API signatures):

  - **Meaning of the timeout knobs.** `body.timeoutMs`, the `hookTimeoutMs` /
    `actionTimeoutMs` runner options, and `OS_SANDBOX_HOOK_TIMEOUT_MS` /
    `OS_SANDBOX_ACTION_TIMEOUT_MS` keep their **names, defaults (250ms / 5000ms),
    and precedence** — but now bound CPU-time instead of wall-clock. In practice
    this only _loosens_ legitimate slow/nested work; a runaway synchronous script
    is still cut at the same budget.
  - **Error messages.** `exceeded timeout of Nms` → either `exceeded CPU budget of
Nms` (script burned its CPU budget) or `exceeded wall-clock ceiling of Nms
while awaiting host calls` (stuck on a never-settling host call). Update any
    code/tests matching the old string.

  New knobs (additive):

  - `QuickJSScriptRunner` option `wallCeilingMs` and env `OS_SANDBOX_WALL_CEILING_MS`
    — tune the wall ceiling (explicit option › env › 30s).
  - `resolveSandboxTimeoutMs` (`@objectstack/types`) gains a `'wallCeiling'` kind.

  Also fixes a latent init bug in the new accounting where the interrupt handler
  could fire during `installCtx` and corrupt ctx marshalling. The nested-write
  integration suites now run at the stock 250ms budget (previously forced to 10s),
  which is itself the regression guard for the nested-charging fix.

- 32899e6: feat(runtime): env-overridable sandbox hook/action timeout default (#3259)

  The QuickJS sandbox enforces a wall-clock deadline on every hook/action
  invocation (250ms hooks / 5000ms actions). Each invocation compiles a fresh
  WASM module, and a nested hook compiles ANOTHER one inside the parent's budget,
  so on a heavily loaded or slow host — an oversubscribed CI runner, constrained
  production hardware — that fixed VM-creation cost alone can trip the hook
  default even while the VM is still making progress. On CI this surfaced as an
  intermittent `hook '…' exceeded timeout of 250ms` flake on PRs that never
  touched the sandbox path.

  The per-invocation timeout DEFAULT is now resolvable from the environment via
  `resolveSandboxTimeoutMs` (`@objectstack/types`), which `QuickJSScriptRunner`
  consults, so an operator can raise the floor once, deployment-wide, instead of
  re-tuning every call site:

  - `OS_SANDBOX_HOOK_TIMEOUT_MS` — default hook budget (ms)
  - `OS_SANDBOX_ACTION_TIMEOUT_MS` — default action budget (ms)

  Precedence is unchanged: an explicit `hookTimeoutMs` / `actionTimeoutMs` passed
  to the runner still wins over the env var, and a body's own declared `timeoutMs`
  still wins over the resolved default (the smaller of the explicit values). Only
  a positive integer is honored; unset / empty / non-numeric / non-positive keeps
  the built-in 250ms / 5000ms defaults, so behaviour is byte-for-byte unchanged
  when the vars are absent — production is unaffected unless it opts in.

  CI's Test Core now sets `OS_SANDBOX_HOOK_TIMEOUT_MS=10000` so the shared-runner
  load flake can't recur; genuine hangs stay bounded by each test's own timeout.

### Patch Changes

- b39c65d: **Extend the blessed `organizationId` org name to the action-body surface (follow-up to #3280).** Hooks now teach `ctx.user.organizationId` / `ctx.session.organizationId` as the blessed name for the caller's active org; action bodies — the sibling authoring surface that shares the same sandbox runner — were left behind: the REST dispatch path exposed only `ctx.user.tenantId` (the deprecated name) and no `ctx.session` at all, and the MCP `run_action` path exposed neither.

  Both action-dispatch sites (`handleActions`, MCP `runAction`) now populate:

  - **`ctx.user.organizationId`** — the blessed name (matches the `organization_id` column and `current_user.organizationId` in RLS); `ctx.user.tenantId` is kept as a deprecated alias with the identical value on the REST path.
  - **`ctx.session`** (`{ userId, organizationId, tenantId, roles? }`) — mirrors the hook `ctx.session` shape, `undefined` for a context-less / self-invoked call.

  Action bodies execute trusted (the `ctx.engine` / `ctx.api` facade bypasses RLS/FLS), so a body that must scope by org has to read it from `ctx` — now under the same name a hook author uses. Additive and behavior-preserving; the objectstack-ui skill documents the action-body `ctx` and the `organizationId` read.

- fdc244e: Dev-loop DX fixes from the 15.1 third-party evaluation (P2 batch):

  - **Hot-added objects are now queryable without a restart.** Adding a `*.object.ts` under `os dev` used to recompile "green" while every query answered `no such table` (or `not registered`) until a manual restart: the artifact reload never notified the ObjectQL registry, tables were only created at boot, and seeds only loaded from the boot-time bundle. The `metadata:reloaded` payload now carries the parsed artifact; ObjectQL ingests the object definitions and re-runs the idempotent schema sync (same `skipSchemaSync` opt-out as boot), and the runtime loads seeds for first-seen objects (dev, single-tenant). `os dev` also prints `✚ new object(s): …` on recompile.
  - **Dev admin credentials stay visible.** The `os dev` startup banner only showed `admin@objectos.ai / admin123` on the boot that actually seeded it; with the persistent default DB every later boot hid it, and the Console login page never knew it existed. The hint now re-arms on every dev boot for as long as the account still verifies against the default password, and `GET /api/v1/auth/config` exposes a dev-gated `devSeedAdmin` field (never present outside `NODE_ENV=development`) so the login page can show it.
  - **`os doctor` reference analysis understands current metadata shapes.** Objects bound through `defineView` containers (`list`/`listViews`/`form`/`formViews` → `data.object`, subform `childObject`, lookup form fields) and app navigation (`objectName`, nested `children`, `areas`) were reported as "defined but not referenced". The collector now walks the canonical shapes (plus flow node `config.object`/`objectName`) and the orphan-view check descends into containers.

- 2ea08ee: Flow trigger observability — kill the four-layer silence around record-change flows that never fire (2026-07-17 third-party eval).

  A misauthored auto-launched flow (wrong `objectName`, missing `requires: ['automation','triggers']`, failing start condition) produced ZERO output at every layer: the engine's own registration/binding logs land inside the CLI's boot-quiet stdout window (which swallows debug/info/warn — only error/fatal reach stderr), and each "didn't happen" path was itself silent. Fixes:

  - **Startup banner `Flows:` section** (`os serve`/`os dev`/`os start`): flow count, bound-to-trigger count, registered trigger types, draft count — plus loud `⚠` lines for flows declared with no automation engine enabled (`requires` missing), flows whose trigger type has no registered trigger, and bound record-change flows targeting an unknown object (dead binding). Printed after stdout is restored, so it is immune to the boot-quiet window.
  - **Trigger-fired run failures now log at ERROR** (stderr — always visible): the automation engine no longer drops the AutomationResult of a trigger-fired execution; condition-evaluation faults and node failures surface with the flow name. Condition-not-met skips stay at debug (high-frequency, intentional).
  - **`RecordChangeTrigger` probes object existence at bind time** and warns when a flow's `objectName` matches no registered object (exact-name matching), instead of silently arming a hook that can never fire.
  - **`kernel:bootstrapped` binding audit** in the automation plugin: warns per enabled-but-unbound triggered flow with the reason, and reports registered/bound/draft counts (`AutomationEngine.getTriggerBindingAudit()`, extended `getFlowRuntimeStates()` with `status`/`triggerType`/`object`).
  - **`os validate` flow-wiring advisories** (`@objectstack/lint` `validateFlowTriggerReadiness`): warns when a record-triggered flow targets an object the stack does not define, and when an auto-triggered flow's status is `draft` (authored or defaulted — draft flows still fire; declare `active` or `obsolete`).
  - Removed leftover boot-debug writes (`registerApp`/`AppPlugin`/`StandaloneStack`/`AuditPlugin` stderr noise) that previous debugging of this same silence had left behind.

- d1d1c40: fix(runtime): honor a hook body's declared `timeoutMs` so nested cross-object writes aren't clamped to 250ms (#1867)

  Hook bodies run in the QuickJS sandbox with a default 250ms timeout. The runner
  folded that engine default straight into `Math.min(...)` when resolving the
  effective timeout, so it _always_ dominated for hooks: a body that declared a
  larger `timeoutMs` (the spec permits up to 30_000ms — `ScriptBody.timeoutMs`) to
  give a legitimate nested write — "when a child changes, update the parent" —
  room to settle was silently clamped back to 250ms and killed mid-flight. The
  declared knob was never enforced.

  The engine default is now a FALLBACK used only when no explicit timeout is
  supplied, not a hard ceiling. An explicit `body.timeoutMs` (and/or an enclosing
  hook/action timeout) is honored; when both are present the smaller wins. Bodies
  that declare nothing still get the 250ms hook / 5000ms action default, and a
  body may still LOWER its own timeout below the default.

  This clears the last reliability blocker for nested cross-object writes from
  hooks — the sandbox crash itself (`memory access out of bounds`) was already
  fixed by the deferred-promise host-call model — so header/rollup fields no
  longer need denormalized, hand-maintained workarounds.

- ee0a499: feat(i18n): localize collaboration notification titles and the storage objects; wire the notifications REST routes

  Three gaps behind one report (a `sys_file "repro.png" assigned to you`
  notification that was English on an all-Chinese workspace, opened an English
  detail page, and never cleared its unread state):

  - **plugin-audit** — the assignment (`collab.assignment`) and @mention
    (`collab.mention`) bell titles were hardcoded English literals built from the
    raw object API name. They now resolve through the i18n service with the same
    key shapes as the activity summaries (framework#3039): new
    `messages.assignedToYou` / `messages.mentionedYou` /
    `messages.mentionedYouAnonymous` templates (en / zh-CN / ja-JP / es-ES), the
    object named by its translated label (`objects.{name}.label` → authored def
    label → API name), and the locale resolved for the **recipient** (they read
    the bell), not the acting user. Every step stays best-effort: no locale / no
    i18n / key miss degrades to the English literal — which now also prefers the
    authored object label over the API name.

  - **service-storage** — `sys_file` / `sys_upload_session` had no translation
    bundle at all, so the file detail page (labels, and the Pending Upload /
    Committed / Deleted status pipeline) rendered English on every locale. The
    service now ships its own ADR-0029 D8 bundle (en / zh-CN / ja-JP / es-ES,
    `src/translations` + `scripts/i18n-extract.config.ts`) and contributes it via
    `i18n.loadTranslations` on `kernel:ready`, matching service-messaging.
    (`sys_attachment` stays in platform-objects' bundles pending the
    storage-domain decomposition.)

  - **runtime** — the in-app notifications REST surface (`GET
/api/v1/notifications`, `POST /api/v1/notifications/read`, `POST
/api/v1/notifications/read/all`; ADR-0030) had its `handleNotification`
    dispatch branch and discovery entry, but no `server.<verb>()` mount in
    `dispatcher-plugin`, so only the cloud hosts' hono catch-all reached it — the
    standalone / `os dev` server 404'd every request. That left mark-read with no
    working endpoint (the console's direct `sys_notification_receipt` write is
    rejected by ADR-0103's engine-owned gate), so unread notifications could never
    clear. The three routes are now mounted explicitly, guarded by the
    route-registration regression test.

- a2d6555: perf(runtime): drop asyncify — sandbox runs on the sync QuickJS variant (ADR-0102 D2, #3296)

  Phase 2 of #3275. The QuickJS sandbox switches from the asyncify build
  (`newAsyncContext`) to the already-installed sync release variant
  (`newQuickJSWASMModule().newContext()`), keeping one physically isolated WASM
  module per invocation (ADR-0102 D2/D4). Asyncify's only justification — suspending
  the WASM stack across a host call — disappeared with the #1867 deferred-promise +
  pump redesign, so nothing depended on it. Wins: smaller binary, faster
  compile/instantiate, faster per-instruction, and removal of an entire class of
  suspended-stack failure modes.

  Also fixes a latent resource leak surfaced by the stricter sync teardown: host
  `ctx.api` calls hand the VM a `vm.newPromise()` deferred that was never
  `dispose()`d (the newPromise contract requires it). The asyncify build tolerated
  the leak; the sync build's `JS_FreeRuntime` aborted (`Assertion failed:
list_empty`) when a context was torn down with a pending, never-settled host call
  (the timeout path). Deferreds are now tracked and disposed before context
  teardown.

  Memory: the sync `QuickJSWASMModule` has no `dispose()`; its WebAssembly instance

  - linear memory are GC-reclaimed when the reference is dropped. A new RSS soak
    test guards that per-invocation modules don't ratchet RSS.

- 3a6310c: perf(runtime): stop the sandbox pump loop from idle-spinning while awaiting a host call (#3233)

  The QuickJS hook/action runner drives a script's async continuations with a
  pump loop that, on every iteration, yielded via `setImmediate` and then drained
  the VM job queue. While the body was only _waiting_ on an in-flight host promise
  (a slow `ctx.api` read/write, or one call that settles after many event-loop
  turns), that queue was empty every iteration, so the loop woke ~200k times/sec
  doing nothing — a ~50,000-iteration burn for a 250ms wait.

  The yield is now adaptive: it stays on `setImmediate` (near-zero latency) while
  the script is making progress, and once a pump executes zero VM jobs it ramps up
  to a small capped `setTimeout` (≤8ms). Any executed job — a settled host call, a
  resumed continuation — resets it to the fast path, so sequential host calls and
  multi-turn work keep their low latency; only a genuinely idle wait backs off.
  Deadline enforcement and every existing pump-budget/timeout/transaction
  guarantee are unchanged.

- 515f11a: fix(seed): replaying seeds no longer corrupts lookup natural keys on the upsert update path

  Every dev-server restart replayed package seeds in upsert mode, and any record whose
  lookup/master_detail was authored as a natural key could have that reference overwritten
  with NULL on the update path (`NOT NULL constraint failed` on required columns; silent
  link loss on nullable ones). Four fixes:

  - An unresolved reference now leaves the column untouched (deferred to pass 2) or drops
    the record loudly — it is never written as NULL over an existing row.
  - DB-side reference resolution probes the target dataset's declared `externalId` (e.g.
    `email`) before falling back to `name` and `id`, matching how in-memory resolution
    already keyed records.
  - A rejected update (e.g. a `state_machine` rule vetoing the replay) no longer severs
    natural-key resolution for downstream child datasets.
  - Replays are idempotent: an upsert/update whose declared fields already match the
    existing row is skipped instead of rewritten (no more `updated_at` churn or lifecycle
    re-validation on every boot).

- 4174a07: feat(runtime): seed-replayer reports `skipped` so hosts can stamp seed-once on progress

  The `seed-replayer` kernel service returned `{ inserted, updated, errors }` but
  not `skipped`. A cloud host therefore could not tell an **all-skip replay**
  (the env's seed data is already present — a no-op) apart from the
  zero-summary early-returns that never ran the loader (no organization, no
  metadata service, no datasets). Both looked like `inserted = updated = 0`, so
  the host could not safely stamp its seed-once record for the all-skip case and
  re-ran the full remote replay on every cold boot.

  Add `skipped: result.summary.totalSkipped` to the replayer's return; the
  early-returns report `skipped: 0`. This lets a host (cloud#853's
  `decideSeedStamp`) stamp on progress — including an all-skip replay — while
  still declining to stamp a genuine no-loader zero-summary. Additive and
  backward compatible; existing consumers ignore the new field.

- ce468c8: feat(observability): decompose `Server-Timing` into auth / db / hooks / serialize spans (perf-tuning mode)

  The opt-in `Server-Timing` header now breaks a request's server time into the phases that actually explain it, so an operator can open DevTools → Network → Timing and see where the time went without standing up an external tracing backend:

  - **`db`** — total SQL time with a **query count**. The SQL driver wires knex's `query` / `query-response` events (keyed by `__knexQueryUid`) and folds each query into one aggregate member (`db;dur=210;desc="6 queries"`) — the query count is the number most useful for spotting N sequential round-trips. Timing is attributed to the originating request via `AsyncLocalStorage`, so it is correct under concurrency and never cross-attributes. SQL text is never emitted, only durations and a count.
  - **`auth`** — identity / session resolution in the dispatcher, the prime suspect for unexplained data-API overhead.
  - **`hooks`** — total business-hook execution time with a hook count, fed through the engine's existing `HookMetricsRecorder` seam (wired from the runtime, so `@objectstack/objectql`'s lean `core` tier stays observability-free).
  - **`serialize`** — response JSON encoding in the HTTP adapter.

  Adds `countServerTiming(name, dur, unit)` (and `PerfTiming.count`) to fold high-frequency phases into a single aggregate member instead of flooding the header. Every phase is a no-op when perf-tuning is off (`serverTiming: true` / `OS_SERVER_TIMING=true`), so there is zero measurable overhead on the normal path.

  Closes #2408.

- Updated dependencies [f972574]
- Updated dependencies [6289ec3]
- Updated dependencies [2f3c641]
- Updated dependencies [e38da5b]
- Updated dependencies [f9b118d]
- Updated dependencies [22013aa]
- Updated dependencies [3ad3dd5]
- Updated dependencies [8efa395]
- Updated dependencies [3a18b60]
- Updated dependencies [deb7e7e]
- Updated dependencies [a8aa34c]
- Updated dependencies [e057f42]
- Updated dependencies [a3823b2]
- Updated dependencies [43a3efb]
- Updated dependencies [524696a]
- Updated dependencies [6b51346]
- Updated dependencies [80273c8]
- Updated dependencies [fdc244e]
- Updated dependencies [bfa3c3f]
- Updated dependencies [5e3301d]
- Updated dependencies [dd9f223]
- Updated dependencies [47d923c]
- Updated dependencies [46e876c]
- Updated dependencies [2ea08ee]
- Updated dependencies [7125007]
- Updated dependencies [616e839]
- Updated dependencies [5f05de2]
- Updated dependencies [021ba4c]
- Updated dependencies [158aa14]
- Updated dependencies [9d897b3]
- Updated dependencies [62a2117]
- Updated dependencies [83e8f7d]
- Updated dependencies [d2723e2]
- Updated dependencies [674457a]
- Updated dependencies [fefcd54]
- Updated dependencies [efbcfe1]
- Updated dependencies [2049b6a]
- Updated dependencies [beaf2de]
- Updated dependencies [06cb319]
- Updated dependencies [369eb6e]
- Updated dependencies [06ff734]
- Updated dependencies [b659111]
- Updated dependencies [5754a23]
- Updated dependencies [6c270a6]
- Updated dependencies [290e2f0]
- Updated dependencies [668dd17]
- Updated dependencies [8abf133]
- Updated dependencies [e0859b1]
- Updated dependencies [92f5f19]
- Updated dependencies [32899e6]
- Updated dependencies [ce468c8]
- Updated dependencies [04ecd4e]
- Updated dependencies [4d5a892]
- Updated dependencies [16cebeb]
- Updated dependencies [86d30af]
- Updated dependencies [8923843]
- Updated dependencies [ea32ec7]
- Updated dependencies [a2795f6]
- Updated dependencies [f16b492]
- Updated dependencies [4b6fde8]
- Updated dependencies [2018df9]
- Updated dependencies [fc5a3a2]
- Updated dependencies [8ff9210]
  - @objectstack/spec@16.0.0
  - @objectstack/plugin-security@16.0.0
  - @objectstack/objectql@16.0.0
  - @objectstack/rest@16.0.0
  - @objectstack/plugin-auth@16.0.0
  - @objectstack/core@16.0.0
  - @objectstack/formula@16.0.0
  - @objectstack/metadata@16.0.0
  - @objectstack/driver-sql@16.0.0
  - @objectstack/metadata-core@16.0.0
  - @objectstack/types@16.0.0
  - @objectstack/observability@16.0.0
  - @objectstack/driver-memory@16.0.0
  - @objectstack/driver-sqlite-wasm@16.0.0
  - @objectstack/service-cluster@16.0.0
  - @objectstack/service-datasource@16.0.0
  - @objectstack/service-i18n@16.0.0

## 16.0.0-rc.1

### Patch Changes

- ee0a499: feat(i18n): localize collaboration notification titles and the storage objects; wire the notifications REST routes

  Three gaps behind one report (a `sys_file "repro.png" assigned to you`
  notification that was English on an all-Chinese workspace, opened an English
  detail page, and never cleared its unread state):

  - **plugin-audit** — the assignment (`collab.assignment`) and @mention
    (`collab.mention`) bell titles were hardcoded English literals built from the
    raw object API name. They now resolve through the i18n service with the same
    key shapes as the activity summaries (framework#3039): new
    `messages.assignedToYou` / `messages.mentionedYou` /
    `messages.mentionedYouAnonymous` templates (en / zh-CN / ja-JP / es-ES), the
    object named by its translated label (`objects.{name}.label` → authored def
    label → API name), and the locale resolved for the **recipient** (they read
    the bell), not the acting user. Every step stays best-effort: no locale / no
    i18n / key miss degrades to the English literal — which now also prefers the
    authored object label over the API name.

  - **service-storage** — `sys_file` / `sys_upload_session` had no translation
    bundle at all, so the file detail page (labels, and the Pending Upload /
    Committed / Deleted status pipeline) rendered English on every locale. The
    service now ships its own ADR-0029 D8 bundle (en / zh-CN / ja-JP / es-ES,
    `src/translations` + `scripts/i18n-extract.config.ts`) and contributes it via
    `i18n.loadTranslations` on `kernel:ready`, matching service-messaging.
    (`sys_attachment` stays in platform-objects' bundles pending the
    storage-domain decomposition.)

  - **runtime** — the in-app notifications REST surface (`GET
/api/v1/notifications`, `POST /api/v1/notifications/read`, `POST
/api/v1/notifications/read/all`; ADR-0030) had its `handleNotification`
    dispatch branch and discovery entry, but no `server.<verb>()` mount in
    `dispatcher-plugin`, so only the cloud hosts' hono catch-all reached it — the
    standalone / `os dev` server 404'd every request. That left mark-read with no
    working endpoint (the console's direct `sys_notification_receipt` write is
    rejected by ADR-0103's engine-owned gate), so unread notifications could never
    clear. The three routes are now mounted explicitly, guarded by the
    route-registration regression test.

- Updated dependencies [6289ec3]
- Updated dependencies [8efa395]
- Updated dependencies [bfa3c3f]
- Updated dependencies [7125007]
- Updated dependencies [9d897b3]
- Updated dependencies [62a2117]
- Updated dependencies [674457a]
- Updated dependencies [06ff734]
  - @objectstack/spec@16.0.0-rc.1
  - @objectstack/rest@16.0.0-rc.1
  - @objectstack/formula@16.0.0-rc.1
  - @objectstack/plugin-security@16.0.0-rc.1
  - @objectstack/metadata-core@16.0.0-rc.1
  - @objectstack/objectql@16.0.0-rc.1
  - @objectstack/core@16.0.0-rc.1
  - @objectstack/metadata@16.0.0-rc.1
  - @objectstack/observability@16.0.0-rc.1
  - @objectstack/driver-memory@16.0.0-rc.1
  - @objectstack/driver-sql@16.0.0-rc.1
  - @objectstack/driver-sqlite-wasm@16.0.0-rc.1
  - @objectstack/plugin-auth@16.0.0-rc.1
  - @objectstack/service-cluster@16.0.0-rc.1
  - @objectstack/service-datasource@16.0.0-rc.1
  - @objectstack/service-i18n@16.0.0-rc.1
  - @objectstack/types@16.0.0-rc.1

## 16.0.0-rc.0

### Major Changes

- 6c270a6: **BREAKING: remove the deprecated `ctx.session.tenantId` / `ctx.user.tenantId` alias from the hook & action authoring surface — converge on `organizationId` (#3290).**

  #3280 made `organizationId` the blessed developer-facing name for the caller's active org across the JS authoring surface and kept `tenantId` as a `@deprecated` alias carrying the identical value. That alias is now **removed** from the hook `ctx.session`, the action-body `ctx.session`, and the action-body `ctx.user`. Read the caller's active org under the single blessed name:

  ```diff
  - const org = ctx.session.tenantId;   // hook or action body
  + const org = ctx.user?.organizationId ?? ctx.session?.organizationId;
  ```

  **FROM → TO migration** (in any `*.hook.ts` / `*.action.ts` body):

  - `ctx.session.tenantId` → `ctx.session.organizationId`
  - `ctx.user.tenantId` (action body) → `ctx.user.organizationId`

  The value is unchanged — `organizationId` is the same active-org id, matching the `organization_id` column and `current_user.organizationId` in RLS/sharing. `ctx.user` is `undefined` for system / unauthenticated writes, so read `ctx.session?.organizationId` when a hook or action must work regardless of a resolved user.

  What changed internally:

  - **`@objectstack/spec`** — `HookContextSchema.session` drops the `tenantId` field (only `organizationId` remains). A stray `tenantId` on a constructed session is now stripped by the schema.
  - **`@objectstack/objectql`** — the engine's `buildSession()` no longer emits `session.tenantId`; the audit-stamp plugin sources the `tenant_id` column from `session.organizationId`.
  - **`@objectstack/runtime`** — `buildActionSession()` and the REST action `ctx.user` no longer emit `tenantId`.
  - **`@objectstack/trigger-record-change`** — reads `session.organizationId` (was `session.tenantId`) when forwarding the writer's org to a `runAs:'user'` flow; behavior is identical.

  **Explicit non-goal (unchanged):** the generic **driver-layer** tenancy abstraction is _not_ touched — `ExecutionContext.tenantId`, `DriverOptions.tenantId`, `SqlDriver.applyTenantScope` / `TenancyConfig.tenantField`, and `ExecutionLog.tenantId`. That isolation column is configurable and legitimately carries an _environment_ id in database-per-tenant kernels; it is a distinct axis from the developer-facing org. The build-time `check:org-identifier` guard now also covers `packages/**` to keep reference bodies off the removed name.

### Minor Changes

- 2049b6a: feat(observability): admin-gated per-request `Server-Timing` via `X-OS-Debug-Timing` (#2408)

  Perf-tuning mode was previously global-only (`serverTiming` option /
  `OS_SERVER_TIMING`), which discloses internal phase durations — a mild
  backend-fingerprinting surface — to every caller. This adds the per-request
  gating path from the design so an operator can pull a single request's
  `Server-Timing` breakdown on a live environment without turning the header on
  for everyone.

  - **observability**: a request-scoped disclosure gate (`runWithPerfDisclosure`,
    `allowPerfDisclosure`, `isPerfDisclosureAllowed`, `PerfDisclosureGate`) kept
    separate from the pure `PerfTiming` collector and pinned to its own
    `Symbol.for` store so the middleware and dispatcher share it across module
    copies.
  - **plugin-hono-server**: the Server-Timing middleware is registered by default
    (unless `serverTiming: false`). It runs the collector when timing is global
    **or** the request sends `X-OS-Debug-Timing: 1`, and emits the header only
    when the gate is open. `OS_PERF_TIMING=1` now also enables global mode.
  - **runtime**: after resolving the execution context, the dispatcher opens the
    gate for admin/service/system principals, so ordinary callers never receive
    the header even if they send the debug header.

  Existing global-mode behavior is unchanged.

- 92f5f19: feat(runtime): sandbox budget is script CPU-time, not wall clock (ADR-0102 D1, #3295)

  The QuickJS sandbox now meters each hook/action invocation against how much
  **VM-active (CPU) time** the body burns, not wall clock. Idle host-await time and
  a nested hook's own execution (which runs host-side while the caller's VM is
  parked) are no longer charged to the caller — so a slow/loaded host or a deep
  nested-write chain can't trip the budget while a script is merely waiting (the
  root cause of the #3259 CI flake). A separate, generous **wall-clock ceiling**
  (default 30s, `max(ceiling, cpuBudget)`) remains as the backstop for a body stuck
  on a host call that never settles.

  What changes for consumers (behaviour, not API signatures):

  - **Meaning of the timeout knobs.** `body.timeoutMs`, the `hookTimeoutMs` /
    `actionTimeoutMs` runner options, and `OS_SANDBOX_HOOK_TIMEOUT_MS` /
    `OS_SANDBOX_ACTION_TIMEOUT_MS` keep their **names, defaults (250ms / 5000ms),
    and precedence** — but now bound CPU-time instead of wall-clock. In practice
    this only _loosens_ legitimate slow/nested work; a runaway synchronous script
    is still cut at the same budget.
  - **Error messages.** `exceeded timeout of Nms` → either `exceeded CPU budget of
Nms` (script burned its CPU budget) or `exceeded wall-clock ceiling of Nms
while awaiting host calls` (stuck on a never-settling host call). Update any
    code/tests matching the old string.

  New knobs (additive):

  - `QuickJSScriptRunner` option `wallCeilingMs` and env `OS_SANDBOX_WALL_CEILING_MS`
    — tune the wall ceiling (explicit option › env › 30s).
  - `resolveSandboxTimeoutMs` (`@objectstack/types`) gains a `'wallCeiling'` kind.

  Also fixes a latent init bug in the new accounting where the interrupt handler
  could fire during `installCtx` and corrupt ctx marshalling. The nested-write
  integration suites now run at the stock 250ms budget (previously forced to 10s),
  which is itself the regression guard for the nested-charging fix.

- 32899e6: feat(runtime): env-overridable sandbox hook/action timeout default (#3259)

  The QuickJS sandbox enforces a wall-clock deadline on every hook/action
  invocation (250ms hooks / 5000ms actions). Each invocation compiles a fresh
  WASM module, and a nested hook compiles ANOTHER one inside the parent's budget,
  so on a heavily loaded or slow host — an oversubscribed CI runner, constrained
  production hardware — that fixed VM-creation cost alone can trip the hook
  default even while the VM is still making progress. On CI this surfaced as an
  intermittent `hook '…' exceeded timeout of 250ms` flake on PRs that never
  touched the sandbox path.

  The per-invocation timeout DEFAULT is now resolvable from the environment via
  `resolveSandboxTimeoutMs` (`@objectstack/types`), which `QuickJSScriptRunner`
  consults, so an operator can raise the floor once, deployment-wide, instead of
  re-tuning every call site:

  - `OS_SANDBOX_HOOK_TIMEOUT_MS` — default hook budget (ms)
  - `OS_SANDBOX_ACTION_TIMEOUT_MS` — default action budget (ms)

  Precedence is unchanged: an explicit `hookTimeoutMs` / `actionTimeoutMs` passed
  to the runner still wins over the env var, and a body's own declared `timeoutMs`
  still wins over the resolved default (the smaller of the explicit values). Only
  a positive integer is honored; unset / empty / non-numeric / non-positive keeps
  the built-in 250ms / 5000ms defaults, so behaviour is byte-for-byte unchanged
  when the vars are absent — production is unaffected unless it opts in.

  CI's Test Core now sets `OS_SANDBOX_HOOK_TIMEOUT_MS=10000` so the shared-runner
  load flake can't recur; genuine hangs stay bounded by each test's own timeout.

### Patch Changes

- b39c65d: **Extend the blessed `organizationId` org name to the action-body surface (follow-up to #3280).** Hooks now teach `ctx.user.organizationId` / `ctx.session.organizationId` as the blessed name for the caller's active org; action bodies — the sibling authoring surface that shares the same sandbox runner — were left behind: the REST dispatch path exposed only `ctx.user.tenantId` (the deprecated name) and no `ctx.session` at all, and the MCP `run_action` path exposed neither.

  Both action-dispatch sites (`handleActions`, MCP `runAction`) now populate:

  - **`ctx.user.organizationId`** — the blessed name (matches the `organization_id` column and `current_user.organizationId` in RLS); `ctx.user.tenantId` is kept as a deprecated alias with the identical value on the REST path.
  - **`ctx.session`** (`{ userId, organizationId, tenantId, roles? }`) — mirrors the hook `ctx.session` shape, `undefined` for a context-less / self-invoked call.

  Action bodies execute trusted (the `ctx.engine` / `ctx.api` facade bypasses RLS/FLS), so a body that must scope by org has to read it from `ctx` — now under the same name a hook author uses. Additive and behavior-preserving; the objectstack-ui skill documents the action-body `ctx` and the `organizationId` read.

- fdc244e: Dev-loop DX fixes from the 15.1 third-party evaluation (P2 batch):

  - **Hot-added objects are now queryable without a restart.** Adding a `*.object.ts` under `os dev` used to recompile "green" while every query answered `no such table` (or `not registered`) until a manual restart: the artifact reload never notified the ObjectQL registry, tables were only created at boot, and seeds only loaded from the boot-time bundle. The `metadata:reloaded` payload now carries the parsed artifact; ObjectQL ingests the object definitions and re-runs the idempotent schema sync (same `skipSchemaSync` opt-out as boot), and the runtime loads seeds for first-seen objects (dev, single-tenant). `os dev` also prints `✚ new object(s): …` on recompile.
  - **Dev admin credentials stay visible.** The `os dev` startup banner only showed `admin@objectos.ai / admin123` on the boot that actually seeded it; with the persistent default DB every later boot hid it, and the Console login page never knew it existed. The hint now re-arms on every dev boot for as long as the account still verifies against the default password, and `GET /api/v1/auth/config` exposes a dev-gated `devSeedAdmin` field (never present outside `NODE_ENV=development`) so the login page can show it.
  - **`os doctor` reference analysis understands current metadata shapes.** Objects bound through `defineView` containers (`list`/`listViews`/`form`/`formViews` → `data.object`, subform `childObject`, lookup form fields) and app navigation (`objectName`, nested `children`, `areas`) were reported as "defined but not referenced". The collector now walks the canonical shapes (plus flow node `config.object`/`objectName`) and the orphan-view check descends into containers.

- 2ea08ee: Flow trigger observability — kill the four-layer silence around record-change flows that never fire (2026-07-17 third-party eval).

  A misauthored auto-launched flow (wrong `objectName`, missing `requires: ['automation','triggers']`, failing start condition) produced ZERO output at every layer: the engine's own registration/binding logs land inside the CLI's boot-quiet stdout window (which swallows debug/info/warn — only error/fatal reach stderr), and each "didn't happen" path was itself silent. Fixes:

  - **Startup banner `Flows:` section** (`os serve`/`os dev`/`os start`): flow count, bound-to-trigger count, registered trigger types, draft count — plus loud `⚠` lines for flows declared with no automation engine enabled (`requires` missing), flows whose trigger type has no registered trigger, and bound record-change flows targeting an unknown object (dead binding). Printed after stdout is restored, so it is immune to the boot-quiet window.
  - **Trigger-fired run failures now log at ERROR** (stderr — always visible): the automation engine no longer drops the AutomationResult of a trigger-fired execution; condition-evaluation faults and node failures surface with the flow name. Condition-not-met skips stay at debug (high-frequency, intentional).
  - **`RecordChangeTrigger` probes object existence at bind time** and warns when a flow's `objectName` matches no registered object (exact-name matching), instead of silently arming a hook that can never fire.
  - **`kernel:bootstrapped` binding audit** in the automation plugin: warns per enabled-but-unbound triggered flow with the reason, and reports registered/bound/draft counts (`AutomationEngine.getTriggerBindingAudit()`, extended `getFlowRuntimeStates()` with `status`/`triggerType`/`object`).
  - **`os validate` flow-wiring advisories** (`@objectstack/lint` `validateFlowTriggerReadiness`): warns when a record-triggered flow targets an object the stack does not define, and when an auto-triggered flow's status is `draft` (authored or defaulted — draft flows still fire; declare `active` or `obsolete`).
  - Removed leftover boot-debug writes (`registerApp`/`AppPlugin`/`StandaloneStack`/`AuditPlugin` stderr noise) that previous debugging of this same silence had left behind.

- d1d1c40: fix(runtime): honor a hook body's declared `timeoutMs` so nested cross-object writes aren't clamped to 250ms (#1867)

  Hook bodies run in the QuickJS sandbox with a default 250ms timeout. The runner
  folded that engine default straight into `Math.min(...)` when resolving the
  effective timeout, so it _always_ dominated for hooks: a body that declared a
  larger `timeoutMs` (the spec permits up to 30_000ms — `ScriptBody.timeoutMs`) to
  give a legitimate nested write — "when a child changes, update the parent" —
  room to settle was silently clamped back to 250ms and killed mid-flight. The
  declared knob was never enforced.

  The engine default is now a FALLBACK used only when no explicit timeout is
  supplied, not a hard ceiling. An explicit `body.timeoutMs` (and/or an enclosing
  hook/action timeout) is honored; when both are present the smaller wins. Bodies
  that declare nothing still get the 250ms hook / 5000ms action default, and a
  body may still LOWER its own timeout below the default.

  This clears the last reliability blocker for nested cross-object writes from
  hooks — the sandbox crash itself (`memory access out of bounds`) was already
  fixed by the deferred-promise host-call model — so header/rollup fields no
  longer need denormalized, hand-maintained workarounds.

- a2d6555: perf(runtime): drop asyncify — sandbox runs on the sync QuickJS variant (ADR-0102 D2, #3296)

  Phase 2 of #3275. The QuickJS sandbox switches from the asyncify build
  (`newAsyncContext`) to the already-installed sync release variant
  (`newQuickJSWASMModule().newContext()`), keeping one physically isolated WASM
  module per invocation (ADR-0102 D2/D4). Asyncify's only justification — suspending
  the WASM stack across a host call — disappeared with the #1867 deferred-promise +
  pump redesign, so nothing depended on it. Wins: smaller binary, faster
  compile/instantiate, faster per-instruction, and removal of an entire class of
  suspended-stack failure modes.

  Also fixes a latent resource leak surfaced by the stricter sync teardown: host
  `ctx.api` calls hand the VM a `vm.newPromise()` deferred that was never
  `dispose()`d (the newPromise contract requires it). The asyncify build tolerated
  the leak; the sync build's `JS_FreeRuntime` aborted (`Assertion failed:
list_empty`) when a context was torn down with a pending, never-settled host call
  (the timeout path). Deferreds are now tracked and disposed before context
  teardown.

  Memory: the sync `QuickJSWASMModule` has no `dispose()`; its WebAssembly instance

  - linear memory are GC-reclaimed when the reference is dropped. A new RSS soak
    test guards that per-invocation modules don't ratchet RSS.

- 3a6310c: perf(runtime): stop the sandbox pump loop from idle-spinning while awaiting a host call (#3233)

  The QuickJS hook/action runner drives a script's async continuations with a
  pump loop that, on every iteration, yielded via `setImmediate` and then drained
  the VM job queue. While the body was only _waiting_ on an in-flight host promise
  (a slow `ctx.api` read/write, or one call that settles after many event-loop
  turns), that queue was empty every iteration, so the loop woke ~200k times/sec
  doing nothing — a ~50,000-iteration burn for a 250ms wait.

  The yield is now adaptive: it stays on `setImmediate` (near-zero latency) while
  the script is making progress, and once a pump executes zero VM jobs it ramps up
  to a small capped `setTimeout` (≤8ms). Any executed job — a settled host call, a
  resumed continuation — resets it to the fast path, so sequential host calls and
  multi-turn work keep their low latency; only a genuinely idle wait backs off.
  Deadline enforcement and every existing pump-budget/timeout/transaction
  guarantee are unchanged.

- 515f11a: fix(seed): replaying seeds no longer corrupts lookup natural keys on the upsert update path

  Every dev-server restart replayed package seeds in upsert mode, and any record whose
  lookup/master_detail was authored as a natural key could have that reference overwritten
  with NULL on the update path (`NOT NULL constraint failed` on required columns; silent
  link loss on nullable ones). Four fixes:

  - An unresolved reference now leaves the column untouched (deferred to pass 2) or drops
    the record loudly — it is never written as NULL over an existing row.
  - DB-side reference resolution probes the target dataset's declared `externalId` (e.g.
    `email`) before falling back to `name` and `id`, matching how in-memory resolution
    already keyed records.
  - A rejected update (e.g. a `state_machine` rule vetoing the replay) no longer severs
    natural-key resolution for downstream child datasets.
  - Replays are idempotent: an upsert/update whose declared fields already match the
    existing row is skipped instead of rewritten (no more `updated_at` churn or lifecycle
    re-validation on every boot).

- 4174a07: feat(runtime): seed-replayer reports `skipped` so hosts can stamp seed-once on progress

  The `seed-replayer` kernel service returned `{ inserted, updated, errors }` but
  not `skipped`. A cloud host therefore could not tell an **all-skip replay**
  (the env's seed data is already present — a no-op) apart from the
  zero-summary early-returns that never ran the loader (no organization, no
  metadata service, no datasets). Both looked like `inserted = updated = 0`, so
  the host could not safely stamp its seed-once record for the all-skip case and
  re-ran the full remote replay on every cold boot.

  Add `skipped: result.summary.totalSkipped` to the replayer's return; the
  early-returns report `skipped: 0`. This lets a host (cloud#853's
  `decideSeedStamp`) stamp on progress — including an all-skip replay — while
  still declining to stamp a genuine no-loader zero-summary. Additive and
  backward compatible; existing consumers ignore the new field.

- ce468c8: feat(observability): decompose `Server-Timing` into auth / db / hooks / serialize spans (perf-tuning mode)

  The opt-in `Server-Timing` header now breaks a request's server time into the phases that actually explain it, so an operator can open DevTools → Network → Timing and see where the time went without standing up an external tracing backend:

  - **`db`** — total SQL time with a **query count**. The SQL driver wires knex's `query` / `query-response` events (keyed by `__knexQueryUid`) and folds each query into one aggregate member (`db;dur=210;desc="6 queries"`) — the query count is the number most useful for spotting N sequential round-trips. Timing is attributed to the originating request via `AsyncLocalStorage`, so it is correct under concurrency and never cross-attributes. SQL text is never emitted, only durations and a count.
  - **`auth`** — identity / session resolution in the dispatcher, the prime suspect for unexplained data-API overhead.
  - **`hooks`** — total business-hook execution time with a hook count, fed through the engine's existing `HookMetricsRecorder` seam (wired from the runtime, so `@objectstack/objectql`'s lean `core` tier stays observability-free).
  - **`serialize`** — response JSON encoding in the HTTP adapter.

  Adds `countServerTiming(name, dur, unit)` (and `PerfTiming.count`) to fold high-frequency phases into a single aggregate member instead of flooding the header. Every phase is a no-op when perf-tuning is off (`serverTiming: true` / `OS_SERVER_TIMING=true`), so there is zero measurable overhead on the normal path.

  Closes #2408.

- Updated dependencies [f972574]
- Updated dependencies [2f3c641]
- Updated dependencies [e38da5b]
- Updated dependencies [f9b118d]
- Updated dependencies [22013aa]
- Updated dependencies [3ad3dd5]
- Updated dependencies [3a18b60]
- Updated dependencies [deb7e7e]
- Updated dependencies [a8aa34c]
- Updated dependencies [e057f42]
- Updated dependencies [a3823b2]
- Updated dependencies [43a3efb]
- Updated dependencies [524696a]
- Updated dependencies [6b51346]
- Updated dependencies [80273c8]
- Updated dependencies [fdc244e]
- Updated dependencies [5e3301d]
- Updated dependencies [dd9f223]
- Updated dependencies [47d923c]
- Updated dependencies [46e876c]
- Updated dependencies [2ea08ee]
- Updated dependencies [616e839]
- Updated dependencies [5f05de2]
- Updated dependencies [021ba4c]
- Updated dependencies [158aa14]
- Updated dependencies [83e8f7d]
- Updated dependencies [d2723e2]
- Updated dependencies [fefcd54]
- Updated dependencies [efbcfe1]
- Updated dependencies [2049b6a]
- Updated dependencies [beaf2de]
- Updated dependencies [06cb319]
- Updated dependencies [369eb6e]
- Updated dependencies [b659111]
- Updated dependencies [5754a23]
- Updated dependencies [6c270a6]
- Updated dependencies [290e2f0]
- Updated dependencies [668dd17]
- Updated dependencies [8abf133]
- Updated dependencies [e0859b1]
- Updated dependencies [92f5f19]
- Updated dependencies [32899e6]
- Updated dependencies [ce468c8]
- Updated dependencies [04ecd4e]
- Updated dependencies [4d5a892]
- Updated dependencies [16cebeb]
- Updated dependencies [86d30af]
- Updated dependencies [8923843]
- Updated dependencies [ea32ec7]
- Updated dependencies [a2795f6]
- Updated dependencies [f16b492]
- Updated dependencies [4b6fde8]
- Updated dependencies [2018df9]
- Updated dependencies [fc5a3a2]
  - @objectstack/spec@16.0.0-rc.0
  - @objectstack/plugin-security@16.0.0-rc.0
  - @objectstack/objectql@16.0.0-rc.0
  - @objectstack/rest@16.0.0-rc.0
  - @objectstack/plugin-auth@16.0.0-rc.0
  - @objectstack/core@16.0.0-rc.0
  - @objectstack/formula@16.0.0-rc.0
  - @objectstack/metadata@16.0.0-rc.0
  - @objectstack/driver-sql@16.0.0-rc.0
  - @objectstack/types@16.0.0-rc.0
  - @objectstack/observability@16.0.0-rc.0
  - @objectstack/metadata-core@16.0.0-rc.0
  - @objectstack/driver-memory@16.0.0-rc.0
  - @objectstack/driver-sqlite-wasm@16.0.0-rc.0
  - @objectstack/service-cluster@16.0.0-rc.0
  - @objectstack/service-datasource@16.0.0-rc.0
  - @objectstack/service-i18n@16.0.0-rc.0

## 15.1.1

### Patch Changes

- Updated dependencies [9dbb883]
- Updated dependencies [01ba3b3]
  - @objectstack/plugin-auth@15.1.1
  - @objectstack/spec@15.1.1
  - @objectstack/core@15.1.1
  - @objectstack/types@15.1.1
  - @objectstack/metadata@15.1.1
  - @objectstack/metadata-core@15.1.1
  - @objectstack/objectql@15.1.1
  - @objectstack/observability@15.1.1
  - @objectstack/formula@15.1.1
  - @objectstack/rest@15.1.1
  - @objectstack/driver-memory@15.1.1
  - @objectstack/driver-sql@15.1.1
  - @objectstack/driver-sqlite-wasm@15.1.1
  - @objectstack/plugin-security@15.1.1
  - @objectstack/service-cluster@15.1.1
  - @objectstack/service-datasource@15.1.1
  - @objectstack/service-i18n@15.1.1

## 15.1.0

### Minor Changes

- f531a26: feat(discovery): honest capabilities — standardized stub/fallback marker + realtime route honesty (ADR-0076 D12/A1.5 framework slice, #2462)

  **Spec** — new service self-description marker for honest discovery
  (ADR-0076 D12): `SERVICE_SELF_INFO_KEY` (`__serviceInfo`),
  `ServiceSelfInfoSchema` / `ServiceSelfInfo`, and `readServiceSelfInfo()`,
  which also normalizes plugin-dev's legacy `_dev: true` flag to
  `{ status: 'stub', handlerReady: false }`. A registered service that is a
  stub / dev fake / degraded fallback self-identifies via this marker; a fully
  real service carries no marker.

  **Runtime + metadata-protocol** — both discovery builders
  (`HttpDispatcher.getDiscoveryInfo` and the protocol shim's `getDiscovery`)
  now honor the marker instead of hardcoding `status: 'available',
handlerReady: true` for every registered service. Dev stubs report `stub`,
  the ObjectQL analytics fallback reports `degraded` (it keeps serving — no
  `/analytics` 404), and consumers can finally trust
  `status === 'available'` / `handlerReady === true`.

  **Realtime honesty fix** — discovery no longer advertises a
  `/realtime` route or `websockets: true`: `service-realtime` is an
  in-process pub/sub bus, no dispatcher branch or plugin mounts any
  `/realtime` HTTP surface, so the advertised route always 404'd. The
  registered service now reports `status: 'degraded', handlerReady: false`
  with no route (clients using the SDK are unaffected — it falls back to the
  conventional path, which behaves exactly as before). Also corrects the
  advertised realtime provider from the nonexistent `plugin-realtime` to
  `service-realtime`.

  **REST (A1.5)** — the REST layer's protocol dependency is narrowed from the
  `ObjectStackProtocol` god-union to the new `RestProtocol =
DataProtocol & MetadataProtocol` slice (exported from
  `@objectstack/rest`), per the ADR-0076 D9 incremental narrowing guidance.
  Type-level only; no runtime change.

- f531a26: feat(protocol): complete ADR-0087 — load-seam handshake, chain backfill 12–15, release artifacts (#2643)

  Closes the remaining ADR-0087 gaps (see the ADR's as-built Addendum):

  - **P0 load seams (D1).** The protocol handshake now runs on the boot-time
    durable-package rehydration path (`@objectstack/service-package` refuses an
    incompatible `sys_packages` row with the structured `OS_PROTOCOL_INCOMPATIBLE`
    diagnostic and keeps booting) and on `AppPlugin` for code-defined stacks
    (fail-fast before the manifest is decomposed). `objectstack lint` gains
    `protocol/missing-engines-range` (warning + fix-it) and the
    `create-objectstack` blank template stamps `engines: { protocol: '^<major>' }`
    (re-stamped at version time by `scripts/sync-template-versions.mjs`) — the
    two ends of the grandfathering ratchet.
  - **Chain backfill (D2/D3).** `MetadataConversion.retiredFromLoadPath`
    implements the load-window's second half (retired entries replay only via
    `migrate meta` / fixture CI). Steps 12–15 land: the `api.requireAuth` flip
    (semantic), the ADR-0090 wave (3 retired conversions + 5 semantic TODOs), the
    `BookAudience` rename (retired conversion), and the ADR-0089 visibility
    unification (`visibleOn`/`visibility` → `visibleWhen` as LIVE load-window
    conversions) + the `.strict()` flip (semantic). The protocol-11
    `compactLayout` → `highlightFields` rename is backfilled as a retired step-11
    conversion. `migrate meta --from 10` now reaches protocol 15.
  - **Release artifacts (D4).** `spec-changes.json` is generated from the
    registries (`gen:spec-changes`, CI drift-checked), ships in the npm artifact
    together with `api-surface.json`, and is attached to each `@objectstack/spec`
    GitHub Release with `added[]`/`removed[]` filled from the api-surface diff
    against the previously published release. The upgrade guide
    (`docs/protocol-upgrade-guide.md`) is generated from the same registries and
    CI drift-checked — a projection that cannot drift.

- f531a26: fix(security): enforce the anonymous-deny posture uniformly across HTTP surfaces (#2567)

  The ADR-0056 D2 `requireAuth` flip made REST `/data/*` deny-anonymous by
  default, but three sibling surfaces reached ObjectQL without passing through the
  gate — so the platform's anonymous posture was **inconsistent by surface**: an
  anonymous caller denied on `/data` could read the same object data through a
  different door. This closes the remaining two gaps (the `/meta` gate had already
  landed) and pins every surface with a conformance row.

  - **Dispatcher GraphQL** (`runtime/http-dispatcher.ts`, `dispatcher-plugin.ts`):
    `POST /graphql` reached `kernel.graphql`, whose security middleware falls
    **open** for an anonymous context. `handleGraphQL` now applies the same
    `requireAuth` gate as `/data` and `/meta`, resolving identity for the direct
    route that does not flow through `dispatch()`. The dispatcher's `requireAuth`
    default is aligned with the REST plugin's (`?? true`) so a bare host no longer
    denies anonymous `/data` while serving the same rows over `/graphql`; an
    explicit `requireAuth: false` opt-out is honoured and logs a boot warning.

  - **Raw-hono standard `/data` routes** (`plugin-hono-server/hono-plugin.ts`):
    these delegate straight to ObjectQL and were only _shadowed_ when the REST
    plugin registered the same paths first — so secure-by-default depended on
    plugin registration order. Each route now consults `requireAuth` (secure by
    default, mirroring `rest-server.ts`), making the deny decision a property of
    this entry point too. Order no longer affects the anonymous posture.

  **Behaviour change:** on a `requireAuth` deployment (the secure default),
  anonymous `POST /graphql` and anonymous raw-hono `/data` now return 401.
  Deployments that intentionally serve these surfaces publicly set
  `requireAuth: false` (a boot warning is logged). Proven end-to-end on the
  platform default in `showcase-anonymous-deny-surfaces.dogfood.test.ts`, with
  handler-level regression coverage in `http-dispatcher.requireauth.test.ts` and
  `hono-anonymous-deny.test.ts`, and pinned by three new authz-conformance rows.

- f531a26: feat(mcp): `aggregate_records` tool — GROUP BY aggregation over the engine read path

  New MCP tool `aggregate_records` (count/sum/avg/min/max/count_distinct, optional
  groupBy incl. date bucketing, where filter, IANA timezone) in the `data:read`
  family. Execution routes through the ObjectQL ENGINE (`callData('aggregate')`
  deliberately never uses the raw per-env driver), so RLS/tenant scoping and the
  D10 delegator intersection apply exactly as on find.

  Security hardening shipped with it:

  - plugin-security: new FLS aggregate-INPUT gate — result masking never runs for
    `aggregate` (output rows carry only aliases), so any groupBy / aggregation
    reference to an FLS-unreadable field is now rejected fail-closed with the
    offending field names (mirrors the FLS write gate).
  - runtime: `aggregate` maps to the `list` ApiMethod in the object exposure gate
    (an object whose `apiMethods` whitelist excludes `list` cannot leak row
    statistics through GROUP BY), and the aggregate action requires at least one
    aggregation (the engine's in-memory path would otherwise degrade to raw rows
    that the FLS masker does not cover).

  The bridge seam is optional: a runtime that does not implement
  `McpDataBridge.aggregate` simply does not register the tool (graceful
  degradation, same contract as the action tools).

### Patch Changes

- f531a26: refactor(security): migrate the handleSecurity admin gate to shouldDenyAnonymous (#2567 follow-up)

  The dispatcher's `/security/suggested-bindings` admin surface was the last HTTP
  seam still hand-rolling the `!userId && !isSystem → 401` check. It now delegates
  to the shared `shouldDenyAnonymous` decision like every other seam — with
  `requireAuth: true` hardcoded, preserving its UNCONDITIONAL semantics (an admin
  surface denies anonymous callers even on a `requireAuth: false` demo deployment).
  The 401 body adopts the shared shape (`code: 'unauthenticated'`).

  Deliberately NOT migrated: `handleNotification`'s `!userId` check — that is a
  "needs a user identity" predicate (the inbox is keyed by userId; a system
  context has no inbox), not an anonymous-posture decision; migrating it would
  change semantics.

- f531a26: refactor(security): converge the anonymous-deny decision into one shared function + a source-enumerating ratchet (#2567 Phase 2)

  Phase 1 gated every HTTP surface (REST `/data`, dispatcher `/graphql` + `/meta`,
  raw-hono `/data`) against the secure-by-default `requireAuth` posture, but each
  seam hand-rolled the same `!userId && !isSystem → 401` check. Phase 2 removes
  that duplication and pins the surfaces so a new ungated entry point fails CI.

  - **New `shouldDenyAnonymous` in `@objectstack/core`** (`security/anonymous-deny.ts`)
    — the single anonymous-deny decision + shared 401 body/constants, mirroring the
    `auth-gate.ts` pattern (pure function so the seams can never drift). All five
    seams — REST `enforceAuth`, dispatcher `handleGraphQL` / `handleMetadata` /
    `handleAI`, hono `denyAnonymous` — now delegate to it. **Pure refactor: no
    runtime behavior change** (verified by the unchanged Phase-1 handler + e2e
    proofs). Identity resolution and the dynamic exemptions (public-form grants,
    share-link tokens) are untouched — they run upstream and only ever hand the
    seam an already-resolved context.
  - **A `discover()` ratchet on the authz-conformance matrix** — it statically
    enumerates the data/meta/graphql HTTP entry points from source (curated
    per-file probes, control-plane routes excluded) and asserts each is classified
    by a matrix `covers` key. A new `/data`/`/meta`/`/graphql` route (or a
    removed/stale `covers`) now fails CI as UNCLASSIFIED / STALE, not in review. A
    companion negative test proves the ratchet bites.

  A design trap is guarded: `isAuthGateAllowlisted(undefined)` returns `true`, so a
  body-routed seam (GraphQL, which has no request path) must pass no path — the
  shared function's non-empty-path guard denies anonymous unconditionally there,
  never falling through to the control-plane allowlist.

- f531a26: fix(authz): carry the derived posture rung on ExecutionContext (#2947)

  The ADR-0095 D2 posture ladder (`PLATFORM_ADMIN > TENANT_ADMIN > MEMBER >
EXTERNAL`) is derived once by the shared authz resolver from capability grants,
  but both HTTP/MCP entry points that build the `ExecutionContext` dropped it —
  so any enforcement-side reader of `context.posture` always saw `undefined`
  (the same drop that forced the explain layer to re-derive it, #2949).

  `ExecutionContextSchema` now carries an optional `posture` field, and both
  `rest-server` and the runtime `resolveExecutionContext` plumb the resolver's
  value through. Additive and **behavior-preserving**: no enforcement decision
  consumes `posture` yet — whether the hot path evaluates _by_ posture remains a
  larger ADR-level decision — this only stops the already-computed value from
  being discarded, so enforcement and explain read the same derived rung.

- f531a26: fix(security): pre-wiring identity admission for the GraphQL and realtime surfaces (#2992, ADR-0096 D4)

  Two latent execution surfaces — neither reachable by a client today — would
  have fallen open the instant a real transport was wired, because both drop or
  lack the caller's identity. Per ADR-0096, the identity story is fixed and
  pinned in CI _before_ wiring, not after an adversarial review:

  - **GraphQL (surface 1 — latent context-drop, now threaded).**
    `handleGraphQL` passed only `{ request }` to `kernel.graphql`, dropping the
    resolved `ExecutionContext` — the moment a real engine resolved objects
    through ObjectQL it would have run context-less (security middleware falls
    OPEN on a missing principal = full authority). The entry point now resolves
    the caller identity even on the direct dispatcher-plugin route and even when
    `requireAuth` is off, and threads it as `options.context`;
    `IGraphQLService.execute` documents that implementations MUST forward it to
    every data-engine call. Unit-proven; the authz conformance matrix pins the
    threading (`graphql-identity-thread` row) so removing it goes STALE and
    fails CI.

  - **realtime (surface 2 — no per-recipient authz seam, posture registered).**
    Delivery is a pure fan-out (subscriptions carry no principal,
    `matchesSubscription` filters only by object+eventTypes, the engine
    publishes the full `after` row), safe only while every subscriber is
    server-internal. The posture is now registered as an `experimental` matrix
    row (`realtime-delivery-authz`) stating the admission requirement
    (per-recipient RLS/FLS/tenant re-check on delivery, or id-only payload +
    client re-fetch), and transport TRIPWIRE probes turn any newly wired
    WebSocket/SSE/subscribe/client transport into an UNCLASSIFIED surface → red
    CI until the identity story ships with it. The `service-realtime` README —
    which advertised `authorizeChannel`/`broadcastToUser`/presence auth that do
    not exist — is rewritten to describe the real, trusted-internal-only
    surface, and the contract docs carry the admission requirement at the seam.

- f531a26: Surface standalone authored `action` metadata rows on the MCP action bridge (#3010). `list_actions` and `run_action` now resolve declarations from `object.actions` unioned with standalone `action` items, keyed the same way the engine registers their handlers (`objectName` → legacy `object` → `'global'`), with object-embedded declarations winning on a key clash. Previously a Studio-authored standalone action executed via REST but was invisible and uninvokable on the MCP/AI surface, even with `ai.exposed: true`. All invoke-time gates (`ai.exposed` fail-closed, ADR-0066 D4 capability gate, sys\_\* fail-closed) are unchanged.
- f531a26: fix(plugin-auth): re-run membership backfill when app seeding settles (#2996)

  The ADR-0093 D6 membership backfill — the only safety net for users created
  by app seeds (raw `engine.insert` into `sys_user` bypasses better-auth's
  `user.create.after` reconciler) — ran only once on `kernel:ready`. When a seed
  bundle overruns its inline budget (`OS_INLINE_SEED_BUDGET_MS`, default 8s) it
  finishes in the background _after_ `kernel:ready`, so its users stayed
  member-less in single-org `auto` mode until the next restart re-ran the backfill.

  `AppPlugin` now emits a new **`app:seeded`** lifecycle event when an app's inline
  seed settles (success, partial, or fallback) — carrying `{ appId, overBudget }`,
  where `overBudget: true` marks the post-`kernel:ready` background case. plugin-auth
  subscribes and re-runs the (idempotent, self-guarding, opt-out-able)
  `backfillMemberships` on that signal, closing the window without waiting for a
  restart. No behavior change when a seed completes within budget, in multi-tenant
  mode, or under `invite-only` policy; `OS_SKIP_MEMBERSHIP_BACKFILL=1` still opts out.

- f531a26: fix(security): enforce the `ai.exposed` opt-in on the MCP action surface (#2849)

  Business-action bodies execute as trusted code: their engine facade carries no
  `ExecutionContext`, so a body's internal reads/writes bypass RLS/FLS/CRUD and
  tenant scoping — the caller's permissions and an agent's ADR-0090 D10 data
  ceiling do NOT bound what an invoked action does. The MCP `run_action` bridge
  nevertheless allowed invoking ANY headless action, ignoring the spec's
  `ai.exposed` governance gate (ADR-0011) entirely.

  The MCP bridge now fail-closes on `ai.exposed`: `list_actions` only enumerates
  — and `run_action` only dispatches — actions the app author explicitly opted
  into the AI surface with `ai: { exposed: true, description }`. Flow-type
  actions additionally receive the caller's identity (`userId` / `positions` /
  `permissions` / `tenantId`) as a proper `AutomationContext` (replacing the
  former `triggerData` envelope the engine never read), so a `runAs: 'user'`
  flow enforces RLS as the invoker instead of running unscoped (ADR-0049).
  Trusted body dispatches are now audit-logged on both the MCP and REST action
  paths, and the MCP tool/README/docs wording no longer claims action bodies run
  under the caller's RLS.

  Migration: actions that should stay invokable by AI agents through MCP must
  declare `ai: { exposed: true, description: '…' }` (≥40-char description). All
  other invocation surfaces (UI, REST `/actions/...`) are unchanged.

- Updated dependencies [f531a26]
- Updated dependencies [f531a26]
- Updated dependencies [f531a26]
- Updated dependencies [f531a26]
- Updated dependencies [f531a26]
- Updated dependencies [f531a26]
- Updated dependencies [3fe9df1]
- Updated dependencies [f531a26]
- Updated dependencies [f531a26]
- Updated dependencies [f531a26]
- Updated dependencies [f531a26]
- Updated dependencies [f531a26]
- Updated dependencies [f531a26]
- Updated dependencies [f531a26]
- Updated dependencies [f531a26]
- Updated dependencies [f531a26]
- Updated dependencies [f531a26]
- Updated dependencies [f531a26]
- Updated dependencies [f531a26]
- Updated dependencies [f531a26]
- Updated dependencies [f531a26]
- Updated dependencies [f531a26]
- Updated dependencies [f531a26]
- Updated dependencies [f531a26]
- Updated dependencies [f531a26]
- Updated dependencies [f531a26]
- Updated dependencies [4109153]
- Updated dependencies [f531a26]
- Updated dependencies [f531a26]
- Updated dependencies [f531a26]
- Updated dependencies [f531a26]
- Updated dependencies [f531a26]
- Updated dependencies [f531a26]
- Updated dependencies [f531a26]
- Updated dependencies [f531a26]
- Updated dependencies [f531a26]
- Updated dependencies [f531a26]
- Updated dependencies [f531a26]
- Updated dependencies [f531a26]
- Updated dependencies [f531a26]
- Updated dependencies [627f225]
- Updated dependencies [f531a26]
- Updated dependencies [f531a26]
- Updated dependencies [f531a26]
- Updated dependencies [f531a26]
- Updated dependencies [f531a26]
- Updated dependencies [f531a26]
- Updated dependencies [d75c7ac]
- Updated dependencies [f531a26]
  - @objectstack/spec@15.1.0
  - @objectstack/objectql@15.1.0
  - @objectstack/rest@15.1.0
  - @objectstack/core@15.1.0
  - @objectstack/plugin-security@15.1.0
  - @objectstack/plugin-auth@15.1.0
  - @objectstack/types@15.1.0
  - @objectstack/formula@15.1.0
  - @objectstack/metadata@15.1.0
  - @objectstack/metadata-core@15.1.0
  - @objectstack/observability@15.1.0
  - @objectstack/driver-memory@15.1.0
  - @objectstack/driver-sql@15.1.0
  - @objectstack/driver-sqlite-wasm@15.1.0
  - @objectstack/service-cluster@15.1.0
  - @objectstack/service-datasource@15.1.0
  - @objectstack/service-i18n@15.1.0

## 15.0.0

### Minor Changes

- e62c233: feat(spec,plugin-security): package-level capability declaration API (ADR-0066 D1)

  Packages can now DEFINE their own authorization capabilities explicitly via the
  new `defineCapability` factory and a stack's `capabilities` array, instead of
  relying on the implicit "derive an untitled capability from whatever a permission
  set references in `systemPermissions[]`" back-door.

  - `@objectstack/spec`: new `defineCapability` / `CapabilityDeclarationSchema`
    (`{ name, label?, description?, scope, packageId? }`) and a `capabilities`
    field on the stack definition.
  - `@objectstack/plugin-security`: new `bootstrapDeclaredCapabilities` seeds
    declared capabilities into `sys_capability` with `managed_by:'package'` +
    `package_id` provenance (new `package_id` field on the object). Idempotent,
    upgrade-aware; refuses to hijack curated platform capabilities or another
    package's rows, never clobbers admin-authored rows, and CLAIMS a pre-existing
    derived placeholder (upgrading it to package provenance). The implicit
    derive-from-`systemPermissions` path still runs for back-compat but now skips
    any explicitly-declared name so it can't clobber authored metadata.
  - `@objectstack/runtime`: stack-declared `capabilities` are registered into the
    metadata registry (type `capability`) so the boot seeder can read them.
  - `@objectstack/lint`: `validateCapabilityReferences` treats
    `stack.capabilities` names as a known capability source.

  A capability is not a contract: DEFINE it (`defineCapability`), GRANT it
  (`systemPermissions`), REQUIRE it (`requiredPermissions`) — no `inputs`.
  Aligns with ADR-0094 D5 (retire implicit `managed_by`-guessing back-doors).

### Patch Changes

- Updated dependencies [28b7c28]
- Updated dependencies [0fcef9b]
- Updated dependencies [13749ec]
- Updated dependencies [ca2b2f6]
- Updated dependencies [2ae78c6]
- Updated dependencies [5febe3f]
- Updated dependencies [e62c233]
- Updated dependencies [ed61c9b]
- Updated dependencies [698454e]
- Updated dependencies [29a4c90]
- Updated dependencies [ef70521]
- Updated dependencies [a581a65]
- Updated dependencies [31d04d4]
- Updated dependencies [5774a75]
  - @objectstack/spec@15.0.0
  - @objectstack/plugin-security@15.0.0
  - @objectstack/core@15.0.0
  - @objectstack/rest@15.0.0
  - @objectstack/objectql@15.0.0
  - @objectstack/metadata@15.0.0
  - @objectstack/plugin-auth@15.0.0
  - @objectstack/formula@15.0.0
  - @objectstack/observability@15.0.0
  - @objectstack/driver-memory@15.0.0
  - @objectstack/driver-sql@15.0.0
  - @objectstack/driver-sqlite-wasm@15.0.0
  - @objectstack/service-cluster@15.0.0
  - @objectstack/service-datasource@15.0.0
  - @objectstack/service-i18n@15.0.0
  - @objectstack/types@15.0.0

## 14.8.0

### Patch Changes

- Updated dependencies [16b4bf6]
- Updated dependencies [16b4bf6]
- Updated dependencies [10e8983]
- Updated dependencies [a199626]
- Updated dependencies [84650c5]
- Updated dependencies [607aaf4]
- Updated dependencies [e46169c]
- Updated dependencies [f0acf25]
- Updated dependencies [712328a]
- Updated dependencies [1dede32]
- Updated dependencies [bb71321]
- Updated dependencies [a199626]
  - @objectstack/spec@14.8.0
  - @objectstack/plugin-security@14.8.0
  - @objectstack/driver-sql@14.8.0
  - @objectstack/rest@14.8.0
  - @objectstack/driver-sqlite-wasm@14.8.0
  - @objectstack/core@14.8.0
  - @objectstack/formula@14.8.0
  - @objectstack/metadata@14.8.0
  - @objectstack/objectql@14.8.0
  - @objectstack/observability@14.8.0
  - @objectstack/driver-memory@14.8.0
  - @objectstack/plugin-auth@14.8.0
  - @objectstack/service-cluster@14.8.0
  - @objectstack/service-datasource@14.8.0
  - @objectstack/service-i18n@14.8.0
  - @objectstack/types@14.8.0

## 14.7.0

### Patch Changes

- Updated dependencies [d6a72eb]
- Updated dependencies [da5e686]
- Updated dependencies [824a395]
  - @objectstack/spec@14.7.0
  - @objectstack/plugin-auth@14.7.0
  - @objectstack/types@14.7.0
  - @objectstack/plugin-security@14.7.0
  - @objectstack/core@14.7.0
  - @objectstack/formula@14.7.0
  - @objectstack/metadata@14.7.0
  - @objectstack/objectql@14.7.0
  - @objectstack/observability@14.7.0
  - @objectstack/driver-memory@14.7.0
  - @objectstack/driver-sql@14.7.0
  - @objectstack/driver-sqlite-wasm@14.7.0
  - @objectstack/rest@14.7.0
  - @objectstack/service-cluster@14.7.0
  - @objectstack/service-datasource@14.7.0
  - @objectstack/service-i18n@14.7.0

## 14.6.0

### Patch Changes

- Updated dependencies [609cb13]
- Updated dependencies [160d565]
- Updated dependencies [e4cf774]
- Updated dependencies [ce6d151]
- Updated dependencies [8f4a261]
- Updated dependencies [6e2b8ae]
  - @objectstack/spec@14.6.0
  - @objectstack/plugin-auth@14.6.0
  - @objectstack/driver-sql@14.6.0
  - @objectstack/objectql@14.6.0
  - @objectstack/plugin-security@14.6.0
  - @objectstack/core@14.6.0
  - @objectstack/formula@14.6.0
  - @objectstack/metadata@14.6.0
  - @objectstack/observability@14.6.0
  - @objectstack/driver-memory@14.6.0
  - @objectstack/driver-sqlite-wasm@14.6.0
  - @objectstack/rest@14.6.0
  - @objectstack/service-cluster@14.6.0
  - @objectstack/service-datasource@14.6.0
  - @objectstack/service-i18n@14.6.0
  - @objectstack/types@14.6.0

## 14.5.0

### Minor Changes

- 261aff5: ADR-0090 D10 (follow-up) — an MCP agent may now invoke the business **actions** its delegating user can run, gated by the `actions:execute` scope. Previously an agent principal carried no system capabilities, so any capability-gated action (`requiredPermissions`) was denied even when the user was entitled to it.

  `resolve-execution-context` now keeps the delegating user's `systemPermissions` on the agent context **only when the token carries `actions:execute`** (otherwise none — and the MCP tool surface already hides the action tools). The `actions:execute` scope is the user's explicit consent to let the agent act on their behalf, so the capability gate (`actionPermissionError`) is delegated accordingly.

  This never widens the agent's **data** reach: what an action reads or writes still flows through the object CRUD/FLS/RLS ceiling ∩ user intersection. A `data:read` agent that invokes a writing action is still blocked at the write; even a `data:write` agent cannot touch better-auth-managed tables; and capability-gated **object** access stays denied to the agent (that gate is driven by the resolved ceiling sets, which carry no capabilities). The residual is a capability-gated action whose effect is purely external (email, webhook) — exactly what `actions:execute` consents to. Tighter per-action agent scoping is the per-client-grants follow-up.

- d79ca07: ADR-0090 D10 — activate the agent principal (OAuth → `principalKind:'agent'` + scope-derived ceiling). This wires the _producer_ side of the D10 intersection that shipped in #2838, so it stops being dormant: an MCP request authenticated with an OAuth access token is now resolved as an AI **agent acting on behalf of** the human `sub`, and its effective permission is the intersection of a scope-derived capability ceiling AND the user's own grants.

  - **`resolve-execution-context` (producer)**: when a verified MCP OAuth token names an authorized client (`azp`), the request resolves to `principalKind:'agent'` with `onBehalfOf:{ userId }` (the human), and the agent's OWN grants are replaced by the scope-derived ceiling — `data:read` → read-only, `data:write` → full CRUD, neither → no data access. `userId` stays the human so owner-stamping and `current_user.*` RLS resolve to them; the user-derived `systemPermissions` are cleared so a cap-gated action can't ride the user's capabilities. A token without a client stays a `human` principal.
  - **`plugin-security`**: three built-in ceiling sets (`mcp_agent_data_read` / `mcp_agent_data_write` / `mcp_agent_restricted`) — pure CRUD bits, no row-level security (all row/owner/tenant narrowing comes from the delegating user on the other side of the intersection). An `agent` principal skips the additive human baseline (`member_default`) — its grants are exactly its ceiling — and its fallback is the restricted (no-object-access) set, so a mis-resolved agent fails CLOSED, never open.
  - **`spec`**: `MCP_AGENT_PERMISSION_SET_*` names + `scopesToAgentPermissionSets()`, single-sourced next to the OAuth scope constants.

  **Behaviour change (a security tightening).** Previously an MCP OAuth request executed with the FULL authority of the logged-in user, and scopes narrowed only the tool surface. Now the scope is also a real data-layer ceiling: a `data:read` token can never write ANY record, even via a crafted call, no matter what the user could do. This is strictly consistent with the existing contract that "a scope can never grant more than the user could do" — the intersection only ever narrows — and closes the gap where a compromised or confused agent could act with the user's full reach.

  Verified end-to-end: a `data:read` agent acting for a member who owns a record can read it but cannot edit or create; a `data:write` agent for the same user can. Producer mapping unit-tested in `@objectstack/runtime`; enforcement dogfooded against the served engine (`showcase-agent-scope-ceiling`).

### Patch Changes

- 5f43f88: **Security fix (#2852): `/analytics/query` and `/analytics/sql` now run scoped to the caller.**

  `handleAnalytics` dropped the request's execution context — `analyticsService.query(body)` was called with no context, so the analytics service's per-object read-scope provider (`getReadScope` → security `getReadFilter`) received `undefined` and applied **no tenant/RLS filter**. An authenticated caller could query analytics datasets and receive rows their row-level security would otherwise hide.

  Fix: thread `context.executionContext` into `analyticsService.query(…)` and `generateSql(…)` (both already accept it), so each object in the query is scoped by its per-object read filter.

  Note: the analytics read-scope provider (`getReadFilter`) does not yet apply the ADR-0090 D10 agent delegator intersection — latent today because analytics is not reachable over the OAuth `/mcp` surface; tracked in #2852 for when it is.

- Updated dependencies [526805e]
- Updated dependencies [f70eb2c]
- Updated dependencies [d79ca07]
- Updated dependencies [a348394]
- Updated dependencies [4d9dd7b]
- Updated dependencies [5bced2f]
- Updated dependencies [3fd87b2]
- Updated dependencies [33ebd34]
- Updated dependencies [e2c05d6]
- Updated dependencies [c044f08]
- Updated dependencies [01274eb]
  - @objectstack/spec@14.5.0
  - @objectstack/plugin-security@14.5.0
  - @objectstack/plugin-auth@14.5.0
  - @objectstack/rest@14.5.0
  - @objectstack/objectql@14.5.0
  - @objectstack/core@14.5.0
  - @objectstack/formula@14.5.0
  - @objectstack/metadata@14.5.0
  - @objectstack/observability@14.5.0
  - @objectstack/driver-memory@14.5.0
  - @objectstack/driver-sql@14.5.0
  - @objectstack/driver-sqlite-wasm@14.5.0
  - @objectstack/service-cluster@14.5.0
  - @objectstack/service-datasource@14.5.0
  - @objectstack/service-i18n@14.5.0
  - @objectstack/types@14.5.0

## 14.4.0

### Patch Changes

- Updated dependencies [7953832]
- Updated dependencies [82e745e]
- Updated dependencies [f3035bd]
- Updated dependencies [82c0d94]
- Updated dependencies [9887465]
- Updated dependencies [7449476]
  - @objectstack/spec@14.4.0
  - @objectstack/objectql@14.4.0
  - @objectstack/driver-sql@14.4.0
  - @objectstack/driver-sqlite-wasm@14.4.0
  - @objectstack/core@14.4.0
  - @objectstack/plugin-security@14.4.0
  - @objectstack/plugin-auth@14.4.0
  - @objectstack/formula@14.4.0
  - @objectstack/metadata@14.4.0
  - @objectstack/observability@14.4.0
  - @objectstack/driver-memory@14.4.0
  - @objectstack/rest@14.4.0
  - @objectstack/service-cluster@14.4.0
  - @objectstack/service-datasource@14.4.0
  - @objectstack/service-i18n@14.4.0
  - @objectstack/types@14.4.0

## 14.3.0

### Patch Changes

- Updated dependencies [2a71f48]
- Updated dependencies [02f6af4]
- Updated dependencies [8f0b9df]
- Updated dependencies [ff648ad]
- Updated dependencies [c1064f1]
- Updated dependencies [bea4b92]
  - @objectstack/plugin-auth@14.3.0
  - @objectstack/rest@14.3.0
  - @objectstack/spec@14.3.0
  - @objectstack/plugin-security@14.3.0
  - @objectstack/metadata@14.3.0
  - @objectstack/objectql@14.3.0
  - @objectstack/core@14.3.0
  - @objectstack/formula@14.3.0
  - @objectstack/observability@14.3.0
  - @objectstack/driver-memory@14.3.0
  - @objectstack/driver-sql@14.3.0
  - @objectstack/driver-sqlite-wasm@14.3.0
  - @objectstack/service-cluster@14.3.0
  - @objectstack/service-datasource@14.3.0
  - @objectstack/service-i18n@14.3.0
  - @objectstack/types@14.3.0

## 14.2.0

### Patch Changes

- Updated dependencies [ac8f029]
- Updated dependencies [4ab9958]
  - @objectstack/plugin-security@14.2.0
  - @objectstack/spec@14.2.0
  - @objectstack/service-datasource@14.2.0
  - @objectstack/core@14.2.0
  - @objectstack/formula@14.2.0
  - @objectstack/metadata@14.2.0
  - @objectstack/objectql@14.2.0
  - @objectstack/observability@14.2.0
  - @objectstack/driver-memory@14.2.0
  - @objectstack/driver-sql@14.2.0
  - @objectstack/driver-sqlite-wasm@14.2.0
  - @objectstack/plugin-auth@14.2.0
  - @objectstack/rest@14.2.0
  - @objectstack/service-cluster@14.2.0
  - @objectstack/service-i18n@14.2.0
  - @objectstack/types@14.2.0

## 14.1.0

### Patch Changes

- Updated dependencies [5a8465f]
- Updated dependencies [7f8620b]
- Updated dependencies [82ba3a6]
  - @objectstack/spec@14.1.0
  - @objectstack/core@14.1.0
  - @objectstack/formula@14.1.0
  - @objectstack/metadata@14.1.0
  - @objectstack/objectql@14.1.0
  - @objectstack/observability@14.1.0
  - @objectstack/driver-memory@14.1.0
  - @objectstack/driver-sql@14.1.0
  - @objectstack/driver-sqlite-wasm@14.1.0
  - @objectstack/plugin-auth@14.1.0
  - @objectstack/plugin-security@14.1.0
  - @objectstack/rest@14.1.0
  - @objectstack/service-cluster@14.1.0
  - @objectstack/service-datasource@14.1.0
  - @objectstack/service-i18n@14.1.0
  - @objectstack/types@14.1.0

## 14.0.0

### Minor Changes

- bc26360: feat(mcp): `GET /api/v1/mcp/skill` — download the environment-customized Agent Skill

  `renderSkillMarkdown()` was export-only; nothing served it over HTTP, so the
  "one generic skill" distributable (ADR-0036 Amendment C) had no self-serve
  outlet. The runtime dispatcher now serves it at `GET /api/v1/mcp/skill` as
  `text/markdown` — public like `/discovery` (generic agent instructions plus a
  URL the caller already knows; no schema, no tenant data), gated on the same
  default-on MCP switch (404 when opted out), 501 when the MCP plugin isn't
  loaded. The environment URL comes from the auth service's canonical
  `getMcpResourceUrl()` with a request-host fallback. `MCPServerRuntime` gains
  `renderSkill()` so hosts reach the renderer via the registered `'mcp'`
  service without a package dependency. Feeds the Setup "Connect an agent"
  page (objectui#2363) and the distribution shells (#2714).

- bd39dc5: ADR-0090 D5/D9 — suggested audience bindings become a queryable, confirmable surface.

  A package permission set declaring `isDefault: true` is an install-time
  SUGGESTION to bind the set to the built-in `everyone` position — never
  auto-bound. Until now the flag was only read at bootstrap as the fallback-set
  name; after an install there was no way to see or act on the suggestion.

  **`@objectstack/plugin-security`**: new `sys_audience_binding_suggestion`
  system object (read-only over the data API; unique per
  package × set × anchor) plus a convergent reconciler
  (`syncAudienceBindingSuggestions`) that reads every declared `isDefault` set —
  boot-declared stack metadata AND installed package manifests, so a runtime
  `POST /api/v1/packages` install is visible immediately — and keeps the table
  honest: undeclared → pending row pruned, bound out-of-band → marked
  `confirmed` (observed). The `security` service gains
  `listAudienceBindingSuggestions` / `confirmAudienceBindingSuggestion` /
  `dismissAudienceBindingSuggestion`, all pre-gated on tenant-level admin
  (ADR-0066 superuser wildcard — anchors stay tenant-level only per D12).
  Confirm writes the `sys_position_permission_set` row **with the caller's
  execution context**, so the D5/D9 audience-anchor gate (no high-privilege
  set on `everyone`/`guest`) and the D12 delegated-admin gate enforce the
  binding; a set not yet materialized (installed this session) is first
  seeded through the same provenance-checked upsert as the boot seeder
  (ADR-0086 D4).

  **`@objectstack/rest`** and **`@objectstack/runtime`**: the HTTP surface,
  registered on both API layers (the RestServer that `objectstack dev`/hono
  serves, and the runtime HttpDispatcher used by the adapters) —
  `GET /api/v1/security/suggested-bindings?status=&packageId=`,
  `POST /api/v1/security/suggested-bindings/:id/confirm`,
  `POST /api/v1/security/suggested-bindings/:id/dismiss` (401 unauthenticated,
  403/404/409 mapped from the service's typed errors, 501/503 without
  plugin-security).

### Patch Changes

- 57b8fe0: fix(runtime): action body `ctx.user` now reflects the session operator, not `system`

  The `POST /actions/:object/:action` route called `handleActions` directly,
  bypassing `dispatcher.dispatch()` — so `resolveExecutionContext` never ran and
  the action handler's `ctx.user` was hard-coded to `{ id: 'system' }`. Handlers
  could not branch on the operator's identity or business roles, nor enforce
  server-side ownership. (#2701)

  - The action routes now dispatch through `dispatch()` like the automation/AI
    routes, so the per-request pipeline resolves the session identity (and swaps
    to the per-project kernel) before the action body runs.
  - `handleActions` builds `ctx.user` from the resolved `ExecutionContext`,
    exposing `id`, `email`, `roles`/`positions` (ADR-0090 business roles),
    `permissions`, and `tenantId` — matching the MCP `runAction` and
    record-change trigger paths. It falls back to a `system` principal only for a
    genuinely anonymous / self-invoked call.

  No authoring change is required: action handlers that previously always saw
  `ctx.user.id === 'system'` will now see the real caller.

- Updated dependencies [0a8e685]
- Updated dependencies [afa8115]
- Updated dependencies [80f12ca]
- Updated dependencies [e2fa074]
- Updated dependencies [ac08698]
- Updated dependencies [23c8668]
- Updated dependencies [29f017d]
- Updated dependencies [afa8115]
- Updated dependencies [216fa9a]
- Updated dependencies [6c22b12]
- Updated dependencies [d0531c4]
- Updated dependencies [cff5aac]
- Updated dependencies [bd39dc5]
- Updated dependencies [1056c5f]
  - @objectstack/spec@14.0.0
  - @objectstack/plugin-security@14.0.0
  - @objectstack/rest@14.0.0
  - @objectstack/driver-sql@14.0.0
  - @objectstack/objectql@14.0.0
  - @objectstack/core@14.0.0
  - @objectstack/formula@14.0.0
  - @objectstack/metadata@14.0.0
  - @objectstack/observability@14.0.0
  - @objectstack/driver-memory@14.0.0
  - @objectstack/driver-sqlite-wasm@14.0.0
  - @objectstack/plugin-auth@14.0.0
  - @objectstack/service-cluster@14.0.0
  - @objectstack/service-datasource@14.0.0
  - @objectstack/service-i18n@14.0.0
  - @objectstack/types@14.0.0

## 13.0.0

### Major Changes

- 6d83431: ADR-0090 P1 breaking wave — permission model v2 concept convergence.

  Pre-launch one-step renames and secure defaults (no compatibility aliases, per
  ADR-0090 D3/D4 superseding ADR-0057 D5/D7's alias discipline):

  - `sys_role` → `sys_position`, `sys_user_role` → `sys_user_position` (field
    `role` → `position`), `sys_role_permission_set` → `sys_position_permission_set`
    (field `role_id` → `position_id`); `RoleSchema`/`defineRole` →
    `PositionSchema`/`definePosition` with **no `parent`** (positions are flat;
    hierarchy lives on the business-unit tree).
  - `ExecutionContext.roles[]` → `positions[]`; the EvalUser/CEL contract
    `current_user.roles` → `current_user.positions` (formula validators updated);
    stack property `roles:` → `positions:`; metadata kinds `role`/`profile` →
    `position` (profile kind removed).
  - `isProfile` removed from `PermissionSetSchema` (ADR-0090 D2); `isDefault`
    narrows to an install-time suggestion; `appDefaultProfileName` →
    `appDefaultPermissionSetName` (isDefault-only).
  - OWD enum drops legacy aliases `read`/`read_write`/`full`; new optional
    `externalSharingModel` (external dial, `private` default) lands as P1 spec
    shape (ADR-0090 D11).
  - **Secure default (D1)**: a custom object with an owner field and NO
    `sharingModel` now resolves `private` (was: fully public). System objects
    keep their explicit posture. Unrecognised stored values fail closed.
  - ExecutionContext gains the P1 principal-taxonomy shape (D10):
    `principalKind` / `audience` / `onBehalfOf` (optional, semantics phase in
    later).
  - Sharing recipients: `role` → `position` (expanded via `sys_user_position`
    ∪ the better-auth membership transition source); `role_and_subordinates`
    removed — `unit_and_subordinates` now expands the business-unit subtree
    (finishes ADR-0057 D5's re-homing).

### Minor Changes

- 01917c2: ADR-0090 P2 — audience anchors: `everyone`/`guest` builtin positions.

  - `EVERYONE_POSITION` / `GUEST_POSITION` constants in `@objectstack/spec`;
    both anchors seeded (system-managed) alongside the builtin identity names.
  - Every authenticated principal implicitly holds `everyone` in
    `ctx.positions`, so sets bound to it resolve as ordinary position-bound
    grants — ADDITIVE. The fallback CLIFF is abolished: the configured
    baseline (`fallbackPermissionSet`, default `member_default`) now applies
    in addition to explicit grants instead of only when the user had none,
    and is also seeded as an `everyone` binding (same table/audit/explain
    path as admin-authored defaults).
  - Sessionless HTTP principals resolve as `principalKind: 'guest'` holding
    exactly `['guest']`; internal bare contexts are untouched.
  - Audience-anchor binding gate: `sys_position_permission_set` writes that
    would bind a high-privilege set (VAMA, delete/purge/transfer, system
    permissions, `'*'` wildcard) to `everyone`/`guest` are rejected at the
    data layer, unconditionally (`describeHighPrivilegeBits` predicate is
    exported and shared with the seed-time validation).

- 57b89b4: feat(mcp): the MCP surface is now **default-on** — a core platform capability (#2698)

  `/api/v1/mcp` is served (and advertised in `/discovery`) out of the box; the
  OAuth 2.1 authorization track and Dynamic Client Registration follow it, so a
  fresh deployment is connectable by any MCP client with zero configuration.
  Operators opt OUT with `OS_MCP_SERVER_ENABLED=false`.

  - New single decision point `isMcpServerEnabled()` in `@objectstack/types`
    (default on; explicit `false`/`0`/`off`/`no` disables). The runtime
    dispatcher's `/mcp` route gate, the CLI's MCP plugin auto-load, the REST
    `/discovery` advertisement, and the auth service's OAuth/DCR follow-defaults
    all delegate to it — the served route, the advertised route, and the
    authorization track can never disagree.
  - The env var is now effectively tri-state: unset → HTTP surface on;
    explicit `true` → additionally auto-start the long-lived **stdio** transport
    at boot (unchanged, still opt-in — a default must not claim the process's
    stdin/stdout); explicit `false` → everything off, fail-closed (404, no
    metadata, no DCR).
  - The OAuth 2.1 TLS rule is unaffected: on a plain-HTTP non-loopback origin
    the OAuth track stays dark and the default-on surface remains API-key-only.

- 5be00c3: feat(mcp): spec-compliant OAuth 2.1 authorization for `/api/v1/mcp` (#2698)

  Any OAuth-capable MCP client (claude.ai custom connectors, Claude Desktop,
  Claude Code) can now connect to a deployment **self-serve**: no admin-minted
  API key, no central registry — you sign in through the browser as yourself and
  every tool call runs under your own permissions and row-level security.

  **Each deployment is its own authorization server**, backed by the embedded
  better-auth instance (`@better-auth/oauth-provider`). Rationale for the design
  decisions lives in #2698; the moving parts:

  - **Discovery**: `/.well-known/oauth-protected-resource` (RFC 9728, incl. the
    path-inserted variant for `/api/v1/mcp`) and
    `/.well-known/oauth-authorization-server` (RFC 8414, incl. the path-inserted
    variant for the `/api/v1/auth` issuer) are served from the deployment origin.
    401s from `/api/v1/mcp` advertise the resource metadata via
    `WWW-Authenticate`, so clients bootstrap the flow automatically.
  - **Dynamic Client Registration (RFC 7591)** is enabled (unauthenticated, as
    the MCP spec requires) whenever the MCP surface is on — every deployment is a
    distinct AS, so clients cannot ship pre-registered IDs. Force it either way
    with `OS_OIDC_DCR_ENABLED` or the new `plugins.dynamicClientRegistration`
    auth-config field. The embedded AS itself auto-enables whenever the MCP
    surface is on — which is now the default (explicit
    `OS_OIDC_PROVIDER_ENABLED=false` still wins).
  - **Authorization-code + PKCE** flow with RFC 8707 resource binding: access
    tokens are minted with `aud=<origin>/api/v1/mcp` and verified locally
    (signature/issuer/audience/expiry) against the deployment's own JWKS —
    fail-closed parity with API keys: unknown/expired/wrong-audience tokens,
    sub-less M2M tokens, or a presented-but-invalid bearer never fall back to an
    ambient session, they 401.
  - **Token → ExecutionContext**: a valid access token resolves to the same
    principal-bound `ExecutionContext` as every other credential, single-sourced
    through `resolveAuthzContext` — OAuth adds a second _provenance_ for the
    principal, not a second authz model. `ExecutionContext` gains an optional
    `oauthScopes` field carrying the token's granted scopes.
  - **Coarse scopes → tool families**, enforced at tool dispatch: `data:read`
    (list/describe/query/get), `data:write` (create/update/delete),
    `actions:execute` (list_actions/run_action). Constants live in
    `@objectstack/spec/ai` (`MCP_OAUTH_SCOPES`). Tools outside the grant are not
    registered — and therefore rejected — for that request. API-key and session
    principals are unaffected (not scope-limited).
  - **TLS required, localhost exempt** (OAuth 2.1): on a plain-HTTP non-loopback
    origin the OAuth track stays dark (no metadata, no bearer acceptance) and the
    endpoint remains API-key-only. Local clients reach intranet deployments;
    claude.ai web connectors additionally need public HTTPS reachability.

  **API keys are unchanged** (dual-track): `x-api-key` / `Authorization: ApiKey` /
  `Authorization: Bearer osk_…` keep working exactly as before for CI and
  headless agents — covered by new regression tests.

### Patch Changes

- Updated dependencies [6d83431]
- Updated dependencies [01917c2]
- Updated dependencies [b271691]
- Updated dependencies [a5a1e41]
- Updated dependencies [466adf6]
- Updated dependencies [799b285]
- Updated dependencies [57b89b4]
- Updated dependencies [5be00c3]
- Updated dependencies [466adf6]
- Updated dependencies [a1766fe]
- Updated dependencies [2bee609]
- Updated dependencies [fc7e7f7]
  - @objectstack/spec@13.0.0
  - @objectstack/core@13.0.0
  - @objectstack/objectql@13.0.0
  - @objectstack/formula@13.0.0
  - @objectstack/rest@13.0.0
  - @objectstack/plugin-security@13.0.0
  - @objectstack/plugin-auth@13.0.0
  - @objectstack/metadata@13.0.0
  - @objectstack/types@13.0.0
  - @objectstack/observability@13.0.0
  - @objectstack/driver-memory@13.0.0
  - @objectstack/driver-sql@13.0.0
  - @objectstack/driver-sqlite-wasm@13.0.0
  - @objectstack/service-cluster@13.0.0
  - @objectstack/service-datasource@13.0.0
  - @objectstack/service-i18n@13.0.0

## 12.6.0

### Patch Changes

- b5a87eb: Sandbox: stop `QuickJSScriptRunner` from crashing when a hook context holds a non-serialisable host object.

  `installCtx` marshalled `ctx` into the QuickJS sandbox with a bare `JSON.stringify`. If the context (or anything reachable from it) held a live `setTimeout`/`setInterval` handle, `JSON.stringify` threw `TypeError: Converting circular structure to JSON` (`Timeout._idlePrev -> TimersList._idleNext -> …`) and took the whole hook down (#2674). Marshalling now goes through a shared `safeJsonStringify` that drops circular back-edges via a path `WeakSet` and coerces `BigInt` to a string, so only JSON-safe leaves cross the boundary and the body still runs.

- Updated dependencies [6cebf22]
- Updated dependencies [21420d9]
  - @objectstack/spec@12.6.0
  - @objectstack/core@12.6.0
  - @objectstack/rest@12.6.0
  - @objectstack/driver-sql@12.6.0
  - @objectstack/formula@12.6.0
  - @objectstack/metadata@12.6.0
  - @objectstack/objectql@12.6.0
  - @objectstack/observability@12.6.0
  - @objectstack/driver-memory@12.6.0
  - @objectstack/driver-sqlite-wasm@12.6.0
  - @objectstack/plugin-auth@12.6.0
  - @objectstack/plugin-org-scoping@12.6.0
  - @objectstack/plugin-security@12.6.0
  - @objectstack/service-cluster@12.6.0
  - @objectstack/service-datasource@12.6.0
  - @objectstack/service-i18n@12.6.0
  - @objectstack/types@12.6.0

## 12.5.0

### Patch Changes

- Updated dependencies [8b3d363]
  - @objectstack/spec@12.5.0
  - @objectstack/objectql@12.5.0
  - @objectstack/core@12.5.0
  - @objectstack/formula@12.5.0
  - @objectstack/metadata@12.5.0
  - @objectstack/observability@12.5.0
  - @objectstack/driver-memory@12.5.0
  - @objectstack/driver-sql@12.5.0
  - @objectstack/driver-sqlite-wasm@12.5.0
  - @objectstack/plugin-auth@12.5.0
  - @objectstack/plugin-org-scoping@12.5.0
  - @objectstack/plugin-security@12.5.0
  - @objectstack/rest@12.5.0
  - @objectstack/service-cluster@12.5.0
  - @objectstack/service-datasource@12.5.0
  - @objectstack/service-i18n@12.5.0
  - @objectstack/types@12.5.0

## 12.4.0

### Minor Changes

- 1dd5dfd: feat(packages): edit a package manifest via `PATCH /packages/:id`

  Adds an editable path for a package's `name` / `description` / `version` after
  creation: `SchemaRegistry.updatePackageManifest` (merges in-memory, preserving
  lifecycle state), `protocol.updatePackage` (re-persists to `sys_packages`), and
  the `PATCH /packages/:id` route in the HTTP dispatcher. `id` / `scope` / `type`
  remain immutable.

### Patch Changes

- Updated dependencies [60dc3ba]
- Updated dependencies [1dd5dfd]
  - @objectstack/spec@12.4.0
  - @objectstack/objectql@12.4.0
  - @objectstack/core@12.4.0
  - @objectstack/formula@12.4.0
  - @objectstack/metadata@12.4.0
  - @objectstack/observability@12.4.0
  - @objectstack/driver-memory@12.4.0
  - @objectstack/driver-sql@12.4.0
  - @objectstack/driver-sqlite-wasm@12.4.0
  - @objectstack/plugin-auth@12.4.0
  - @objectstack/plugin-org-scoping@12.4.0
  - @objectstack/plugin-security@12.4.0
  - @objectstack/rest@12.4.0
  - @objectstack/service-cluster@12.4.0
  - @objectstack/service-datasource@12.4.0
  - @objectstack/service-i18n@12.4.0
  - @objectstack/types@12.4.0

## 12.3.0

### Patch Changes

- Updated dependencies [5a0da03]
- Updated dependencies [e7eceec]
  - @objectstack/objectql@12.3.0
  - @objectstack/spec@12.3.0
  - @objectstack/rest@12.3.0
  - @objectstack/core@12.3.0
  - @objectstack/formula@12.3.0
  - @objectstack/metadata@12.3.0
  - @objectstack/observability@12.3.0
  - @objectstack/driver-memory@12.3.0
  - @objectstack/driver-sql@12.3.0
  - @objectstack/driver-sqlite-wasm@12.3.0
  - @objectstack/plugin-auth@12.3.0
  - @objectstack/plugin-org-scoping@12.3.0
  - @objectstack/plugin-security@12.3.0
  - @objectstack/service-cluster@12.3.0
  - @objectstack/service-datasource@12.3.0
  - @objectstack/service-i18n@12.3.0
  - @objectstack/types@12.3.0

## 12.2.0

### Patch Changes

- 4f5b791: Wire three more Studio-authored metadata surfaces at runtime (#2605 — the
  "declared but never wired" family, following the #2596 hooks template).

  **Authored actions now execute (#2605 item 1).** `engine.executeAction`'s map
  was only ever populated from the app bundle at boot, so a published `action`
  row (standalone or embedded in an authored object's `actions[]`) was stored
  and listed but never executable — before OR after a restart. Now:

  - `AppPlugin` installs a QuickJS-sandboxed default action runner at boot
    (`engine.setDefaultActionRunner`), the action-path twin of the #2596 hook
    body runner. Opt out with `OS_DISABLE_AUTHORED_ACTIONS=1`.
  - `ObjectQLPlugin` re-registers runtime-authored actions from their
    `sys_metadata` rows under `packageId: 'metadata-service'` at
    `kernel:ready`, on `metadata:reloaded`, and on `action`/`object` protocol
    mutations — saves, publishes, edits, and deletes take effect live.
    Package-artifact actions are excluded (AppPlugin owns those; re-registering
    would clobber their handlers).

  **Authored translations reach the i18n runtime (#2591).** `translation`
  metadata items (single-locale `AppTranslationBundle` payloads; locale from
  `_meta.locale`, a top-level `locale`, or a BCP-47-shaped item name) now load
  into the i18n service as a separate authored layer that overlays static
  bundles. Both adapters carry the layer — service-i18n's `FileI18nAdapter`
  AND the kernel's in-memory fallback (`createMemoryI18n`), which is what dev
  and standalone stacks actually run. The shared sync
  (`wireAuthoredTranslationSync`, exported from `@objectstack/core`, wired by
  the runtime's AppPlugin and by I18nServicePlugin with single-owner
  semantics) runs at `kernel:ready`, on `metadata:reloaded`, and on
  `translation` protocol mutations, with clear-then-reload semantics so
  deleted items/keys stop resolving instead of lingering in the deep-merged
  map.

  **Sharing rules created at runtime bind without a restart (#2592).**
  `bindRuleHooks` was boot-only, so the first rule authored at runtime for an
  object with no boot-time rule silently never evaluated (rule authoring is a
  data insert — `metadata:reloaded` never fires). The sharing plugin now binds
  afterInsert/afterUpdate/afterDelete triggers on `sys_sharing_rule` that
  unbind + re-bind the rule-hook package from a fresh `listRules()`, serialized
  so overlapping writes can't leave a stale snapshot bound, and fail-safe so a
  rebind failure never fails the rule write.

- Updated dependencies [fce8ff4]
- Updated dependencies [3962023]
- Updated dependencies [2bb193d]
- Updated dependencies [0426d27]
- Updated dependencies [da807f7]
- Updated dependencies [4f5b791]
  - @objectstack/rest@12.2.0
  - @objectstack/spec@12.2.0
  - @objectstack/plugin-security@12.2.0
  - @objectstack/objectql@12.2.0
  - @objectstack/core@12.2.0
  - @objectstack/service-i18n@12.2.0
  - @objectstack/formula@12.2.0
  - @objectstack/metadata@12.2.0
  - @objectstack/observability@12.2.0
  - @objectstack/driver-memory@12.2.0
  - @objectstack/driver-sql@12.2.0
  - @objectstack/driver-sqlite-wasm@12.2.0
  - @objectstack/plugin-auth@12.2.0
  - @objectstack/plugin-org-scoping@12.2.0
  - @objectstack/service-cluster@12.2.0
  - @objectstack/service-datasource@12.2.0
  - @objectstack/types@12.2.0

## 12.1.0

### Minor Changes

- 497bda8: feat(automation): honor flow deployment status for enable/disable + expose runtime enable/bound state

  The engine bound and ran **every** registered flow, ignoring the flow's
  persisted `status` — so an author had no way to turn an automation off (short of
  deleting it) and no way to see whether one was actually live. This is the engine
  half of the Studio's "clear on/off switch + visible enabled/bound status".

  - **`registerFlow` now honors `status`:** a flow whose deployment `status` is
    `obsolete` or `invalid` is treated as **disabled** — its trigger is not bound
    and `execute()` refuses it. `draft` / `active` — and any legacy flow with no
    explicit status — stay enabled, so **existing flows are unaffected** (zero
    regression; this is the on/off switch persisting via the existing `status`
    field, applied on the next publish rebind). A status flip back OUT of a
    disabled state re-enables on re-register even if the flow had been turned off;
    a runtime `toggleFlow()` override on a still-enabled flow is preserved.

  - **New `getFlowRuntimeStates()` + `GET /api/v1/automation/_status`:** returns
    `[{ name, enabled, bound }]` for every registered flow — the truth behind the
    Studio's status badges (persisted `status` is metadata; whether a flow is
    actually enabled and wired to its trigger is engine state). Underscore-prefixed
    so no flow name can shadow the route; degrades to an empty list on an older
    service.

  Tests cover: draft/active flows bind + enable (unchanged), an `obsolete` flow is
  neither bound nor enabled and `execute()` refuses it, a status flip
  obsolete→active re-enables + re-binds, and the `_status` route shape.

### Patch Changes

- Updated dependencies [93e6d02]
  - @objectstack/spec@12.1.0
  - @objectstack/core@12.1.0
  - @objectstack/formula@12.1.0
  - @objectstack/metadata@12.1.0
  - @objectstack/objectql@12.1.0
  - @objectstack/observability@12.1.0
  - @objectstack/driver-memory@12.1.0
  - @objectstack/driver-sql@12.1.0
  - @objectstack/driver-sqlite-wasm@12.1.0
  - @objectstack/plugin-auth@12.1.0
  - @objectstack/plugin-org-scoping@12.1.0
  - @objectstack/plugin-security@12.1.0
  - @objectstack/rest@12.1.0
  - @objectstack/service-cluster@12.1.0
  - @objectstack/service-datasource@12.1.0
  - @objectstack/service-i18n@12.1.0
  - @objectstack/types@12.1.0

## 12.0.0

### Patch Changes

- 9693a36: fix(automation): bind a flow published while the server runs, without a restart

  Follow-up to #2560 (cold-boot flow binding). A flow **published while the server
  is running** — the Studio online-authoring journey: author a record-triggered
  automation, publish it, immediately update a matching record — did **not** fire.
  Its trigger only bound on the next process restart.

  Two gaps, both fixed:

  1. **The publish path fired no rebind signal.** `POST /packages/:id/publish-drafts`
     → `protocol.publishPackageDrafts` promotes the drafts to active but emitted no
     event the automation service listens to. The runtime dispatcher now announces
     `metadata:reloaded` after a successful publish — the same signal a dev artifact
     reload fires (`MetadataPlugin._reloadAndAnnounce`) — so boot-cached consumers
     re-sync without a restart.

  2. **The runtime re-sync read the wrong source.** The automation service's
     `metadata:reloaded` re-sync pulled `metadata.list('flow')`, which returns 0 in a
     real running server (it does not surface inline app flows), so even when the
     hook fired it bound nothing. It now reads `protocol.getMetaItems({ type: 'flow' })`
     — the same flattened flow view #2560's cold-boot bind and `GET /meta/flow` use —
     while keeping the teardown of flows removed from the artifact. A failed or
     unavailable protocol read is a no-op and never tears down live flows.

  Production is largely unaffected (a deploy reboots the process, so #2560's
  cold-boot bind covers it); this closes the gap for dev and single-instance
  Studio authoring.

  Verified end-to-end on a clean instance: authored a record-triggered flow in a
  package, published it via `POST /packages/:id/publish-drafts` **without
  restarting**, then updated a matching record and observed the flow fire (before
  the fix it did not). New regression tests boot a kernel whose protocol serves a
  flow only after boot and assert `metadata:reloaded` binds it — and that the
  re-sync reads the protocol, not `metadata.list` — both failing on the pre-fix code.

- 2d567cb: Runtime-authored (Studio) hooks now execute their `body` (#2588).

  Previously a hook authored at runtime (saved via `protocol.saveMetaItem` /
  `publish-drafts`) loaded into the registry but its L1/L2 `body` never ran — the
  metadata-service bind path passed no `bodyRunner` and the engine's
  `_defaultBodyRunner` fallback was never installed, so the binder silently
  skipped the body. Now:

  - `AppPlugin` installs the QuickJS-sandboxed hook body runner as the engine
    default at boot (`engine.setDefaultBodyRunner`), so bind paths without an
    explicit runner can execute bodies. Opt out with
    `OS_DISABLE_AUTHORED_HOOKS=1` to keep runtime-authored hook bodies inert.
  - `ObjectQLPlugin` re-binds runtime-authored hooks from their `sys_metadata`
    rows at `kernel:ready` (cold boot — env-scoped kernels never surfaced these
    rows before), on `metadata:reloaded`, and on every hook mutation through the
    new `protocol.onMetadataMutation` listener — so saves, publishes, edits, and
    deletes take effect live, without a restart. Package-artifact hooks are
    excluded from this bind path (AppPlugin already binds them with an explicit
    runner) so they no longer risk double execution.
  - `@objectstack/metadata-protocol` gains a server-side
    `onMetadataMutation(listener)` API: `saveMetaItem` / `publishMetaItem` /
    `deleteMetaItem` notify subscribers after persistence succeeds.

- e3498fb: fix(runtime): carry spec-validation issues (and the 422 status) through metadata save/publish errors

  `protocol.saveMetaItem` already validates a metadata draft against its spec Zod
  schema and, on failure, throws a rich error: HTTP `status: 422`, `code:
'invalid_metadata'`, and a structured `issues: [{ path, message, code }]` array
  (field-anchored, `superRefine` issues included). But the HTTP dispatcher's catch
  blocks collapsed all of that to a single message — the save path even hardcoded
  `400` — so a client could only show a generic "failed validation" banner with no
  way to point at the offending field. The publish path was worse: the per-draft
  catch in `publishPackageDrafts` flattened each failure into `{ type, name, error
}` and **dropped `issues` entirely**.

  Now:

  - A new `errorFromThrown(e, fallbackStatus)` dispatcher helper preserves the
    error's own `status` (so validation surfaces as **422**, not a downgraded 400)
    and attaches `{ code, issues }` under `error.details` when present. Errors that
    carry neither behave exactly as before. Used by the metadata **save** (`PUT
/meta/:type/:name`) and **publish** (`POST /packages/:id/publish-drafts`)
    catch sites.
  - `publishPackageDrafts` now carries `issues` into each `failed[]` entry, so a
    validation failure during publish is field-anchored too (it previously kept
    only the message).

  This is the server half of "surface validation at the save/publish moment, on
  the field" — the Studio can now map each issue back to its input instead of
  showing a wall-of-text banner. Purely additive to the error payload; the only
  behavior change is the more-correct 422 (was 400) for a failed metadata save.

- Updated dependencies [a8df396]
- Updated dependencies [e695fe0]
- Updated dependencies [07f055c]
- Updated dependencies [1b1b34e]
- Updated dependencies [9796e7c]
- Updated dependencies [7c09621]
- Updated dependencies [2d567cb]
- Updated dependencies [24b62ee]
- Updated dependencies [7709db4]
- Updated dependencies [48ad533]
- Updated dependencies [2082109]
- Updated dependencies [7c09621]
- Updated dependencies [c2fdbf9]
- Updated dependencies [9860de4]
- Updated dependencies [069c205]
  - @objectstack/spec@12.0.0
  - @objectstack/plugin-auth@12.0.0
  - @objectstack/plugin-security@12.0.0
  - @objectstack/objectql@12.0.0
  - @objectstack/rest@12.0.0
  - @objectstack/metadata@12.0.0
  - @objectstack/core@12.0.0
  - @objectstack/formula@12.0.0
  - @objectstack/observability@12.0.0
  - @objectstack/driver-memory@12.0.0
  - @objectstack/driver-sql@12.0.0
  - @objectstack/driver-sqlite-wasm@12.0.0
  - @objectstack/plugin-org-scoping@12.0.0
  - @objectstack/service-cluster@12.0.0
  - @objectstack/service-datasource@12.0.0
  - @objectstack/service-i18n@12.0.0
  - @objectstack/types@12.0.0

## 11.10.0

### Patch Changes

- Updated dependencies [6a9397e]
- Updated dependencies [c0efe5d]
  - @objectstack/spec@11.10.0
  - @objectstack/plugin-security@11.10.0
  - @objectstack/core@11.10.0
  - @objectstack/formula@11.10.0
  - @objectstack/metadata@11.10.0
  - @objectstack/objectql@11.10.0
  - @objectstack/observability@11.10.0
  - @objectstack/driver-memory@11.10.0
  - @objectstack/driver-sql@11.10.0
  - @objectstack/driver-sqlite-wasm@11.10.0
  - @objectstack/plugin-auth@11.10.0
  - @objectstack/plugin-org-scoping@11.10.0
  - @objectstack/rest@11.10.0
  - @objectstack/service-cluster@11.10.0
  - @objectstack/service-datasource@11.10.0
  - @objectstack/service-i18n@11.10.0
  - @objectstack/types@11.10.0

## 11.9.0

### Patch Changes

- 852bc8e: fix(runtime): surface the clean business message from a failed action, not the sandbox debug wrapper

  A user throw inside a script/action body is wrapped by the sandbox as
  `<kind> '<name>' threw: <msg>` for server logs, but the action HTTP endpoint
  returned that whole wrapper as the client-facing `error` — so an action's error
  toast leaked the debug prefix to end users (e.g. `action 'lead_apply_convert'
threw: Error: 线索信息不完整…` instead of just `线索信息不完整…`).

  `SandboxError` now also carries `innerMessage`: the plain business message with
  no `<kind> '<name>' threw:` wrapper and no default `Error: ` name prefix. The
  action route surfaces `innerMessage` to the client and keeps the full wrapper in
  the server log.

- Updated dependencies [d3595d9]
- Updated dependencies [8d87930]
  - @objectstack/spec@11.9.0
  - @objectstack/driver-sql@11.9.0
  - @objectstack/core@11.9.0
  - @objectstack/formula@11.9.0
  - @objectstack/metadata@11.9.0
  - @objectstack/objectql@11.9.0
  - @objectstack/observability@11.9.0
  - @objectstack/driver-memory@11.9.0
  - @objectstack/driver-sqlite-wasm@11.9.0
  - @objectstack/plugin-auth@11.9.0
  - @objectstack/plugin-org-scoping@11.9.0
  - @objectstack/plugin-security@11.9.0
  - @objectstack/rest@11.9.0
  - @objectstack/service-cluster@11.9.0
  - @objectstack/service-datasource@11.9.0
  - @objectstack/service-i18n@11.9.0
  - @objectstack/types@11.9.0

## 11.8.0

### Patch Changes

- @objectstack/metadata@11.8.0
- @objectstack/plugin-auth@11.8.0
- @objectstack/plugin-org-scoping@11.8.0
- @objectstack/plugin-security@11.8.0
- @objectstack/rest@11.8.0
- @objectstack/spec@11.8.0
- @objectstack/core@11.8.0
- @objectstack/types@11.8.0
- @objectstack/objectql@11.8.0
- @objectstack/observability@11.8.0
- @objectstack/formula@11.8.0
- @objectstack/driver-memory@11.8.0
- @objectstack/driver-sql@11.8.0
- @objectstack/driver-sqlite-wasm@11.8.0
- @objectstack/service-cluster@11.8.0
- @objectstack/service-datasource@11.8.0
- @objectstack/service-i18n@11.8.0

## 11.7.0

### Patch Changes

- Updated dependencies [5178906]
  - @objectstack/spec@11.7.0
  - @objectstack/core@11.7.0
  - @objectstack/formula@11.7.0
  - @objectstack/metadata@11.7.0
  - @objectstack/objectql@11.7.0
  - @objectstack/observability@11.7.0
  - @objectstack/driver-memory@11.7.0
  - @objectstack/driver-sql@11.7.0
  - @objectstack/driver-sqlite-wasm@11.7.0
  - @objectstack/plugin-auth@11.7.0
  - @objectstack/plugin-org-scoping@11.7.0
  - @objectstack/plugin-security@11.7.0
  - @objectstack/rest@11.7.0
  - @objectstack/service-cluster@11.7.0
  - @objectstack/service-datasource@11.7.0
  - @objectstack/service-i18n@11.7.0
  - @objectstack/types@11.7.0

## 11.6.0

### Patch Changes

- @objectstack/spec@11.6.0
- @objectstack/core@11.6.0
- @objectstack/types@11.6.0
- @objectstack/metadata@11.6.0
- @objectstack/objectql@11.6.0
- @objectstack/observability@11.6.0
- @objectstack/formula@11.6.0
- @objectstack/rest@11.6.0
- @objectstack/driver-memory@11.6.0
- @objectstack/driver-sql@11.6.0
- @objectstack/driver-sqlite-wasm@11.6.0
- @objectstack/plugin-auth@11.6.0
- @objectstack/plugin-org-scoping@11.6.0
- @objectstack/plugin-security@11.6.0
- @objectstack/service-cluster@11.6.0
- @objectstack/service-datasource@11.6.0
- @objectstack/service-i18n@11.6.0

## 11.5.0

### Patch Changes

- Updated dependencies [6ee4f04]
- Updated dependencies [c1e3a65]
  - @objectstack/spec@11.5.0
  - @objectstack/core@11.5.0
  - @objectstack/formula@11.5.0
  - @objectstack/metadata@11.5.0
  - @objectstack/objectql@11.5.0
  - @objectstack/observability@11.5.0
  - @objectstack/driver-memory@11.5.0
  - @objectstack/driver-sql@11.5.0
  - @objectstack/driver-sqlite-wasm@11.5.0
  - @objectstack/plugin-auth@11.5.0
  - @objectstack/plugin-org-scoping@11.5.0
  - @objectstack/plugin-security@11.5.0
  - @objectstack/rest@11.5.0
  - @objectstack/service-cluster@11.5.0
  - @objectstack/service-datasource@11.5.0
  - @objectstack/service-i18n@11.5.0
  - @objectstack/types@11.5.0

## 11.4.0

### Patch Changes

- Updated dependencies [5821c51]
- Updated dependencies [a0fce3f]
  - @objectstack/spec@11.4.0
  - @objectstack/core@11.4.0
  - @objectstack/formula@11.4.0
  - @objectstack/metadata@11.4.0
  - @objectstack/objectql@11.4.0
  - @objectstack/observability@11.4.0
  - @objectstack/driver-memory@11.4.0
  - @objectstack/driver-sql@11.4.0
  - @objectstack/driver-sqlite-wasm@11.4.0
  - @objectstack/plugin-auth@11.4.0
  - @objectstack/plugin-org-scoping@11.4.0
  - @objectstack/plugin-security@11.4.0
  - @objectstack/rest@11.4.0
  - @objectstack/service-cluster@11.4.0
  - @objectstack/service-datasource@11.4.0
  - @objectstack/service-i18n@11.4.0
  - @objectstack/types@11.4.0

## 11.3.0

### Patch Changes

- Updated dependencies [58e8e31]
- Updated dependencies [b4a5df0]
- Updated dependencies [59576d0]
  - @objectstack/spec@11.3.0
  - @objectstack/plugin-auth@11.3.0
  - @objectstack/core@11.3.0
  - @objectstack/formula@11.3.0
  - @objectstack/metadata@11.3.0
  - @objectstack/objectql@11.3.0
  - @objectstack/observability@11.3.0
  - @objectstack/driver-memory@11.3.0
  - @objectstack/driver-sql@11.3.0
  - @objectstack/driver-sqlite-wasm@11.3.0
  - @objectstack/plugin-org-scoping@11.3.0
  - @objectstack/plugin-security@11.3.0
  - @objectstack/rest@11.3.0
  - @objectstack/service-cluster@11.3.0
  - @objectstack/service-datasource@11.3.0
  - @objectstack/service-i18n@11.3.0
  - @objectstack/types@11.3.0

## 11.2.0

### Patch Changes

- Updated dependencies [d0f4b13]
- Updated dependencies [302bdab]
  - @objectstack/spec@11.2.0
  - @objectstack/core@11.2.0
  - @objectstack/formula@11.2.0
  - @objectstack/metadata@11.2.0
  - @objectstack/objectql@11.2.0
  - @objectstack/observability@11.2.0
  - @objectstack/driver-memory@11.2.0
  - @objectstack/driver-sql@11.2.0
  - @objectstack/driver-sqlite-wasm@11.2.0
  - @objectstack/plugin-auth@11.2.0
  - @objectstack/plugin-org-scoping@11.2.0
  - @objectstack/plugin-security@11.2.0
  - @objectstack/rest@11.2.0
  - @objectstack/service-cluster@11.2.0
  - @objectstack/service-datasource@11.2.0
  - @objectstack/service-i18n@11.2.0
  - @objectstack/types@11.2.0

## 11.1.0

### Minor Changes

- e011d42: Auth: per-org MFA + dispatcher/MCP gate — complete the ADR-0069 enforced-MFA story

  Two follow-ups that make enforced MFA total:

  - **Per-org `sys_organization.require_mfa`** — an org may require MFA above the global floor. `computeAuthGate` now treats the active org's `require_mfa` as an effective MFA requirement even when the global `mfa_required` is off; `isAuthGateActive()` stays cheap via a 60s-TTL "any org requires MFA" cache (lazy background refresh), so a brand-new per-org requirement activates the gate on the next request without per-request org queries.
  - **Dispatcher/MCP gate** — the auth-policy gate now also runs in the runtime dispatcher (after `resolveExecutionContext`), so MCP / GraphQL / embedded data paths enforce `PASSWORD_EXPIRED` / `MFA_REQUIRED` consistently with the REST seam (reusing the shared `evaluateAuthGate` allow-list). Previously only the REST surface (the Console) was gated.

  Default-off / additive. Per ADR-0049 each setting ships with its enforcement.

### Patch Changes

- 7087cfe: Remove the unused HTTP framework adapters and the MSW plugin — the open edition ships the **Hono** adapter only.

  The `express` / `fastify` / `nextjs` / `nestjs` / `nuxt` / `sveltekit` adapters and
  `@objectstack/plugin-msw` had **zero internal consumers** and were not dogfooded —
  pure release/maintenance surface (and an untested-integration liability). They are
  removed; `@objectstack/hono` (the adapter actually used, via `@objectstack/client`)
  is kept.

  - Deleted packages: `@objectstack/express`, `@objectstack/fastify`,
    `@objectstack/nextjs`, `@objectstack/nestjs`, `@objectstack/nuxt`,
    `@objectstack/sveltekit`, `@objectstack/plugin-msw` (fixed group 73 → 66).
  - `@objectstack/client`: dropped the `plugin-msw` / `msw` dev usage (MSW test removed).
  - `HttpDispatcher` (the dispatch engine) is now used only by the Hono adapter +
    the internal dispatcher-plugin, so its misleading `@deprecated → createDispatcherPlugin`
    note (createDispatcherPlugin is a kernel plugin, not a drop-in) is corrected.

  Anyone needing another framework adapter can build one on the public
  `HttpDispatcher` / `createDispatcherPlugin` API or maintain it out-of-tree.

- 69ae136: docs: align hardening / driver docs with the Hono-only adapter surface (12.0)

  Follow-up to the adapter trim (#2391): the hardening guide's rate-limit/CORS
  recipes are rewritten from Fastify to **Hono** (the shipped adapter; the old
  `@objectstack/fastify` import was broken), CSRF guidance points at `hono/csrf`,
  and stale `@objectstack/plugin-msw` references are dropped from the driver-memory
  and driver-turso docs. README framework lists narrowed to Hono.

- Updated dependencies [574e7a3]
- Updated dependencies [cbc8c02]
- Updated dependencies [18f9713]
- Updated dependencies [7cf81a7]
- Updated dependencies [d7a88df]
- Updated dependencies [4f8f108]
- Updated dependencies [ce0b4f6]
- Updated dependencies [90bce88]
- Updated dependencies [3209ec6]
- Updated dependencies [8c84c97]
- Updated dependencies [e011d42]
- Updated dependencies [6e5bdd5]
- Updated dependencies [13dbcf2]
- Updated dependencies [9ccfcd6]
- Updated dependencies [dc2990f]
- Updated dependencies [ecf193f]
- Updated dependencies [51bec81]
- Updated dependencies [3e593a7]
- Updated dependencies [fdb41c0]
- Updated dependencies [63d5403]
- Updated dependencies [69ae136]
  - @objectstack/plugin-security@11.1.0
  - @objectstack/plugin-auth@11.1.0
  - @objectstack/core@11.1.0
  - @objectstack/rest@11.1.0
  - @objectstack/objectql@11.1.0
  - @objectstack/observability@11.1.0
  - @objectstack/spec@11.1.0
  - @objectstack/types@11.1.0
  - @objectstack/driver-memory@11.1.0
  - @objectstack/metadata@11.1.0
  - @objectstack/plugin-org-scoping@11.1.0
  - @objectstack/driver-sql@11.1.0
  - @objectstack/driver-sqlite-wasm@11.1.0
  - @objectstack/service-cluster@11.1.0
  - @objectstack/service-datasource@11.1.0
  - @objectstack/service-i18n@11.1.0
  - @objectstack/formula@11.1.0

## 11.0.0

### Minor Changes

- 4d99a5c: Package-scoped commit history & rollback for AI authoring (ADR-0067)

  Each authoring apply now lands as one revertible **commit** on a package timeline, on top of `sys_metadata_history`:

  - New `sys_metadata_commit` object groups a turn's metadata changes (by `event_seq` range).
  - `publishPackageDrafts` records each publish as one commit (best-effort) with a per-artifact revert plan and an optional `message` / `aiModel`.
  - New protocol methods `listCommits`, `revertCommit`, `rollbackToPackageCommit` (reusing `restoreVersion` + delete; a revert is itself an append-only commit).
  - New REST routes: `GET /packages/:id/commits`, `POST /packages/:id/commits/:commitId/revert`, `POST /packages/:id/rollback`.

- 6c4fbd9: fix(security): enforce flow `runAs` execution identity (#1888)

  The `service-automation` engine now honors `flow.runAs` instead of ignoring it.
  Previously the CRUD nodes passed **no identity** to ObjectQL, so the security
  middleware was skipped entirely — every flow ran effectively elevated regardless
  of `runAs`. A `runAs:'user'` flow did **not** de-elevate (a privilege-boundary
  surprise), and `runAs:'system'` did not _explicitly_ elevate.

  The engine now establishes the run's data-layer identity at setup and restores
  the caller's context afterward:

  - **`runAs:'system'`** → an elevated, RLS-bypassing system principal
    (`{ isSystem: true }`): the run can read/write records the triggering user
    cannot.
  - **`runAs:'user'`** (default) → the **triggering user's** identity
    (`{ userId, roles, permissions, tenantId }`): CRUD nodes' ObjectQL reads/writes
    respect that user's row-level security, and the run can never exceed the
    triggering user's grants.

  To keep `runAs:'user'` faithful to a direct request by that user, the REST
  trigger route (`@objectstack/runtime`) and the record-change trigger
  (`@objectstack/trigger-record-change`) now forward the caller's resolved
  `roles`/`tenantId` into the `AutomationContext` (new optional fields), not just
  `userId`. The new `resolveRunDataContext` helper is the single place that maps a
  run's effective `runAs` to the ObjectQL context, shared by every data node.

  The `[EXPERIMENTAL — not enforced]` marker is removed from `FlowSchema.runAs`.

  **Behavior change / migration.** Flows that previously relied on the implicit
  elevation (the default `runAs:'user'` ran unscoped) now run as the triggering
  user and are subject to their RLS. **Declare `runAs:'system'` on any flow that
  must read or write beyond the triggering user's access** (e.g. system
  automations, cross-owner roll-ups). Schedule-triggered runs have no trigger user;
  under `user` they stay unscoped (there is no identity to scope to) — declare
  `system` to make elevation explicit.

  Proven both directions by the dogfood regression gate
  (`flow-runas.dogfood.test.ts` — a restricted member triggers system vs user
  flows against an owner-scoped record) and service-automation unit + regression
  tests (`crud-runas.test.ts`).

### Patch Changes

- 61d441f: feat(objectql): duplicate a writable base — ADR-0070 D4 ("duplicate base")

  `protocol.duplicatePackage` clones every ACTIVE item a base owns into a NEW
  package, **re-namespacing** object names (the blueprint prefixes a base's object
  names with its namespace, e.g. `iojn_repair_ticket`, and `sys_metadata` keys on
  `(type,name,org)` so a same-name copy would collide with the source) and
  **rewriting every intra-package reference** (lookup `reference`, view `object`,
  expressions, …) to the new names via a longest-first, identifier-boundary
  replace. Exposed as `POST /packages/:id/duplicate` (body
  `{ targetPackageId, targetName?, targetNamespace? }`).

  Completes ADR-0070 D4 (package = lifecycle unit): delete-cascade and export
  already shipped; this adds the duplicate gesture.

- c224e18: feat(objectql): adopt orphaned metadata into a base — ADR-0070 D5 migration

  `protocol.reassignOrphanedMetadata` bulk-rebinds every package-less orphan
  (`package_id` null / `""` / the `sys_metadata` sentinel left by the pre-
  package-first stopgaps) onto a target base, leaving already-owned rows
  untouched. Exposed as `POST /packages/:id/adopt-orphans`. This is the migration
  affordance behind retiring the "Local / Custom" scope (D5): once an env has no
  orphans, that scope can be dropped from the selector. Pairs with the kernel's
  `writable_package_required` (D1) so no NEW orphans are created.

- aa33b02: fix(security): single-source the request authorization resolver — REST no longer drops sys_user_position

  The REST server and the runtime dispatcher each carried their own copy of the request → ExecutionContext identity/role resolver, and they drifted on a security path. The REST copy silently omitted `sys_user_position` (so custom roles granted via the ADR-0057 D4 platform-RBAC path did not apply over REST), `sys_position_permission_set`, the `owner→org_owner` membership normalization, the platform-admin derivation, and the `ai_seat` synthesis — fail-closed (legitimate access denied), not an escalation.

  Both entry points now delegate to a single shared resolver, `resolveAuthzContext` in `@objectstack/core/security` (joining the API-key verifier that already lived there). A contract test locks every authorization source and a lint gate (`check:authz-resolver`) prevents a future duplicate resolver or a dropped delegation.

- Updated dependencies [caa3ef4]
- Updated dependencies [22b32c1]
- Updated dependencies [4d99a5c]
- Updated dependencies [21b3208]
- Updated dependencies [9b5bf3d]
- Updated dependencies [cb5b393]
- Updated dependencies [ab5718a]
- Updated dependencies [61d441f]
- Updated dependencies [c224e18]
- Updated dependencies [d616e1d]
- Updated dependencies [1e8a813]
- Updated dependencies [4845c12]
- Updated dependencies [c1a754a]
- Updated dependencies [6fbe91f]
- Updated dependencies [715d667]
- Updated dependencies [5eef4cf]
- Updated dependencies [4b5ec6e]
- Updated dependencies [72759e1]
- Updated dependencies [6c4fbd9]
- Updated dependencies [ef3ed67]
- Updated dependencies [359c0aa]
- Updated dependencies [cd51229]
- Updated dependencies [7697a0e]
- Updated dependencies [e7e04f1]
- Updated dependencies [cfd5ac4]
- Updated dependencies [2be5c1f]
- Updated dependencies [9a810f8]
- Updated dependencies [ad143ce]
- Updated dependencies [5c4a8c8]
- Updated dependencies [3afaeed]
- Updated dependencies [a619a3a]
- Updated dependencies [795b6d1]
- Updated dependencies [8801c02]
- Updated dependencies [3d04e06]
- Updated dependencies [98a1535]
- Updated dependencies [bc22a89]
- Updated dependencies [8a7e9f1]
- Updated dependencies [4a84c98]
- Updated dependencies [c715d25]
- Updated dependencies [aa33b02]
- Updated dependencies [d980f0d]
- Updated dependencies [a658523]
- Updated dependencies [82ff91c]
- Updated dependencies [638f472]
  - @objectstack/plugin-auth@11.0.0
  - @objectstack/objectql@11.0.0
  - @objectstack/spec@11.0.0
  - @objectstack/metadata@11.0.0
  - @objectstack/formula@11.0.0
  - @objectstack/rest@11.0.0
  - @objectstack/types@11.0.0
  - @objectstack/driver-sql@11.0.0
  - @objectstack/core@11.0.0
  - @objectstack/plugin-org-scoping@11.0.0
  - @objectstack/plugin-security@11.0.0
  - @objectstack/observability@11.0.0
  - @objectstack/driver-memory@11.0.0
  - @objectstack/driver-sqlite-wasm@11.0.0
  - @objectstack/service-cluster@11.0.0
  - @objectstack/service-datasource@11.0.0
  - @objectstack/service-i18n@11.0.0

## 10.3.0

### Patch Changes

- 8cf4f7c: fix(runtime): mount `GET /ready` so the readiness probe is reachable over HTTP

  The dispatcher's `/ready` branch (seam #2) was only reachable when calling
  `dispatch()` directly — no `server.get('${prefix}/ready')` registration existed,
  so a real server returned the Hono not-found 404 before the handler ran (the same
  class of bug as `/mcp` and `/keys`). `/ready` is now mounted alongside `/health`,
  returning 200 while the kernel is `running` and 503 while it is booting or
  draining — the contract the EE multi-node rolling-restart drain gate polls
  (cloud ADR-0018). Adds a registration assertion plus an integration test that
  hits the endpoint through a real HTTP server.

- f2063f3: fix(cli): extend native better-sqlite3 → wasm SQLite auto-fallback to the persistent-file / `--artifact` dev path (#2229)

  The native-`better-sqlite3` → wasm SQLite → in-memory step-down previously only
  guarded the zero-config `:memory:` dev branch of `serve`. A normal
  `objectstack dev` run never reaches it — `dev` injects a persistent `file:` DB
  (so AI-authored data survives restarts) and `--artifact` boots resolve sqlite
  through the datasource factory — both of which constructed
  `better-sqlite3` directly with no probe and no fallback. An ABI mismatch (e.g.
  a cached prebuilt binary built for a different Node version) was therefore not
  caught at boot and surfaced later as a runtime `Find operation failed` on the
  first query.

  The probe-by-connect + step-down is now hoisted into a shared
  `resolveSqliteDriver` helper (`@objectstack/service-datasource`) and applied to
  both previously-unguarded sqlite construction sites: the explicit `sqlite` /
  `file:` branch in `serve.ts` and the sqlite branch of the default datasource
  driver factory. better-sqlite3 loads its native addon lazily (first query), so
  the helper forces the load with a `SELECT 1` and, **in dev only**, steps down to
  wasm SQLite (real SQL + on-disk persistence — the same `file:` keeps working)
  then to the in-memory driver as a last resort, emitting the existing
  `⚠ native better-sqlite3 unavailable …` warning. In production the native driver
  is returned unprobed so a load failure surfaces loudly (fail-closed) rather than
  silently degrading to a different engine.

- Updated dependencies [2b355d5]
- Updated dependencies [5ba52b0]
- Updated dependencies [211425e]
- Updated dependencies [f2063f3]
  - @objectstack/service-cluster@10.3.0
  - @objectstack/driver-sql@10.3.0
  - @objectstack/objectql@10.3.0
  - @objectstack/service-datasource@10.3.0
  - @objectstack/driver-sqlite-wasm@10.3.0
  - @objectstack/spec@10.3.0
  - @objectstack/core@10.3.0
  - @objectstack/types@10.3.0
  - @objectstack/metadata@10.3.0
  - @objectstack/observability@10.3.0
  - @objectstack/formula@10.3.0
  - @objectstack/rest@10.3.0
  - @objectstack/driver-memory@10.3.0
  - @objectstack/plugin-auth@10.3.0
  - @objectstack/plugin-org-scoping@10.3.0
  - @objectstack/plugin-security@10.3.0
  - @objectstack/service-i18n@10.3.0

## 10.2.0

### Patch Changes

- Updated dependencies [b496498]
  - @objectstack/spec@10.2.0
  - @objectstack/core@10.2.0
  - @objectstack/formula@10.2.0
  - @objectstack/metadata@10.2.0
  - @objectstack/objectql@10.2.0
  - @objectstack/observability@10.2.0
  - @objectstack/driver-memory@10.2.0
  - @objectstack/driver-sql@10.2.0
  - @objectstack/driver-sqlite-wasm@10.2.0
  - @objectstack/plugin-auth@10.2.0
  - @objectstack/plugin-org-scoping@10.2.0
  - @objectstack/plugin-security@10.2.0
  - @objectstack/rest@10.2.0
  - @objectstack/service-cluster@10.2.0
  - @objectstack/service-datasource@10.2.0
  - @objectstack/service-i18n@10.2.0
  - @objectstack/types@10.2.0

## 10.1.0

### Minor Changes

- ac79f16: feat(datasource): auto-connect declared external datasources (ADR-0062 Phase 1, D1/D2/D5)

  A declared external datasource is now connected to a live ObjectQL driver and its
  federated objects are queryable **with zero app code** — no `onEnable` driver
  wiring. Implements ADR-0062 Phase 1.

  - **D1 — one connect path.** New `DatasourceConnectionService` in
    `@objectstack/service-datasource` owns the single "definition → live driver"
    path: build via the injected driver factory → resolve `external.credentialsRef`
    via the `SecretBinder` → connect → `engine.registerDriver` under the datasource
    name → register the datasource def → sync each bound federated object's read
    metadata (DDL-free). Both origins converge on it: the runtime-admin
    `registerPool` now delegates here, and `AppPlugin` auto-connects code-defined
    datasources. Exposed as the `'datasource-connection'` kernel service.
  - **D2 — opt-in-safe gate.** A declared datasource auto-connects only when it is
    `external`, an object **explicitly** binds to it via `object.datasource`, or it
    sets the new `autoConnect: true` flag. A managed datasource that nothing
    explicitly binds (incl. ones referenced only by a `datasourceMapping` rule, e.g.
    `examples/app-crm`'s `:memory:` datasources) stays metadata-only — existing apps
    are byte-for-byte unchanged. See the ADR-0062 D2 implementation note.
  - **D5 — lifecycle, ordering & policy.** Connect happens in `AppPlugin.start()`
    (before the `kernel:ready` validation gate, relying on the kernel's
    init-all-then-start-all ordering). Fail-fast for a declared `external` datasource
    with `validation.onMismatch: 'fail'`; degrade-with-warning otherwise (and always
    for runtime-admin/rehydrate, so a UI action or replica blip never bricks the
    server). Adds a host-injectable `DatasourceConnectPolicy` (open-core default
    allows; a multi-tenant host binds a stricter fail-closed policy for egress
    isolation) consulted before every connect — one connect path, no cloud fork.

  Adds `datasource.autoConnect` to the spec. The legacy `onEnable` +
  `ctx.drivers.register` bridge remains supported as an escape hatch (idempotent vs.
  auto-connect). No behavior change for managed apps.

### Patch Changes

- 94d2161: refactor(runtime): build the standalone default driver via the shared datasource factory (ADR-0062 follow-up)

  `createStandaloneStack` now constructs its `default` driver for the user-facing
  kinds (memory / better-sqlite3 / postgres / mongodb) through the **same**
  `createDefaultDatasourceDriverFactory` used for declared and runtime-admin
  datasources — one "driver kind → instance" construction path instead of two
  hand-mirrored ones. Adding a dialect or changing connection/pool defaults now
  happens in a single place. URL→config translation, filesystem prep (`mkdir`),
  and pre-engine `DriverPlugin` registration stay in the stack (unchanged); the
  factory only constructs the driver. The pure-JS WASM sqlite driver stays bespoke
  in the stack — it's the standalone-specific, CI-safe default and not a
  user-creatable datasource type, so it has a single construction site already.

  No behavior change: the same driver instances are built for the same inputs
  (verified by a per-kind connect + CRUD round-trip test and a real `os dev` boot).
  Adds `@objectstack/service-datasource` as a runtime dependency (no cycle — that
  package depends only on core/spec).

- Updated dependencies [49da36e]
- Updated dependencies [49da36e]
- Updated dependencies [ac79f16]
- Updated dependencies [517dad9]
  - @objectstack/spec@10.1.0
  - @objectstack/service-datasource@10.1.0
  - @objectstack/driver-sql@10.1.0
  - @objectstack/rest@10.1.0
  - @objectstack/core@10.1.0
  - @objectstack/formula@10.1.0
  - @objectstack/metadata@10.1.0
  - @objectstack/objectql@10.1.0
  - @objectstack/observability@10.1.0
  - @objectstack/driver-memory@10.1.0
  - @objectstack/driver-sqlite-wasm@10.1.0
  - @objectstack/plugin-auth@10.1.0
  - @objectstack/plugin-org-scoping@10.1.0
  - @objectstack/plugin-security@10.1.0
  - @objectstack/service-cluster@10.1.0
  - @objectstack/service-i18n@10.1.0
  - @objectstack/types@10.1.0

## 10.0.0

### Minor Changes

- e16f2a8: **BREAKING:** the system object `sys_department` is renamed to `sys_business_unit`
  — object + member table (`sys_department_member` → `sys_business_unit_member`),
  fields, and i18n — with **no compatibility alias**. Any deployment holding
  `sys_department` rows, or metadata that references the object by name (lookups,
  list views, queries, sharing/approval scopes), must migrate to `sys_business_unit`.
  A renamed shipped system object is a breaking change to the platform's public
  data surface, so this lands as a **major**. Verified per ADR-0059's pre-publish
  hotcrm gate: no published downstream consumer references the old name.

  ADR-0057 — ERP authorization core. Adds permission-grant access DEPTH
  (`own`/`own_and_reports`/`unit`/`unit_and_below`/`org`), renames `sys_department`
  → `sys_business_unit` (no aliases — see BREAKING above), introduces the platform-owned
  `sys_user_position` assignment, and seeds stack-declared `roles`/`sharingRules` into
  `sys_position`/`sys_sharing_rule` at boot (closes #2077). Hierarchy-relative scopes are
  delegated to a pluggable `IHierarchyScopeResolver` (open edition fails closed to
  owner-only; `defineStack` errors without `requires: ['hierarchy-security']`). Also
  fixes a latent over-grant where `engine.find({ filter })` was ignored (driver reads
  `where`) — normalized `filter`→`where` in the engine.

- 220ce5b: Resolve the tenant default currency onto ExecutionContext.

  Adds `ExecutionContext.currency` (ISO 4217) and resolves it from the
  `localization.currency` setting alongside `timezone`/`locale` — in both the
  runtime `resolveExecutionContext` and the REST mirror. This is the foundation
  for the documented "applied when a currency field omits its own" fallback: the
  tenant default is now carried on every request context, so analytics enrichment,
  formatters, and renderers can resolve a measure/field currency down to the org
  default instead of hard-coding it. Undefined when no tenant default is
  configured (consumers then render a plain number).

### Patch Changes

- 47d978a: Fix: the artifact-serve path now honors an app-declared default permission-set
  profile (`isProfile: true, isDefault: true`) under `objectstack dev`/`serve`/`start`.

  `createStandaloneStack` (the boot path used when serving a compiled
  `dist/objectstack.json` with no host `objectstack.config.ts`) surfaced
  `objects`/`requires`/`manifest` from the artifact bundle but dropped
  `permissions[]` and `roles[]`. As a result the CLI's
  `appDefaultProfileName(config.permissions)` saw `undefined` and the SecurityPlugin
  fell back to the built-in owner-only `member_default` — so an app whose default
  profile carries e.g. `readScope: 'unit_and_below'` (ADR-0056 D7 / ADR-0057 D1)
  was silently ignored. The config-load path was unaffected because the app's
  `permissions` survived via the original stack object.

  `createStandaloneStack` now surfaces `permissions[]` and `roles[]` from the
  artifact bundle, mirroring the existing `objects`/`requires`/`manifest` handling,
  so the artifact-serve path applies the app default profile exactly like the
  config-load path.

- Updated dependencies [d7ff626]
- Updated dependencies [92db3e5]
- Updated dependencies [2a1b16b]
- Updated dependencies [2256e93]
- Updated dependencies [e16f2a8]
- Updated dependencies [cfd86ce]
- Updated dependencies [e411a82]
- Updated dependencies [a581385]
- Updated dependencies [d5f6d29]
- Updated dependencies [220ce5b]
- Updated dependencies [3efe334]
- Updated dependencies [3754f80]
- Updated dependencies [feead7e]
- Updated dependencies [6ca20b3]
- Updated dependencies [5f875fe]
- Updated dependencies [b469950]
- Updated dependencies [48a307a]
- Updated dependencies [25fc0e4]
  - @objectstack/spec@10.0.0
  - @objectstack/driver-sql@10.0.0
  - @objectstack/objectql@10.0.0
  - @objectstack/rest@10.0.0
  - @objectstack/plugin-security@10.0.0
  - @objectstack/formula@10.0.0
  - @objectstack/core@10.0.0
  - @objectstack/metadata@10.0.0
  - @objectstack/observability@10.0.0
  - @objectstack/driver-memory@10.0.0
  - @objectstack/driver-sqlite-wasm@10.0.0
  - @objectstack/plugin-auth@10.0.0
  - @objectstack/plugin-org-scoping@10.0.0
  - @objectstack/service-cluster@10.0.0
  - @objectstack/service-i18n@10.0.0
  - @objectstack/types@10.0.0

## 9.11.0

### Patch Changes

- 2afb612: feat(security): resolve `current_user.email` in RLS owner policies

  RLS `using` predicates can now reference **`current_user.email`** — a unique,
  human-readable, _seedable_ owner anchor (`owner = current_user.email`). Previously
  the RLS compiler resolved only `current_user.id` / `organization_id` / `roles` /
  `org_user_ids`, so any owner-by-name/email predicate silently compiled to the
  deny sentinel (fail-closed → the user saw nothing). Email is sourced for free
  from the auth session (with a bounded `sys_user` fallback for the API-key path)
  and threaded onto the `ExecutionContext` in both identity resolvers — the REST
  data path (`rest-server`) and the dispatcher path (`resolve-execution-context`).

  Display `name` is deliberately **not** exposed to RLS: names collide, and a
  collision on an ownership predicate is an access-control leak. Only unique
  identifiers (`id`, `email`) are resolvable.

  This makes owner-scoped row-level security work with seed data (no per-user ids
  needed) and, combined with `controlled_by_parent` (ADR-0055), lets a master's
  owner scoping flow to its detail records. The example-showcase demonstrates it:
  `showcase_invoice` carries an `owner` email + an owner RLS policy, its lines are
  controlled-by-parent, and invoices/lines are seeded per owner. It also fixes the
  showcase's previously inert owner predicates (they used `==` and `current_user.name`,
  neither of which the compiler accepts) to `= current_user.email`.

- Updated dependencies [e7f6539]
- Updated dependencies [e7f6539]
- Updated dependencies [fa8964d]
- Updated dependencies [2365d07]
- Updated dependencies [6595b53]
- Updated dependencies [fa8964d]
- Updated dependencies [751f5cf]
- Updated dependencies [5a5a9fe]
- Updated dependencies [36138c7]
- Updated dependencies [a8e4f3b]
- Updated dependencies [4c213c2]
- Updated dependencies [2afb612]
  - @objectstack/spec@9.11.0
  - @objectstack/rest@9.11.0
  - @objectstack/plugin-security@9.11.0
  - @objectstack/objectql@9.11.0
  - @objectstack/driver-sql@9.11.0
  - @objectstack/core@9.11.0
  - @objectstack/formula@9.11.0
  - @objectstack/metadata@9.11.0
  - @objectstack/observability@9.11.0
  - @objectstack/driver-memory@9.11.0
  - @objectstack/driver-sqlite-wasm@9.11.0
  - @objectstack/plugin-auth@9.11.0
  - @objectstack/plugin-org-scoping@9.11.0
  - @objectstack/service-cluster@9.11.0
  - @objectstack/service-i18n@9.11.0
  - @objectstack/types@9.11.0

## 9.10.0

### Minor Changes

- 1f88fd9: Add a transaction boundary to sandboxed hook/action bodies: `ctx.api.transaction(async () => { … })`. Every `ctx.api` read/write inside the callback runs in one driver transaction — committed when the callback returns, rolled back if it throws (or if the body leaves the transaction open at timeout). Guarded by the new `api.transaction` capability.

  - **spec**: new `api.transaction` capability token on `HookBodyCapability`.
  - **objectql**: `ScopedContext` gains discrete `beginTransaction()` / `commitTransaction(handle)` / `rollbackTransaction(handle)` primitives. The handle is threaded **explicitly** through a child context (`resolveTx` honors it ahead of the ambient `txStore`), because the sandbox drives the body across many host event-loop turns where AsyncLocalStorage context does not survive. Degrades to non-transactional execution when the driver has no transaction support.
  - **runtime**: the QuickJS runner wires `ctx.api.transaction` over three deferred-promise host leaves (begin/commit/rollback), routes in-transaction ops through the tx-scoped context, and rolls back a transaction the body left open before disposing the VM.

- e2b5324: feat(ownership): auto-provision a canonical `owner_id` and hand seeded records to the first admin

  Ownership is now correct-by-default instead of opt-in — closing the gap where
  seeded demo data ended up owned by nobody a human can log in as (so "My" views,
  owner reports and owner notifications were empty out of the box) and where
  author-written objects silently shipped with no working ownership at all.

  - **`applySystemFields` (objectql)** now auto-injects a canonical, reassignable
    `owner_id` lookup (→ `sys_user`) on user-authored business objects, alongside
    the existing tenant/audit fields. Unlike the audit `*_by` lookups it is NOT
    readonly — ownership transfers. Withheld for `managedBy` / `sys_*` tables and
    for objects that opt out via `ownership: 'org' | 'none'` (Dataverse-style). The
    safe default direction: forgetting the opt-out leaves a harmless spare column,
    whereas the old opt-IN model let authors ship objects with broken ownership.
    Once present, the existing machinery engages automatically (insert auto-stamp,
    owner-scoped RLS, owner-keyed views/reports).

  - **`claimSeedOwnership` (plugin-security)**, invoked from `bootstrapPlatformAdmin`
    right after the first human is promoted to platform admin, transfers ownership
    of seeded rows (`owner_id` NULL or `usr_system`) to that admin. The ownership
    twin of org-scoping's `claimOrphanOrgRows`. Idempotent; skips `managedBy` /
    `sys_*`. Authors write plain seed records (no `owner_id`) and the platform —
    not the author — performs the handoff, so there is nothing to remember or
    mistype.

  - **`usr_system` is never minted (runtime + objectql).** The seed loader binds
    `os.user` to a NULL identity, so `cel`os.user.id``resolves to NULL at seed
time (the owning admin does not exist yet) and the row seeds NULL-owned — then
the handoff above fills it. The runtime's`ensureSeedIdentity`(the only code
that inserted a`usr_system`row) is removed.`SystemUserId.SYSTEM`survives
only as a reserved id so legacy DBs' exclusion guards / ownership handoff still
recognize a pre-existing row.`os.org`is unaffected (derived from`organizationId`).

  Also hardens `bootstrapPlatformAdmin` against a latent dts typecheck error
  (defensive read of the untyped `description` on seed permission sets).

### Patch Changes

- Updated dependencies [db02bd5]
- Updated dependencies [641675d]
- Updated dependencies [d9508d1]
- Updated dependencies [1d352d3]
- Updated dependencies [1f88fd9]
- Updated dependencies [94e9040]
- Updated dependencies [f169558]
- Updated dependencies [1f88fd9]
- Updated dependencies [1f88fd9]
- Updated dependencies [e2b5324]
- Updated dependencies [fd07027]
  - @objectstack/driver-sql@9.10.0
  - @objectstack/spec@9.10.0
  - @objectstack/formula@9.10.0
  - @objectstack/plugin-org-scoping@9.10.0
  - @objectstack/plugin-security@9.10.0
  - @objectstack/objectql@9.10.0
  - @objectstack/rest@9.10.0
  - @objectstack/driver-sqlite-wasm@9.10.0
  - @objectstack/core@9.10.0
  - @objectstack/metadata@9.10.0
  - @objectstack/observability@9.10.0
  - @objectstack/driver-memory@9.10.0
  - @objectstack/plugin-auth@9.10.0
  - @objectstack/service-cluster@9.10.0
  - @objectstack/service-i18n@9.10.0
  - @objectstack/types@9.10.0

## 9.9.1

### Patch Changes

- @objectstack/spec@9.9.1
- @objectstack/core@9.9.1
- @objectstack/types@9.9.1
- @objectstack/metadata@9.9.1
- @objectstack/objectql@9.9.1
- @objectstack/observability@9.9.1
- @objectstack/formula@9.9.1
- @objectstack/rest@9.9.1
- @objectstack/driver-memory@9.9.1
- @objectstack/driver-sql@9.9.1
- @objectstack/driver-sqlite-wasm@9.9.1
- @objectstack/plugin-auth@9.9.1
- @objectstack/plugin-org-scoping@9.9.1
- @objectstack/plugin-security@9.9.1
- @objectstack/service-cluster@9.9.1
- @objectstack/service-i18n@9.9.1

## 9.9.0

### Minor Changes

- 11af299: feat(runtime): resolve a reference timezone onto ExecutionContext (ADR-0053 Phase 2 foundation)

  Adds `ExecutionContext.timezone` (optional IANA zone) and resolves it once per request in `resolveExecutionContext`, with precedence **user preference → org default → `UTC`**:

  - User override: `sys_user_preference` row `(user_id, key='timezone')`.
  - Org default: the tenant-scoped `sys_setting` `(namespace='localization', key='timezone', scope='tenant')` — one org per physical tenant (ADR-0002), so no tenant_id filter is needed.
  - An invalid IANA zone is ignored and resolution falls through; every read is defensive and never blocks auth.

  This is **pure plumbing with no behavior change**: nothing reads `ctx.timezone` yet, and an absent value resolves to `UTC` (today's behavior). It is the foundation the rest of ADR-0053 Phase 2 consumes — tz-aware `today()`/`daysFromNow()` (#1980), datetime rendering (#1981), and analytics bucketing (#1982). A discoverable `localization` settings manifest for the org default is a follow-up; the resolver already reads the row if present.

  Part of #1978.

- 9afeb2d: feat(settings): `localization` settings — platform default timezone, language & formats (ADR-0053 Phase 2)

  Adds a `localization` SettingsManifest, the missing keystone that makes the Phase 2 reference-timezone actually configurable end-to-end. One declaration gives the full settings stack for free: platform built-in default → `global` → `tenant` cascade, a permission-gated settings page, and i18n.

  **Keys** (organization-level; per-user overrides intentionally out of scope for v1): `timezone` (UTC), `locale` (en-US), `default_country`, `date_format`, `time_format`, `number_format`, `first_day_of_week`, `currency` (USD), `fiscal_year_start`. Benchmarked against Salesforce/Workday "Company Information + Locale".

  **Resolver 收编** — `resolveExecutionContext` now resolves `timezone` **and** `locale` from the `localization` settings via the `settings` service (canonical 4-tier cascade), falling back to a direct tenant-scoped `sys_setting` read, then `UTC` / `en-US`. This replaces the hand-rolled `sys_user_preference` + tenant-only `sys_setting` path from #1978 (which bypassed the settings abstraction and is dropped along with the per-user tier). New `ExecutionContext.locale`.

  **Consumer wiring** — analytics date bucketing now picks up the resolved org timezone: `DatasetExecutor` threads `ExecutionContext.timezone` into the query (precedence: explicit selection tz → request tz → UTC), so #1982's tz-aware buckets fire for a configured org without callers passing a zone. Formula `today()`/`datetime` were already wired (#1979/#1980).

  Email `datetime` rendering (`SendTemplateInput.timezone`, shipped in #1981) is intentionally **not** wired here: the only current `sendTemplate` callers are pre-session auth emails with no org context; business-notification callers can pass the zone when they appear.

### Patch Changes

- 83fd318: fix(runtime): drive sandbox host calls with deferred promises and a deadline-bounded pump

  The QuickJS sandbox exposed `ctx.api.object(x).find/update/...` via `newAsyncifiedFunction`, which unwinds the WASM stack per host call and forbids a second call while the first is unwound. A script awaiting two host calls in sequence (e.g. an action doing `findOne()` then `update()`) drove the second call from a continuation resumed inside `executePendingJobs`, corrupting the wasm heap (`memory access out of bounds` / `p->ref_count == 0`) or exhausting the fixed 1000-iteration pump budget — surfacing as `action '…' did not resolve after 1000 pump iterations`.

  Host API methods are now exposed as deferred QuickJS promises (`vm.newPromise()`), so sequential `await`s compose with no stack unwinding, and the pump loop is bounded by the configured `timeoutMs` instead of a fixed iteration cap. Host **method** calls now require `await` (the `.object(name)` proxy getter stays synchronous); a stuck/never-settling host call is cut off with a clear timeout error.

- Updated dependencies [84249a4]
- Updated dependencies [0d4e3f3]
- Updated dependencies [44c5348]
- Updated dependencies [796f0d6]
- Updated dependencies [11af299]
- Updated dependencies [d5774b5]
- Updated dependencies [bfa3102]
- Updated dependencies [134043a]
- Updated dependencies [67c29ee]
- Updated dependencies [90108e0]
- Updated dependencies [9afeb2d]
- Updated dependencies [6bec07e]
- Updated dependencies [92d75ca]
- Updated dependencies [601cc11]
- Updated dependencies [d99a75a]
- Updated dependencies [575448d]
  - @objectstack/spec@9.9.0
  - @objectstack/plugin-auth@9.9.0
  - @objectstack/objectql@9.9.0
  - @objectstack/rest@9.9.0
  - @objectstack/driver-sql@9.9.0
  - @objectstack/plugin-security@9.9.0
  - @objectstack/core@9.9.0
  - @objectstack/formula@9.9.0
  - @objectstack/metadata@9.9.0
  - @objectstack/observability@9.9.0
  - @objectstack/driver-memory@9.9.0
  - @objectstack/driver-sqlite-wasm@9.9.0
  - @objectstack/plugin-org-scoping@9.9.0
  - @objectstack/service-cluster@9.9.0
  - @objectstack/service-i18n@9.9.0
  - @objectstack/types@9.9.0

## 9.8.0

### Patch Changes

- Updated dependencies [c17d2c8]
- Updated dependencies [7fe0b91]
- Updated dependencies [76ac582]
- Updated dependencies [97c55b3]
- Updated dependencies [1b1f490]
- Updated dependencies [884bf2f]
  - @objectstack/formula@9.8.0
  - @objectstack/rest@9.8.0
  - @objectstack/objectql@9.8.0
  - @objectstack/spec@9.8.0
  - @objectstack/core@9.8.0
  - @objectstack/metadata@9.8.0
  - @objectstack/observability@9.8.0
  - @objectstack/driver-memory@9.8.0
  - @objectstack/driver-sql@9.8.0
  - @objectstack/driver-sqlite-wasm@9.8.0
  - @objectstack/plugin-auth@9.8.0
  - @objectstack/plugin-org-scoping@9.8.0
  - @objectstack/plugin-security@9.8.0
  - @objectstack/service-cluster@9.8.0
  - @objectstack/service-i18n@9.8.0
  - @objectstack/types@9.8.0

## 9.7.0

### Patch Changes

- Updated dependencies [82c7438]
- Updated dependencies [417b6ac]
- Updated dependencies [ff0a87a]
  - @objectstack/formula@9.7.0
  - @objectstack/objectql@9.7.0
  - @objectstack/spec@9.7.0
  - @objectstack/core@9.7.0
  - @objectstack/types@9.7.0
  - @objectstack/metadata@9.7.0
  - @objectstack/observability@9.7.0
  - @objectstack/rest@9.7.0
  - @objectstack/driver-memory@9.7.0
  - @objectstack/driver-sql@9.7.0
  - @objectstack/driver-sqlite-wasm@9.7.0
  - @objectstack/plugin-auth@9.7.0
  - @objectstack/plugin-org-scoping@9.7.0
  - @objectstack/plugin-security@9.7.0
  - @objectstack/service-cluster@9.7.0
  - @objectstack/service-i18n@9.7.0

## 9.6.0

### Patch Changes

- 71578f2: feat(book): documentation navigation as a `book` element — spine + derived membership (ADR-0046 §6)

  Adds the `book` metadata element: a navigation **spine** (ordered groups + `audience` + identity) whose membership is **derived** by rule (`include` glob/tag) plus optional per-doc `order`/`group`, never a central array. This keeps AI authoring create-and-forget (no central-array read-modify-write) and runtime overlay merge-safe (RFC 7396 treats arrays atomically).

  - `BookSchema` + `resolveBookTree()` derived-membership resolver + `defineBook()` + additive `doc.order`/`doc.group`.
  - Register `book` as a render-time metadata type (`allowOrgOverride: true`); wire it through the runtime type enumerations (PLURAL_TO_SINGULAR, engine registration, artifact field map, type-schema map).
  - REST `GET /meta/book/:name/tree` resolves the tree; read-layer `audience` gating (`public` ≡ anonymous; `org`/`{profile}` require sign-in).

- Updated dependencies [d1e930a]
- Updated dependencies [1b82b64]
- Updated dependencies [71578f2]
- Updated dependencies [bb00a50]
- Updated dependencies [5e3a301]
- Updated dependencies [5db2742]
- Updated dependencies [b04b7e3]
- Updated dependencies [d13df3f]
  - @objectstack/spec@9.6.0
  - @objectstack/plugin-auth@9.6.0
  - @objectstack/objectql@9.6.0
  - @objectstack/rest@9.6.0
  - @objectstack/formula@9.6.0
  - @objectstack/core@9.6.0
  - @objectstack/metadata@9.6.0
  - @objectstack/observability@9.6.0
  - @objectstack/driver-memory@9.6.0
  - @objectstack/driver-sql@9.6.0
  - @objectstack/driver-sqlite-wasm@9.6.0
  - @objectstack/plugin-org-scoping@9.6.0
  - @objectstack/plugin-security@9.6.0
  - @objectstack/service-cluster@9.6.0
  - @objectstack/service-i18n@9.6.0
  - @objectstack/types@9.6.0

## 9.5.1

### Patch Changes

- Updated dependencies [ee72aae]
  - @objectstack/spec@9.5.1
  - @objectstack/core@9.5.1
  - @objectstack/formula@9.5.1
  - @objectstack/metadata@9.5.1
  - @objectstack/objectql@9.5.1
  - @objectstack/observability@9.5.1
  - @objectstack/driver-memory@9.5.1
  - @objectstack/driver-sql@9.5.1
  - @objectstack/driver-sqlite-wasm@9.5.1
  - @objectstack/plugin-auth@9.5.1
  - @objectstack/plugin-org-scoping@9.5.1
  - @objectstack/plugin-security@9.5.1
  - @objectstack/rest@9.5.1
  - @objectstack/service-cluster@9.5.1
  - @objectstack/service-i18n@9.5.1
  - @objectstack/types@9.5.1

## 9.5.0

### Patch Changes

- Updated dependencies [d08551c]
- Updated dependencies [707aeed]
- Updated dependencies [7a103d4]
- Updated dependencies [4b01250]
  - @objectstack/spec@9.5.0
  - @objectstack/rest@9.5.0
  - @objectstack/core@9.5.0
  - @objectstack/formula@9.5.0
  - @objectstack/metadata@9.5.0
  - @objectstack/objectql@9.5.0
  - @objectstack/observability@9.5.0
  - @objectstack/driver-memory@9.5.0
  - @objectstack/driver-sql@9.5.0
  - @objectstack/driver-sqlite-wasm@9.5.0
  - @objectstack/plugin-auth@9.5.0
  - @objectstack/plugin-org-scoping@9.5.0
  - @objectstack/plugin-security@9.5.0
  - @objectstack/service-cluster@9.5.0
  - @objectstack/service-i18n@9.5.0
  - @objectstack/types@9.5.0

## 9.4.0

### Minor Changes

- 0856476: feat(metadata): package-scoped single-item resolution via `?package=` (ADR-0048)

  A single-item metadata GET (`/meta/:type/:name?package=<id>`) now resolves
  package-scoped (prefer-local): when two installed packages ship an item of the
  same `type`/`name`, the requester's own package wins. Previously only the _list_
  endpoint was package-aware; a single-item fetch was context-free, so a
  cross-package collision always resolved to whichever package registered first.

  The fix threads `packageId` end-to-end:

  - `@objectstack/rest` — the cacheable single-item path called `getMetaItemCached`
    (ETag keyed on type+name only) and dropped `?package=`. A `?package=` read now
    bypasses that cache and takes the disambiguating `getMetaItem(type, name,
packageId)` path, so two same-named items never share one cache entry.
  - `@objectstack/objectql` — `protocol.getMetaItem` forwards `packageId` to the
    overlay query (`sys_metadata.package_id`), `MetadataFacade.get`, and
    `registry.getItem`; `MetadataFacade.get` gained an optional `currentPackageId`.
  - `@objectstack/runtime` — the parallel HTTP dispatcher threads `?package=` too.

  This lets the doc viewer (`/apps/:packageId/docs/:name`) resolve one doc scoped
  to its app, so `doc` names no longer need a namespace prefix for uniqueness (the
  prefix becomes a recommended convention, like `page`/`dashboard`/`report`);
  `doc.zod` doc-comments updated accordingly.

### Patch Changes

- Updated dependencies [060467a]
- Updated dependencies [2c8e607]
- Updated dependencies [c1dfe34]
- Updated dependencies [0856476]
- Updated dependencies [fef38ec]
- Updated dependencies [3e675f6]
- Updated dependencies [b678d8c]
- Updated dependencies [b678d8c]
- Updated dependencies [b678d8c]
- Updated dependencies [b678d8c]
- Updated dependencies [b678d8c]
- Updated dependencies [b678d8c]
- Updated dependencies [b678d8c]
  - @objectstack/spec@9.4.0
  - @objectstack/metadata@9.4.0
  - @objectstack/objectql@9.4.0
  - @objectstack/rest@9.4.0
  - @objectstack/driver-sql@9.4.0
  - @objectstack/core@9.4.0
  - @objectstack/formula@9.4.0
  - @objectstack/observability@9.4.0
  - @objectstack/driver-memory@9.4.0
  - @objectstack/driver-sqlite-wasm@9.4.0
  - @objectstack/plugin-auth@9.4.0
  - @objectstack/plugin-org-scoping@9.4.0
  - @objectstack/plugin-security@9.4.0
  - @objectstack/service-cluster@9.4.0
  - @objectstack/service-i18n@9.4.0
  - @objectstack/types@9.4.0

## 9.3.0

### Patch Changes

- 1ada658: ADR-0046 P1: package documentation as metadata. New `doc` metadata element — flat Markdown files under `src/docs/*.md` compile into `docs: DocSchema[]` on the stack and register like any other metadata.

  - spec: `DocSchema` ({ name, label?, content }) in `system/`, `StackDefinition.docs`, `doc` in `MetadataTypeSchema` + type registry (inert data, runtime-creatable) + canonical schema map, `docs → doc` plural mapping.
  - cli: `os build` collects flat `src/docs/*.md` (frontmatter `title:`/first `#` heading → label) and enforces the ADR lint — flat directory, namespace-prefixed snake_case names, namespace required when docs ship, MDX/image ban, same-package relative-link resolution. Same rules surface in `os lint`.
  - objectql: `docs` joins the generic metadata registration loop (manifest + nested plugins).
  - runtime: docs count as app payload; `GET /metadata/doc` list responses omit `content` by default (`?include=content` opts in) so unbounded manuals stay off hot paths.

- Updated dependencies [1ada658]
- Updated dependencies [b08d08d]
- Updated dependencies [6259882]
- Updated dependencies [3219191]
- Updated dependencies [290f631]
- Updated dependencies [50b7b47]
- Updated dependencies [f15d6f6]
- Updated dependencies [f8684ea]
- Updated dependencies [b4765be]
- Updated dependencies [b10aa78]
- Updated dependencies [2796a1f]
  - @objectstack/spec@9.3.0
  - @objectstack/objectql@9.3.0
  - @objectstack/rest@9.3.0
  - @objectstack/metadata@9.3.0
  - @objectstack/core@9.3.0
  - @objectstack/formula@9.3.0
  - @objectstack/observability@9.3.0
  - @objectstack/driver-memory@9.3.0
  - @objectstack/driver-sql@9.3.0
  - @objectstack/driver-sqlite-wasm@9.3.0
  - @objectstack/plugin-auth@9.3.0
  - @objectstack/plugin-org-scoping@9.3.0
  - @objectstack/plugin-security@9.3.0
  - @objectstack/service-cluster@9.3.0
  - @objectstack/service-i18n@9.3.0
  - @objectstack/types@9.3.0

## 9.2.0

### Patch Changes

- Updated dependencies [2f57b75]
- Updated dependencies [2f57b75]
  - @objectstack/spec@9.2.0
  - @objectstack/core@9.2.0
  - @objectstack/formula@9.2.0
  - @objectstack/metadata@9.2.0
  - @objectstack/objectql@9.2.0
  - @objectstack/observability@9.2.0
  - @objectstack/driver-memory@9.2.0
  - @objectstack/driver-sql@9.2.0
  - @objectstack/driver-sqlite-wasm@9.2.0
  - @objectstack/plugin-auth@9.2.0
  - @objectstack/plugin-org-scoping@9.2.0
  - @objectstack/plugin-security@9.2.0
  - @objectstack/rest@9.2.0
  - @objectstack/service-cluster@9.2.0
  - @objectstack/service-i18n@9.2.0
  - @objectstack/types@9.2.0

## 9.1.0

### Patch Changes

- Updated dependencies [b9062c9]
  - @objectstack/spec@9.1.0
  - @objectstack/core@9.1.0
  - @objectstack/formula@9.1.0
  - @objectstack/metadata@9.1.0
  - @objectstack/objectql@9.1.0
  - @objectstack/observability@9.1.0
  - @objectstack/driver-memory@9.1.0
  - @objectstack/driver-sql@9.1.0
  - @objectstack/driver-sqlite-wasm@9.1.0
  - @objectstack/plugin-auth@9.1.0
  - @objectstack/plugin-org-scoping@9.1.0
  - @objectstack/plugin-security@9.1.0
  - @objectstack/rest@9.1.0
  - @objectstack/service-cluster@9.1.0
  - @objectstack/service-i18n@9.1.0
  - @objectstack/types@9.1.0

## 9.0.1

### Patch Changes

- Updated dependencies [1817845]
  - @objectstack/spec@9.0.1
  - @objectstack/core@9.0.1
  - @objectstack/formula@9.0.1
  - @objectstack/metadata@9.0.1
  - @objectstack/objectql@9.0.1
  - @objectstack/observability@9.0.1
  - @objectstack/driver-memory@9.0.1
  - @objectstack/driver-sql@9.0.1
  - @objectstack/driver-sqlite-wasm@9.0.1
  - @objectstack/plugin-auth@9.0.1
  - @objectstack/plugin-org-scoping@9.0.1
  - @objectstack/plugin-security@9.0.1
  - @objectstack/rest@9.0.1
  - @objectstack/service-cluster@9.0.1
  - @objectstack/service-i18n@9.0.1
  - @objectstack/types@9.0.1

## 9.0.0

### Patch Changes

- Updated dependencies [4c3f693]
- Updated dependencies [0bf39f1]
- Updated dependencies [f533f42]
- Updated dependencies [1c83ee8]
  - @objectstack/spec@9.0.0
  - @objectstack/plugin-auth@9.0.0
  - @objectstack/core@9.0.0
  - @objectstack/formula@9.0.0
  - @objectstack/metadata@9.0.0
  - @objectstack/objectql@9.0.0
  - @objectstack/observability@9.0.0
  - @objectstack/driver-memory@9.0.0
  - @objectstack/driver-sql@9.0.0
  - @objectstack/driver-sqlite-wasm@9.0.0
  - @objectstack/plugin-org-scoping@9.0.0
  - @objectstack/plugin-security@9.0.0
  - @objectstack/rest@9.0.0
  - @objectstack/service-cluster@9.0.0
  - @objectstack/service-i18n@9.0.0
  - @objectstack/types@9.0.0

## 8.0.1

### Patch Changes

- @objectstack/spec@8.0.1
- @objectstack/core@8.0.1
- @objectstack/types@8.0.1
- @objectstack/metadata@8.0.1
- @objectstack/objectql@8.0.1
- @objectstack/observability@8.0.1
- @objectstack/formula@8.0.1
- @objectstack/rest@8.0.1
- @objectstack/driver-memory@8.0.1
- @objectstack/driver-sql@8.0.1
- @objectstack/driver-sqlite-wasm@8.0.1
- @objectstack/plugin-auth@8.0.1
- @objectstack/plugin-org-scoping@8.0.1
- @objectstack/plugin-security@8.0.1
- @objectstack/service-cluster@8.0.1
- @objectstack/service-i18n@8.0.1

## 8.0.0

### Minor Changes

- f68be58: feat(runtime): API-key generation endpoint — show-once `sys_api_key` (ADR-0036, closes framework#1629)

  Adds `POST /api/v1/keys` — the only path that mints a `sys_api_key`. Phase 1a
  shipped key _verification_ and the `generateApiKey()` primitive; this is the
  missing _generation_ half that unblocks the self-serve connect flow.

  - Requires an authenticated principal; returns the **raw secret exactly once**
    (`{ id, name, prefix, key }`). Only the sha256 **hash** is persisted — the raw
    key is never stored, logged, or re-displayable.
  - **Security (zero-tolerance):** `user_id` is pinned to the caller and never read
    from the body (no impersonation); the body is whitelisted to `name` (+ optional
    validated future `expires_at`) — any `key`/`id`/`user_id`/`revoked` in the body
    is ignored, so a caller cannot forge a known-secret or escalate. The row is
    written with an elevated `{ isSystem: true }` context (sys_api_key is
    protection-locked) with server-controlled contents. Anonymous → 401;
    non-POST → 405; past/unparseable `expires_at` → 400.
  - `scopes` are intentionally NOT accepted from the body in v1 (the verify path
    adds scopes to permissions, so honouring arbitrary body scopes would be an
    escalation vector); a generated key acts exactly AS the caller via `user_id`
    resolution. Scoped/narrowing keys need subset-enforcement — deferred.

  11 security tests (show-once, hash-not-raw persisted, round-trip auth via the
  verify path, impersonation blocked, forgery blocked, 401/405/400, expiry
  end-to-end). Full runtime suite green (376).

- bc0d85b: feat(mcp): Streamable HTTP transport — every app is a network-reachable MCP server (ADR-0036 Phase 2)

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

### Patch Changes

- 2537e28: fix(runtime): adapt node/Hono req → Web Request for the MCP transport (ADR-0036)

  The MCP Streamable HTTP transport needs a Web-standard `Request`, but the
  runtime HTTP adapter hands the dispatcher a node/Hono-style req (plain `headers`
  object, path-only `url`). `handleMcp` rejected it with 400 ("MCP transport
  requires a standard HTTP request") — so the live endpoint was unusable even
  once routed + registered. Unit tests passed a real `Request`, hiding it; caught
  in staging e2e on `initialize`.

  `handleMcp` now reconstructs a Web `Request` (method, absolute URL from
  host+path, normalised headers, JSON body from the parsed body) when the inbound
  req isn't already Web-standard. Regression tests cover a POST and a GET
  node-style req.

- 0ec7717: fix(runtime): mount /mcp and /keys HTTP routes (ADR-0036) — were unreachable

  The dispatcher mounts routes EXPLICITLY on the HTTP server (no catch-all). The
  MCP transport (#1626) and key-generation (#1630) added branches inside
  `dispatch()` but never registered the corresponding `server.<verb>()` routes, so
  `/api/v1/mcp` and `/api/v1/keys` 404'd at the HTTP layer before ever reaching
  the dispatcher. Unit tests called the handlers directly, hiding the gap; it only
  showed up in live staging e2e.

  - Register `/mcp` (GET/POST/DELETE → dispatch, transport reads the method) and
    `/keys` (POST) in the dispatcher plugin, routed through `dispatch()` so the
    host's project-aware kernel swap + executionContext resolution run first.
  - Add `dispatcher-plugin.routes.test.ts` asserting the routes are registered
    (the regression that would have caught this).

- c262301: fix(rest): REST data API honors sys_api_key — one shared verifier with MCP (closes #1633)

  Staging e2e found the MCP surface authenticated a `sys_api_key` but the REST data
  API (`@objectstack/rest`) returned 401 for the same key — its `resolveExecCtx`
  only checked the better-auth session, never the API key.

  Converged both surfaces onto ONE verifier so they can't drift:

  - **`@objectstack/core/security`** now owns the shared `sys_api_key` primitives
    (`hashApiKey`, `generateApiKey`, `extractApiKey`, `parseScopes`, `isExpired`)
    plus a new `resolveApiKeyPrincipal(ql, headers, nowMs?)` that hashes the
    inbound key, looks it up by the indexed at-rest hash, and rejects unknown /
    revoked / expired / owner-less keys (fail-closed). `core` is the natural home:
    both `rest` and `runtime` depend on it, it depends on neither (no cycle), and
    it's server-side (already uses `node:crypto`).
  - **`@objectstack/runtime`** — `security/api-key.ts` re-exports the primitives
    from core (stable import surface) and `resolveExecutionContext` now delegates
    its API-key branch to `resolveApiKeyPrincipal`.
  - **`@objectstack/rest`** — `resolveExecCtx` resolves the data engine once and
    tries `resolveApiKeyPrincipal` (x-api-key / `Authorization: ApiKey`) BEFORE the
    session, so `/api/v1/data` + `/api/v1/meta` now authenticate an API key under
    the key's permissions + RLS, exactly like the dispatcher/MCP path.

  Tests: core `api-key.test.ts` (primitives + verifier: valid / revoked / expired /
  unknown / owner-less / plaintext-not-matched / fail-closed-ql). runtime + rest
  suites green.

- Updated dependencies [a46c017]
- Updated dependencies [b990b89]
- Updated dependencies [99111ec]
- Updated dependencies [d5a8161]
- Updated dependencies [5cf1f1b]
- Updated dependencies [9ef89d4]
- Updated dependencies [e6374b5]
- Updated dependencies [1e8b680]
- Updated dependencies [0a6438e]
- Updated dependencies [3306d2f]
- Updated dependencies [ae7fb3f]
- Updated dependencies [c262301]
- Updated dependencies [e1478fe]
- Updated dependencies [bc44195]
- Updated dependencies [9e2e229]
- Updated dependencies [345e189]
  - @objectstack/spec@8.0.0
  - @objectstack/objectql@8.0.0
  - @objectstack/driver-sql@8.0.0
  - @objectstack/plugin-auth@8.0.0
  - @objectstack/plugin-security@8.0.0
  - @objectstack/rest@8.0.0
  - @objectstack/core@8.0.0
  - @objectstack/formula@8.0.0
  - @objectstack/metadata@8.0.0
  - @objectstack/observability@8.0.0
  - @objectstack/driver-memory@8.0.0
  - @objectstack/driver-sqlite-wasm@8.0.0
  - @objectstack/plugin-org-scoping@8.0.0
  - @objectstack/service-cluster@8.0.0
  - @objectstack/service-i18n@8.0.0
  - @objectstack/types@8.0.0

## 7.9.0

### Patch Changes

- ac1fc4c: feat(metadata): draft-overlay reads so an admin can render the console off pending drafts before publish

  ADR-0033's loop is `build (draft) → review → publish`, but "review" was only a JSON diff — the one thing that actually confirms an AI/hand-authored change (the rendered object page / kanban / form / nav) only existed _after_ publish. That forces publishing unreviewed metadata just to look at it, defeating the draft gate.

  This adds a request-scoped **draft-overlay read mode** to the metadata resolution layer:

  - `getMetaItems({ …, previewDrafts })` — after the active overlay, overlays `state='draft'` rows on top (draft WINS on name collision; draft-only items surface too). Drafts are never hydrated into the process-wide SchemaRegistry.
  - `getMetaItem({ …, previewDrafts })` — non-strict: prefers a draft row if one exists, else falls back to the active value (unlike the strict `state:'draft'` mode, which 404s `no_draft`).
  - Every overlaid item is tagged `_draft: true` so the UI can badge it and show a "preview" banner.
  - The runtime HTTP dispatcher threads `?preview=draft` on `GET /metadata/:type` and `GET /metadata/:type/:name` into these reads.

  The same overlay also unblocks the AI authoring agent referencing its own just-drafted objects (a follow-up will point `list_metadata` at it). Admin gating of the `?preview=draft` flag is a deliberate follow-up step.

  Note: a brand-new draft object has no physical table until publish, so preview renders its _shape_ (form/view/kanban/nav) but shows no data; field-additions to existing objects preview fully.

- ac1fc4c: feat(packages): one-click discard-drafts and full delete for a package

  Two distinct package-level lifecycle operations, both built on the per-item delete primitive:

  - **`discardPackageDrafts(packageId)`** — drop every pending DRAFT bound to the package, reverting it to its last published baseline. NON-destructive: active/published metadata and physical tables are untouched. Use case: "I edited this app for a while and it turned out worse than before — abandon all my changes." Routes through the sys_metadata path (no metadata-service dependency, unlike the existing `POST /packages/:id/revert`, which 503s without a metadata service). REST: `POST /packages/:id/discard-drafts`.

  - **`deletePackage(packageId)`** — remove the ENTIRE package: every `sys_metadata` row (active + draft) and, by default, the physical table of each object it defined (DESTRUCTIVE). `keepData: true` removes metadata but preserves tables; the `sys_`-table guard still applies. Use case: "I don't want this package anymore." `DELETE /packages/:id` now performs this persisted removal in addition to the in-memory registry unregister it already did (previously it left AI/runtime packages' rows and tables behind); `?keepData=true` opts out of teardown.

  Drafts are deleted before active rows so each object's table is torn down exactly once. Per-item failures are collected without aborting the rest.

- Updated dependencies [ac1fc4c]
- Updated dependencies [ac1fc4c]
- Updated dependencies [ac1fc4c]
  - @objectstack/objectql@7.9.0
  - @objectstack/rest@7.9.0
  - @objectstack/spec@7.9.0
  - @objectstack/core@7.9.0
  - @objectstack/types@7.9.0
  - @objectstack/metadata@7.9.0
  - @objectstack/observability@7.9.0
  - @objectstack/formula@7.9.0
  - @objectstack/driver-memory@7.9.0
  - @objectstack/driver-sql@7.9.0
  - @objectstack/driver-sqlite-wasm@7.9.0
  - @objectstack/plugin-auth@7.9.0
  - @objectstack/plugin-org-scoping@7.9.0
  - @objectstack/plugin-security@7.9.0
  - @objectstack/service-cluster@7.9.0
  - @objectstack/service-i18n@7.9.0

## 7.8.0

### Patch Changes

- a75823a: feat(metadata): expose pending DRAFT metadata (ADR-0033 draft discoverability)

  AI-authored metadata lands as drafts (`sys_metadata` rows with `state='draft'`, bound to an app package), but the only list path — `getMetaItems` — reads the active registry, so drafts were invisible: a just-built app package looked empty and there was no "pending changes" surface.

  - `SysMetadataRepository.listDrafts({type?, packageId?})` lists draft rows (mirrors `list()` but scoped to `state='draft'`, optionally narrowed by package), returning a light header projection (no body) with `packageId`.
  - `protocol.listDrafts({packageId?, type?, organizationId?})` exposes it over the overlay repo.
  - `GET /api/v1/meta/_drafts?packageId=&type=` surfaces it to the console. Registered in the REST server before the greedy `/meta/:type` route (and mirrored in the dispatcher) so `_drafts` is never captured as a metadata type name.

  Read-only; no behavior change to existing list/publish paths. Powers the upcoming Studio "drafts/pending changes" view and draft-aware package contents.

- 4fbb86a: feat(packages): consolidate the package subsystem so AI-built app packages surface in Studio

  The package subsystem was split across two stores that never met: the in-memory
  `SchemaRegistry` (what the dispatcher's `/api/v1/packages` list/detail and
  `getMetaItems({type:'package'})` read — i.e. Studio's package selector) and the durable
  `sys_packages` table (where the AI's auto app package, and any `package`-service publish,
  were written). Nothing reconciled the two, so an AI-created `app.<name>` package never
  appeared in Studio.

  This unifies them around one write primitive and one read source:

  - **`protocol.installPackage`** is now implemented (it was declared-but-missing). It is the
    single canonical write path: it registers the package in the in-memory registry **and**
    best-effort persists it to `sys_packages` via the `package` service. Non-fatal when no
    `package` service is wired (registry write still succeeds).
  - **Dispatcher `POST /api/v1/packages`** routes through `protocol.installPackage` (falling
    back to the bare registry write when the protocol is unavailable), so HTTP installs are
    durable too.
  - **`@objectstack/service-package`** reconciles `sys_packages` back into the registry on
    boot, without clobbering filesystem-registered packages — so persisted packages survive a
    restart and stay visible in the registry-backed read paths.
  - **`@objectstack/service-ai`** `apply_blueprint` now homes an app via
    `protocol.installPackage` (falling back to the legacy `package`-service publish), so the
    app package lands where Studio reads it.

  Still the _legacy_ `package_id` plane — sealed `sys_package_version` versioning and
  cross-environment promotion remain ADR-0027 follow-ups.

- e631f1e: feat(metadata): publish a whole app's drafts in one shot (ADR-0033)

  After an AI builds an app, its metadata is drafted (bound to an app package) and
  had to be published one item at a time. The package-level `POST /packages/:id/publish`
  needs the `metadata` service (503 when absent, e.g. the showcase) and reads the
  in-memory registry, not the drafts.

  - `protocol.publishPackageDrafts({ packageId })` promotes every `sys_metadata`
    draft row bound to the package to active by reusing the per-item
    `publishMetaItem` primitive (overridable/lock guards + runtime registry
    refresh). Per-item failures are collected, not fatal. No `metadata`-service
    dependency.
  - `POST /api/v1/packages/:id/publish-drafts` exposes it (distinct from the
    registry-based `/publish`), returning `{ success, publishedCount, failedCount, published, failed }`.

  Verified live: an AI-built `app.asset_management` (4 drafts) published in one call —
  all 4 promoted to active, drafts cleared, draft objects became queryable.

- 424ab26: fix(seed): reject object-wrapped relationship references and constrain them at compile time

  Seed datasets resolve `lookup` / `master_detail` references by matching the value
  against the target record's externalId — so the value must be the plain natural-key
  string (e.g. `account: 'Acme Corp'`), never a wrapper object like
  `account: { externalId: 'Acme Corp' }`. The wrapper was silently skipped by the
  loader, fell through unresolved, and reached the SQL driver as a non-bindable value —
  masked on an always-empty `:memory:` DB but crashing on a persistent one with
  "SQLite3 can only bind numbers, strings, bigints, buffers, and null" once seeds re-ran
  as updates.

  - `defineDataset` now constrains reference fields to `string | null` at compile time
    (derived from each field's `type`), so the object form is a type error.
  - `SeedLoaderService` now fails loudly with an actionable message (and drops the value
    instead of handing it to the driver) when a reference is an object — consistent
    behavior across all drivers, no longer silently masked.

- Updated dependencies [06f2bbb]
- Updated dependencies [a75823a]
- Updated dependencies [4fbb86a]
- Updated dependencies [e631f1e]
- Updated dependencies [f01f9fa]
- Updated dependencies [6fc2678]
- Updated dependencies [36719db]
- Updated dependencies [424ab26]
  - @objectstack/spec@7.8.0
  - @objectstack/objectql@7.8.0
  - @objectstack/rest@7.8.0
  - @objectstack/formula@7.8.0
  - @objectstack/core@7.8.0
  - @objectstack/metadata@7.8.0
  - @objectstack/observability@7.8.0
  - @objectstack/driver-memory@7.8.0
  - @objectstack/driver-sql@7.8.0
  - @objectstack/driver-sqlite-wasm@7.8.0
  - @objectstack/plugin-auth@7.8.0
  - @objectstack/plugin-org-scoping@7.8.0
  - @objectstack/plugin-security@7.8.0
  - @objectstack/service-cluster@7.8.0
  - @objectstack/service-i18n@7.8.0
  - @objectstack/types@7.8.0

## 7.7.0

### Patch Changes

- Updated dependencies [b391955]
- Updated dependencies [f06b64e]
- Updated dependencies [825ab06]
- Updated dependencies [023bf93]
- Updated dependencies [764c747]
  - @objectstack/spec@7.7.0
  - @objectstack/formula@7.7.0
  - @objectstack/metadata@7.7.0
  - @objectstack/objectql@7.7.0
  - @objectstack/driver-sql@7.7.0
  - @objectstack/core@7.7.0
  - @objectstack/observability@7.7.0
  - @objectstack/driver-memory@7.7.0
  - @objectstack/driver-sqlite-wasm@7.7.0
  - @objectstack/plugin-auth@7.7.0
  - @objectstack/plugin-org-scoping@7.7.0
  - @objectstack/plugin-security@7.7.0
  - @objectstack/rest@7.7.0
  - @objectstack/service-cluster@7.7.0
  - @objectstack/service-i18n@7.7.0
  - @objectstack/types@7.7.0

## 7.6.0

### Minor Changes

- 8e539cc: Implement the `/api/v1/notifications` REST surface (ADR-0030)

  The notification REST routes (`GET /notifications`, `POST /notifications/read`,
  `POST /notifications/read/all`) were declared in the spec but never had a
  server-side handler — no plugin registered the `notification` core service, so
  the routes were never advertised in discovery and `client.notifications.*`
  calls 404'd. (The Console bell works today only because it bypasses these
  endpoints and reads the inbox via the generic data API.)

  This wires the surface end-to-end against the ADR-0030 L5 model:

  - **`MessagingService`** gains an inbox read API: `listInbox(userId, opts)`
    reads `sys_inbox_message` joined with `sys_notification_receipt` for
    read-state (a message is unread until its event has a `read`/`clicked`/
    `dismissed` receipt); `markRead(userId, ids)` and `markAllRead(userId)`
    upsert the receipt to `read`, keyed `(notification_id, user_id,
channel:'inbox')` — updating the existing `delivered` receipt in place,
    inserting only when absent. No reliance on the re-modeled `sys_notification`
    L2 event (which carries no recipient/read columns).
  - **`MessagingServicePlugin`** now also registers the messaging service under
    the `notification` core service slot, so the dispatcher resolves + advertises
    the routes. The legacy `INotificationService.send()` abstraction is unused and
    unconsumed.
  - **`HttpDispatcher`** gains `handleNotification` + a `/notifications` dispatch
    branch: it takes the authenticated user from the execution context and maps
    list / mark-read / mark-all-read to the service. Responses match the spec
    schemas (`{ notifications, unreadCount }`, `{ success, readCount }`).

  Pairs with the objectui SDK consumer repoint (`useClientNotifications` →
  `markRead`/`registerDevice` signatures). Device registration and preference
  endpoints remain out of scope (unimplemented as before).

### Patch Changes

- Updated dependencies [955d4c8]
- Updated dependencies [c4a4cbd]
- Updated dependencies [b046ec2]
- Updated dependencies [2170ad9]
- Updated dependencies [02d6359]
- Updated dependencies [7648242]
- Updated dependencies [8c01eea]
- Updated dependencies [8fa1e7f]
- Updated dependencies [be20aa4]
- Updated dependencies [55866f5]
- Updated dependencies [b7a4f14]
- Updated dependencies [60f9c45]
  - @objectstack/spec@7.6.0
  - @objectstack/formula@7.6.0
  - @objectstack/objectql@7.6.0
  - @objectstack/plugin-auth@7.6.0
  - @objectstack/driver-sqlite-wasm@7.6.0
  - @objectstack/core@7.6.0
  - @objectstack/metadata@7.6.0
  - @objectstack/observability@7.6.0
  - @objectstack/driver-memory@7.6.0
  - @objectstack/driver-sql@7.6.0
  - @objectstack/plugin-org-scoping@7.6.0
  - @objectstack/plugin-security@7.6.0
  - @objectstack/rest@7.6.0
  - @objectstack/service-cluster@7.6.0
  - @objectstack/service-i18n@7.6.0
  - @objectstack/types@7.6.0

## 7.5.0

### Patch Changes

- @objectstack/spec@7.5.0
- @objectstack/core@7.5.0
- @objectstack/types@7.5.0
- @objectstack/metadata@7.5.0
- @objectstack/objectql@7.5.0
- @objectstack/observability@7.5.0
- @objectstack/formula@7.5.0
- @objectstack/rest@7.5.0
- @objectstack/driver-memory@7.5.0
- @objectstack/driver-sql@7.5.0
- @objectstack/driver-sqlite-wasm@7.5.0
- @objectstack/plugin-auth@7.5.0
- @objectstack/plugin-org-scoping@7.5.0
- @objectstack/plugin-security@7.5.0
- @objectstack/service-cluster@7.5.0
- @objectstack/service-i18n@7.5.0

## 7.4.1

### Patch Changes

- @objectstack/spec@7.4.1
- @objectstack/core@7.4.1
- @objectstack/types@7.4.1
- @objectstack/metadata@7.4.1
- @objectstack/objectql@7.4.1
- @objectstack/observability@7.4.1
- @objectstack/formula@7.4.1
- @objectstack/rest@7.4.1
- @objectstack/driver-memory@7.4.1
- @objectstack/driver-sql@7.4.1
- @objectstack/driver-sqlite-wasm@7.4.1
- @objectstack/plugin-auth@7.4.1
- @objectstack/plugin-org-scoping@7.4.1
- @objectstack/plugin-security@7.4.1
- @objectstack/service-cluster@7.4.1
- @objectstack/service-i18n@7.4.1

## 7.4.0

### Minor Changes

- 2faf9f2: External Datasource Federation (ADR-0015) — boot-validation gate (Gate 2).

  Adds `ExternalValidationPlugin` (`createExternalValidationPlugin`) which, on
  `kernel:ready`, validates every federated object against its remote table via
  the `external-datasource` service and applies the datasource's
  `external.validation.onMismatch` policy: `fail` (throws
  `ExternalSchemaMismatchError`, aborting boot — the default), `warn` (logs the
  diff), or `ignore`. No-op when federation is unused.

- 394d34f: Messaging + triggers capability tokens, and notify-by-email recipient resolution.

  Make the `notify` flow node and auto-firing flows usable from a plain
  `defineStack({ requires: [...] })` — no hand-wired plugin instances.

  - **CLI / runtime — new capability tokens.** `messaging` →
    `MessagingServicePlugin` (the `notify` node delivers to the inbox channel
    instead of degrading to a logged no-op); `triggers` →
    `RecordChangeTriggerPlugin` + `ScheduleTriggerPlugin` (autolaunched / schedule
    flows actually fire — pair `triggers` with `job` for cron/interval). Wired
    identically in the CLI `CAPABILITY_PROVIDERS` table and the runtime
    `capability-loader`.
  - **Inbox channel — notify-by-email.** Flows commonly address recipients by
    email (e.g. `{record.assignee}`), but `sys_inbox_message` is keyed by user id.
    The inbox channel now resolves an email-shaped recipient to its `sys_user.id`
    (configurable via `InboxChannelOptions.userObject`), with a verbatim fallback
    when the recipient is not email-shaped, no user matches, or the lookup fails —
    so a failed resolution can never drop the row.

- ff3d006: Screen-flow runtime — interactive `screen` nodes (suspend → render → resume).

  A `screen` node that declares input fields now suspends the run on entry
  (reusing the ADR-0019 durable pause), surfaces a `ScreenSpec` describing the
  form, and resumes with the collected values applied as **bare** flow variables
  so downstream nodes read them via `{var}`. (`waitForInput: false` forces the
  old server pass-through.)

  - **spec**: `AutomationResult.screen?: ScreenSpec`, `ResumeSignal.variables?`
    (bare vars), `IAutomationService.getSuspendedScreen?(runId)`.
  - **service-automation**: the `screen` executor builds the `ScreenSpec` and
    suspends when fields are present; the suspend/resume plumbing threads the
    screen through `FlowSuspendSignal` → `SuspendedRun` → the paused result;
    `resume()` sets `signal.variables` as bare flow variables; `getSuspendedScreen`.
  - **runtime**: `POST /api/v1/automation/:name/runs/:runId/resume` (body
    `{ inputs }`) and `GET …/runs/:runId/screen`, wired through both the
    dispatcher route table and `handleAutomation`.

  Verified end-to-end headlessly: the showcase Reassign Wizard launches → pauses
  at the "New Assignee" screen → resumes with the input → the task is reassigned.
  The objectui `FlowRunner` UI that renders these screens ships separately.

- 5e831de: Seed data: first-class identity binding + loud failures (fixes #1389)

  Records seeded via `defineDataset` / `defineStack({ data })` can now bind to a
  platform user with `cel\`os.user.id\``(and to the org with`cel\`os.org.id\``),
  which previously never resolved at boot.

  - **`os.user` / `os.org` now actually resolve.** The runtime provisions a
    deterministic, non-loginable system user (`usr_system`, role `system`)
    _before_ any seed runs and binds it to `os.user`, so identity-derived seed
    values resolve even on a fresh boot — before the first human sign-up. The
    human login admin remains a separate better-auth identity and need not own
    seed data. Exposed as the canonical `SystemUserId.SYSTEM` constant.
  - **New `SeedLoaderConfig.identity`** carries the `os.user` / `os.org` subject
    into CEL evaluation (`@objectstack/spec`).
  - **Failures are loud, not silent.** A record whose CEL value can't resolve
    (e.g. a required `cel\`os.user.id\`` with no identity) — or that fails to
    write — is now counted as an error, marks the load unsuccessful, and logs an
    actionable message, instead of being silently dropped.

### Patch Changes

- 23c7107: ADR-0020 — converge the three "state machine" declaration shapes to one
  **enforced** `state_machine` validation rule.

  Before this change a record state machine could be declared three ways (a
  `workflow` metadata type, an `object.stateMachines` map, or a `state_machine`
  validation rule) and **none of them were enforced at runtime** — a declarative
  guardrail that was pure decoration, and a hallucination trap for AI authors.

  **Enforcement (`@objectstack/objectql`)**

  - New `validation/rule-validator.ts` evaluates the object's `validations` union
    on the write path: `evaluateValidationRules`, `needsPriorRecord`, and the
    `legalNextStates` introspection helper (all exported from the package root).
  - `state_machine` rules reject illegal `field` transitions on update (with the
    rule's `message`); `script` / `cross_field` predicate rules now also fire
    (they were silently broken on PATCH updates because only the patch, not the
    prior record, was available). The engine plumbs the prior record into
    rule evaluation on single-row update; multi-row (`updateMany`) updates log a
    warning and skip rule evaluation rather than enforce on incomplete data.

  **Convergence / retirement (`@objectstack/spec`) — breaking**

  - Retires the `workflow` metadata type (removed from the metadata-type enum,
    the registry, the schema map, the `workflows` collection key, and the
    plural→singular mapping).
  - Removes the `object.stateMachines` map and the `stack.workflows` array. The
    `state_machine` validation rule is the single canonical home.
  - The XState-style `StateMachineSchema` file is **kept** (still used by the
    agent conversation lifecycle and the discovery protocol); only its role as
    the `workflow` metadata-type backing schema was removed. The optional
    `workflow` **RPC service** surface (`CoreServiceName.workflow`,
    `/api/v1/workflow`, `IWorkflowService`) is kept as a documented follow-up.

  **Introspection (`@objectstack/runtime`)**

  - Adds `GET /metadata/objects/:name/state/:field?from=:state`, returning the
    legal next states for a field (`next: null` when no FSM governs the field,
    `[]` for a declared dead-end) so UIs/agents read the transition table instead
    of re-deriving it.

  **Surfaces (`@objectstack/platform-objects`, `@objectstack/cli`)**

  - Studio drops the standalone "Workflow Rules" nav (state machines are edited
    alongside the object's other validation rules).
  - `explain` no longer lists `workflow` as a related metadata type.

  Migration: replace a `workflow` / `StateMachineConfig` declaration with a
  `state_machine` validation rule on the object (`field` + `{ from: [allowedTo] }`
  transition table), and move any side-effecting actions (emails, task creation)
  into a record-triggered or scheduled Flow (ADR-0019). See the migrated
  `examples/app-crm` flows for the pattern.

- 13632b1: ADR-0030 P0 (framework) — converge notifications onto a single ingress and the
  layered model. Every producer now publishes through
  `NotificationService.emit(EmitInput)`; the in-app inbox is a materialization of
  delivery, not a row producers write.

  **Single ingress (`@objectstack/service-messaging`) — breaking**

  - `MessagingService.emit` takes the new `EmitInput` contract (`topic` /
    `audience` / `payload` / `severity` / `dedupKey` / `source` / `actorId` /
    `organizationId` / `channels`) instead of the flat `Notification` shape. It
    writes the L2 `sys_notification` event (idempotent on `dedupKey`), resolves the
    audience, then fans out; it returns `{ notificationId, deduped, deliveries,
delivered, failed }`.
  - New `sys_notification_receipt` object — the read-state spine
    (`delivered|read|clicked|dismissed`), keyed `(notification_id, user_id,
channel)`. The inbox channel writes a `delivered` receipt on materialization.
  - `sys_inbox_message`: adds `notification_id` / `delivery_id`, **drops `read`**
    (read-state moved to the receipt), adds the user `mine` list view.

  **Event re-model (`@objectstack/platform-objects`) — breaking**

  - `sys_notification` is re-modeled from a per-user inbox into the L2 **event**
    (`topic`, `payload`, `severity`, `dedup_key`, `source_*`, `actor_id`). Removes
    `recipient_id` / `is_read` / `read_at` / `type` / `title` / `body` / `url` /
    `actor_name` and the inbox actions/views. App-nav: the account inbox points at
    `sys_inbox_message`; Setup shows the notification event log.

  **Producers routed through `emit()`**

  - `@objectstack/service-automation`: the `notify` node maps its config to
    `EmitInput`.
  - `@objectstack/plugin-audit`: collaboration `@mention` → `collab.mention` and
    assignment → `collab.assignment` (both with a `dedupKey`); no more direct
    `sys_notification` writes. Collaboration notifications now require
    `MessagingServicePlugin` (they degrade to a warn otherwise).

  **Migration (`@objectstack/metadata`)**

  - Idempotent `migrateSysNotificationToEvent` splits legacy `sys_notification`
    inbox rows into `sys_inbox_message` + receipts and rewrites the event row.

  **Startup (`@objectstack/cli`, `@objectstack/runtime`)**

  - `messaging` is now a foundational capability. On `objectstack serve` it is
    added to `ALWAYS_ON_CAPABILITIES` (every non-`minimal` preset starts it); on
    cloud per-project kernels the capability loader expands `requires` to add
    `messaging` whenever `audit` is present. This keeps collaboration `@mention` /
    assignment notifications (which now flow through the pipeline) working out of
    the box on both paths. `--preset minimal` opts out.

  The Console bell repoint (objectui) and phases P1–P3 are tracked in
  `docs/handoff/adr-0030-notification-convergence.md`.

- Updated dependencies [23c7107]
- Updated dependencies [c72daad]
- Updated dependencies [4404572]
- Updated dependencies [eea3f1b]
- Updated dependencies [e478e0c]
- Updated dependencies [13632b1]
- Updated dependencies [f115182]
- Updated dependencies [24c9013]
- Updated dependencies [2faf9f2]
- Updated dependencies [2faf9f2]
- Updated dependencies [2faf9f2]
- Updated dependencies [2faf9f2]
- Updated dependencies [2faf9f2]
- Updated dependencies [a6d4cbb]
- Updated dependencies [08fbbb4]
- Updated dependencies [58b450b]
- Updated dependencies [82eb6cf]
- Updated dependencies [13d8653]
- Updated dependencies [ff3d006]
- Updated dependencies [5e831de]
  - @objectstack/spec@7.4.0
  - @objectstack/objectql@7.4.0
  - @objectstack/plugin-auth@7.4.0
  - @objectstack/plugin-security@7.4.0
  - @objectstack/metadata@7.4.0
  - @objectstack/driver-sql@7.4.0
  - @objectstack/rest@7.4.0
  - @objectstack/core@7.4.0
  - @objectstack/formula@7.4.0
  - @objectstack/observability@7.4.0
  - @objectstack/driver-memory@7.4.0
  - @objectstack/driver-sqlite-wasm@7.4.0
  - @objectstack/plugin-org-scoping@7.4.0
  - @objectstack/service-cluster@7.4.0
  - @objectstack/service-i18n@7.4.0
  - @objectstack/types@7.4.0

## 7.3.0

### Patch Changes

- Updated dependencies [5e7c554]
  - @objectstack/spec@7.3.0
  - @objectstack/core@7.3.0
  - @objectstack/formula@7.3.0
  - @objectstack/metadata@7.3.0
  - @objectstack/objectql@7.3.0
  - @objectstack/observability@7.3.0
  - @objectstack/driver-memory@7.3.0
  - @objectstack/driver-sql@7.3.0
  - @objectstack/driver-sqlite-wasm@7.3.0
  - @objectstack/plugin-auth@7.3.0
  - @objectstack/plugin-org-scoping@7.3.0
  - @objectstack/plugin-security@7.3.0
  - @objectstack/rest@7.3.0
  - @objectstack/service-cluster@7.3.0
  - @objectstack/service-i18n@7.3.0
  - @objectstack/types@7.3.0

## 7.2.1

### Patch Changes

- 9096dfe: **`OS_` env-var prefix migration** (issue #1382).

  All ObjectStack-owned environment variables now use the `OS_` prefix. Legacy
  names still work for one release and emit a one-shot deprecation warning via
  the new `readEnvWithDeprecation()` helper in `@objectstack/types`.

  **Renamed (with legacy fallback):**

  | New                       | Legacy (deprecated)                                    |
  | :------------------------ | :----------------------------------------------------- |
  | `OS_AUTH_SECRET`          | `AUTH_SECRET`, `BETTER_AUTH_SECRET`                    |
  | `OS_AUTH_URL`             | `AUTH_BASE_URL`, `BETTER_AUTH_URL`, `OS_AUTH_BASE_URL` |
  | `OS_PORT`                 | `PORT`                                                 |
  | `OS_DATABASE_URL`         | `DATABASE_URL`                                         |
  | `OS_ROOT_DOMAIN`          | `ROOT_DOMAIN`                                          |
  | `OS_MULTI_ORG_ENABLED`    | `OS_MULTI_TENANT`                                      |
  | `OS_CORS_ENABLED`         | `CORS_ENABLED`                                         |
  | `OS_CORS_ORIGIN`          | `CORS_ORIGIN`                                          |
  | `OS_CORS_CREDENTIALS`     | `CORS_CREDENTIALS`                                     |
  | `OS_CORS_MAX_AGE`         | `CORS_MAX_AGE`                                         |
  | `OS_AI_MODEL`             | `AI_MODEL`                                             |
  | `OS_MCP_SERVER_ENABLED`   | `MCP_SERVER_ENABLED`                                   |
  | `OS_MCP_SERVER_NAME`      | `MCP_SERVER_NAME`                                      |
  | `OS_MCP_SERVER_TRANSPORT` | `MCP_SERVER_TRANSPORT`                                 |
  | `OS_NODE_ID`              | `OBJECTSTACK_NODE_ID`                                  |
  | `OS_METADATA_WRITABLE`    | `OBJECTSTACK_METADATA_WRITABLE`                        |
  | `OS_DEV_CRYPTO_KEY`       | `OBJECTSTACK_DEV_CRYPTO_KEY`                           |
  | `OS_HOME`                 | `OBJECTSTACK_HOME`                                     |

  **Migration:** rename in your `.env`. Legacy names continue to work this
  release and will be removed in a future major. Industry-standard names
  (`NODE_ENV`, `HOME`, `OPENAI_API_KEY`, `TURSO_*`, OAuth
  `*_CLIENT_ID/SECRET`, `RESEND_API_KEY`, `POSTMARK_TOKEN`,
  `AI_GATEWAY_*`, `SMTP_*`) are NOT renamed.

- Updated dependencies [9096dfe]
  - @objectstack/types@7.2.1
  - @objectstack/objectql@7.2.1
  - @objectstack/plugin-auth@7.2.1
  - @objectstack/metadata@7.2.1
  - @objectstack/spec@7.2.1
  - @objectstack/core@7.2.1
  - @objectstack/observability@7.2.1
  - @objectstack/formula@7.2.1
  - @objectstack/rest@7.2.1
  - @objectstack/driver-memory@7.2.1
  - @objectstack/driver-sql@7.2.1
  - @objectstack/driver-sqlite-wasm@7.2.1
  - @objectstack/plugin-org-scoping@7.2.1
  - @objectstack/plugin-security@7.2.1
  - @objectstack/service-cluster@7.2.1
  - @objectstack/service-i18n@7.2.1

## 7.2.0

### Patch Changes

- @objectstack/spec@7.2.0
- @objectstack/core@7.2.0
- @objectstack/types@7.2.0
- @objectstack/metadata@7.2.0
- @objectstack/objectql@7.2.0
- @objectstack/observability@7.2.0
- @objectstack/formula@7.2.0
- @objectstack/rest@7.2.0
- @objectstack/driver-memory@7.2.0
- @objectstack/driver-sql@7.2.0
- @objectstack/driver-sqlite-wasm@7.2.0
- @objectstack/plugin-auth@7.2.0
- @objectstack/plugin-org-scoping@7.2.0
- @objectstack/plugin-security@7.2.0
- @objectstack/service-cluster@7.2.0
- @objectstack/service-i18n@7.2.0

## 7.1.0

### Patch Changes

- 47a92f4: Promote `email_template` to a first-class metadata type using the canonical
  `EmailTemplateDefinitionSchema`.

  Previously `email_template` had two competing Zod schemas (Prime Directive
  #8 violation): the legacy `EmailTemplateSchema` (a sub-shape of
  `Notification`) and the richer `EmailTemplateDefinitionSchema`. The runtime
  metadata protocol (`packages/objectql/src/protocol.ts`) and Studio's
  property panel registered the legacy one, which is why all the new fields
  (`name`, `label`, `category`, `locale`, `bodyHtml`, `bodyText`, …) were
  reported as “declared in form layout but missing from schema”.

  This change:

  - Repoints the `email_template` entry in `TYPE_TO_SCHEMA`
    (`packages/objectql/src/protocol.ts`) and in
    `BUILTIN_METADATA_TYPE_SCHEMAS`
    (`packages/spec/src/kernel/metadata-type-schemas.ts`) to
    `EmailTemplateDefinitionSchema`. The legacy `EmailTemplateSchema` is
    kept only as an inline sub-shape inside `Notification`.
  - Adds an `emailTemplates` collection to `defineStack()` input
    (`packages/spec/src/stack.zod.ts`), registers it in
    `MAP_SUPPORTED_FIELDS`/`PLURAL_TO_SINGULAR`
    (`packages/spec/src/shared/metadata-collection.zod.ts`), wires it into
    `ARTIFACT_FIELD_TO_TYPE` (`packages/metadata/src/plugin.ts`) and
    `APP_CATEGORY_KEYS` (`packages/runtime/src/app-plugin.ts`).
  - Rewrites `packages/spec/src/system/email-template.form.ts` for the new
    schema with sections for Identity, Subject, HTML body, Plain-text body,
    Variables, Delivery overrides, Status.
  - Ships three reference templates in `examples/app-crm/src/emails/`:
    `crm.deal_won` (rewritten to canonical shape), `crm.welcome` (new),
    `crm.lead_followup` (new), and wires them into the CRM stack via
    `emailTemplates: Object.values(emails)`.

  End-to-end verified in Studio: list view at
  `/_console/apps/studio/metadata/email_template` shows all three entries;
  the detail view renders the EmailTemplatePreview iframe and the property
  panel cleanly renders every canonical field (no missing-schema warnings).
  `GET /api/v1/meta` now returns the new `properties` set
  (`name, label, category, locale, subject, bodyHtml, bodyText, variables,
fromOverride, replyTo, active, isSystem, description`).

- Updated dependencies [47a92f4]
  - @objectstack/spec@7.1.0
  - @objectstack/objectql@7.1.0
  - @objectstack/metadata@7.1.0
  - @objectstack/plugin-auth@7.1.0
  - @objectstack/plugin-org-scoping@7.1.0
  - @objectstack/plugin-security@7.1.0
  - @objectstack/core@7.1.0
  - @objectstack/formula@7.1.0
  - @objectstack/observability@7.1.0
  - @objectstack/driver-memory@7.1.0
  - @objectstack/driver-sql@7.1.0
  - @objectstack/driver-sqlite-wasm@7.1.0
  - @objectstack/rest@7.1.0
  - @objectstack/service-cluster@7.1.0
  - @objectstack/service-i18n@7.1.0
  - @objectstack/types@7.1.0

## 7.0.0

### Major Changes

- dc72172: **Breaking:** Removed `@objectstack/driver-turso` and `@objectstack/knowledge-turso` from the open-core framework.

  The Turso/libSQL driver and its native-vector knowledge adapter now ship exclusively with the **ObjectStack Cloud** distribution (`objectstack-ai/cloud`). Rationale: Turso is used only for cloud/edge multi-tenant deployments — local development uses better-sqlite3 (faster), and the Turso integration is part of ObjectStack's commercial offering.

  ### What moved out

  - `@objectstack/driver-turso` → `objectstack-ai/cloud/packages/driver-turso`
  - `@objectstack/knowledge-turso` → `objectstack-ai/cloud/packages/knowledge-turso`
  - `ITursoPlatformService` contract (spec/contracts/turso-platform.ts) — removed entirely
  - `TursoConfigSchema`, `TursoDriverSpec`, `TursoMultiTenantConfigSchema`, `TenantResolverStrategySchema`, etc. — moved into `@objectstack/driver-turso` (re-exported from cloud)

  ### Framework-side changes

  - `packages/runtime/src/standalone-stack.ts`: `databaseDriver` enum no longer accepts `'turso'`; `libsql://`/`https://` URL detection removed. Cloud builds register the Turso driver via their own stack composition.
  - `packages/runtime/src/cloud/artifact-environment-registry.ts`: dropped `case 'libsql'/'turso'`. Cloud has its own `ArtifactEnvironmentRegistry` that handles Turso.
  - `packages/cli/src/commands/serve.ts`: removed `driverType === 'turso' | 'libsql'` branch.
  - `packages/runtime/package.json`, `packages/cli/package.json`: removed optional peerDep on `@objectstack/driver-turso`.
  - `packages/runtime/tsup.config.ts`: removed `@objectstack/driver-turso` from `external`.
  - `packages/spec/src/contracts/index.ts`: stopped re-exporting `turso-platform.js`.
  - `packages/spec/src/data/index.ts`: stopped re-exporting `driver/turso-multi-tenant.zod`.

  ### Migration for open-source users

  If you used `libsql://` URLs or `@objectstack/driver-turso` directly, either:

  1. Switch to `file:` URLs (better-sqlite3 via `@objectstack/driver-sql`) for local/self-hosted deployments, **or**
  2. Use ObjectStack Cloud, which ships the Turso driver as part of the commercial distribution.

### Patch Changes

- 3a630b6: **Split organization-scoping from `@objectstack/plugin-security` into a new `@objectstack/plugin-org-scoping` package.**

  Per ADR-0002, "tenant" in ObjectStack means _physical_ isolation (one Environment = one database, handled by `@objectstack/driver-turso`'s multi-tenant router). The row-level `organization_id` scoping that previously lived inside SecurityPlugin is a different concept — _logical_ scoping inside a single DB — and now ships as its own plugin.

  ### Breaking changes — `@objectstack/plugin-security`

  - Removed the `multiTenant` constructor option. SecurityPlugin no longer touches `organization_id` on insert and no longer registers the `sys_organization` post-create seed pipeline.
  - Wildcard `current_user.organization_id` RLS policies in the default permission sets are now stripped UNLESS the new `org-scoping` service is registered (i.e. unless `OrgScopingPlugin` is also installed).
  - Removed export `cloneTenantSeedData` (now exposed as `cloneOrgSeedData` from `@objectstack/plugin-org-scoping`).
  - `bootstrapPlatformAdmin()` no longer accepts a `multiTenant` flag and no longer auto-creates a default organization — that behavior moved to `ensureDefaultOrganization()` in the new plugin.

  ### Migration

  Single-tenant deployments — no action required.

  Multi-tenant deployments (previously `new SecurityPlugin({ multiTenant: true })`):

  ```diff
  + import { OrgScopingPlugin } from '@objectstack/plugin-org-scoping';
    import { SecurityPlugin } from '@objectstack/plugin-security';

  + await kernel.use(new OrgScopingPlugin());     // MUST be BEFORE SecurityPlugin
  - await kernel.use(new SecurityPlugin({ multiTenant: true }));
  + await kernel.use(new SecurityPlugin());
  ```

  The runtime's `OS_MULTI_TENANT` env switch — read by `@objectstack/runtime/cloud/ArtifactKernelFactory`, `@objectstack/plugin-dev`, and the `objectstack` CLI's `serve` / `dev` / `start` commands — automatically registers `OrgScopingPlugin` when set to `true`, so projects driven by the CLI need no code changes.

- Updated dependencies [74470ad]
- Updated dependencies [d29617e]
- Updated dependencies [dc72172]
- Updated dependencies [3a630b6]
- Updated dependencies [257954d]
  - @objectstack/spec@7.0.0
  - @objectstack/plugin-auth@7.0.0
  - @objectstack/plugin-security@7.0.0
  - @objectstack/plugin-org-scoping@7.0.0
  - @objectstack/core@7.0.0
  - @objectstack/formula@7.0.0
  - @objectstack/metadata@7.0.0
  - @objectstack/objectql@7.0.0
  - @objectstack/observability@7.0.0
  - @objectstack/driver-memory@7.0.0
  - @objectstack/driver-sql@7.0.0
  - @objectstack/driver-sqlite-wasm@7.0.0
  - @objectstack/rest@7.0.0
  - @objectstack/service-cluster@7.0.0
  - @objectstack/service-i18n@7.0.0
  - @objectstack/types@7.0.0

## 6.9.0

### Patch Changes

- bac7ae5: Fix: AI HTTP routes now see the authenticated user

  `HttpDispatcher.handleAI()` was invoking AI route handlers with only
  `{ body, params, query }` — `req.user` was always `undefined`. This
  silently broke every identity-aware feature that flows through
  `/api/v1/ai/*`:

  - LLM-titled conversations never fired (no actor → `autoCreateConversation`
    early-returned → no message persistence → `summarizeConversation`
    gated on `msgs.length >= 2` never tripped).
  - Permission-aware tool execution fell back to system context (RLS bypass).
  - HITL conversation linkage lost the operator's identity.

  Two root causes were fixed:

  1. `resolve-execution-context.ts` only checked `authService.api.getSession`.
     Modern auth plugins expose the better-auth handle lazily via
     `await authService.getApi()`. Now tries both.
  2. `handleAI()` now threads the resolved `ExecutionContext` into
     `req.user` (`{ userId, displayName, email, roles, permissions,
organizationId }`) before invoking the route handler, mirroring
     the shape the dispatcher-plugin already promises.

  End-to-end browser verification: authenticated chat → message persisted
  → `summarizeConversation` fires → fake-OpenAI receives the title
  prompt → `ai_conversations.title` updated. No code changes required
  in `@objectstack/service-ai`, `assistant-routes.ts`, or
  `agent-routes.ts` — they already consumed `req.user` correctly.

  - @objectstack/spec@6.9.0
  - @objectstack/core@6.9.0
  - @objectstack/types@6.9.0
  - @objectstack/metadata@6.9.0
  - @objectstack/objectql@6.9.0
  - @objectstack/observability@6.9.0
  - @objectstack/formula@6.9.0
  - @objectstack/rest@6.9.0
  - @objectstack/driver-memory@6.9.0
  - @objectstack/driver-sql@6.9.0
  - @objectstack/driver-sqlite-wasm@6.9.0
  - @objectstack/plugin-auth@6.9.0
  - @objectstack/plugin-security@6.9.0
  - @objectstack/service-cluster@6.9.0
  - @objectstack/service-i18n@6.9.0

## 6.8.1

### Patch Changes

- @objectstack/spec@6.8.1
- @objectstack/core@6.8.1
- @objectstack/types@6.8.1
- @objectstack/metadata@6.8.1
- @objectstack/objectql@6.8.1
- @objectstack/observability@6.8.1
- @objectstack/formula@6.8.1
- @objectstack/rest@6.8.1
- @objectstack/driver-memory@6.8.1
- @objectstack/driver-sql@6.8.1
- @objectstack/driver-sqlite-wasm@6.8.1
- @objectstack/plugin-auth@6.8.1
- @objectstack/plugin-security@6.8.1
- @objectstack/service-cluster@6.8.1
- @objectstack/service-i18n@6.8.1

## 6.8.0

### Patch Changes

- 50ccd9c: Fix peer-dependency version range from `workspace:*` to `workspace:^` to avoid
  forced major bumps in fixed-group releases. `workspace:*` expands to an exact
  version on publish; any minor bump of the peer then falls out of range and
  triggers a semver-major bump on the dependent. `workspace:^` expands to `^x.y.z`
  which correctly accepts minor bumps.

  Affects:

  - `service-ai` peer on `@objectstack/embedder-openai`
  - `runtime` peer on `@objectstack/driver-turso`

- Updated dependencies [6e88f77]
- Updated dependencies [c8b9f57]
  - @objectstack/spec@6.8.0
  - @objectstack/rest@6.8.0
  - @objectstack/objectql@6.8.0
  - @objectstack/core@6.8.0
  - @objectstack/formula@6.8.0
  - @objectstack/metadata@6.8.0
  - @objectstack/observability@6.8.0
  - @objectstack/driver-memory@6.8.0
  - @objectstack/driver-sql@6.8.0
  - @objectstack/driver-sqlite-wasm@6.8.0
  - @objectstack/plugin-auth@6.8.0
  - @objectstack/plugin-security@6.8.0
  - @objectstack/service-cluster@6.8.0
  - @objectstack/service-i18n@6.8.0
  - @objectstack/types@6.8.0

## 6.7.1

### Patch Changes

- @objectstack/spec@6.7.1
- @objectstack/core@6.7.1
- @objectstack/types@6.7.1
- @objectstack/metadata@6.7.1
- @objectstack/objectql@6.7.1
- @objectstack/observability@6.7.1
- @objectstack/formula@6.7.1
- @objectstack/rest@6.7.1
- @objectstack/driver-memory@6.7.1
- @objectstack/driver-sql@6.7.1
- @objectstack/driver-sqlite-wasm@6.7.1
- @objectstack/plugin-auth@6.7.1
- @objectstack/plugin-security@6.7.1
- @objectstack/service-cluster@6.7.1
- @objectstack/service-i18n@6.7.1

## 6.7.0

### Patch Changes

- c5efe15: Remove residual coupling to the (already-extracted) `@objectstack/service-cloud` package.

  The cloud distribution was migrated to a separate repo a while back, but the open-core CLI still carried:

  - A dynamic `import('@objectstack/service-cloud')` in the boot-mode dispatch for `cloud` / `runtime` modes.
  - A dev-mode auto-mount that tried to load `createSingleEnvironmentPlugin` from the cloud package (now fully covered by the built-in `RuntimeConfigPlugin`).
  - An ambient `.d.ts` stub for `@objectstack/service-cloud`.
  - A leftover empty `packages/services/service-cloud/` directory (only stale `dist/` + `node_modules/`).
  - Several doc-comment references.

  All gone. The open-core CLI now supports `bootMode: 'standalone'` only — non-standalone modes throw a clear error pointing users to the cloud distribution. No runtime behavior change for standalone users.

- 4944f3a: Fix `npx @objectstack/cli start` crashing with `Cannot find package
'@objectstack/metadata'` (and friends).

  `@objectstack/runtime` dynamically `import()`s `@objectstack/metadata`,
  `@objectstack/objectql`, and the storage drivers (`driver-memory`,
  `driver-sql`, `driver-sqlite-wasm`, `driver-turso`) from
  `createStandaloneStack` / `createDefaultHostConfig`, but they were only
  listed in `devDependencies` — so when the package was installed from npm
  (rather than the workspace) these imports failed at boot.

  They are now declared as real `dependencies`. `@objectstack/driver-mongodb`
  remains an `optionalDependency` because the standalone stack only loads
  it when the user passes a `mongodb://` URL (the failure path already has
  a friendly error message).

  Also adds a small quick-start CLI command (`objectstack start`) that
  auto-creates `~/.objectstack/{data,dist,auth-secret}`, boots an empty
  kernel with Studio + marketplace mounted, and lets users install apps at
  runtime — no `objectstack.config.ts` required.

- e0c593f: Make `@objectstack/driver-turso` an **optional peer dependency** so default `npx @objectstack/cli start` no longer installs `@libsql/client` (~5MB + native binaries) nor `libsql` native modules.

  Rationale: `objectstack start` defaults to `file:` URLs which route to `better-sqlite3` via `driver-sql` (10–15× faster than libsql for OLTP, see benchmarks). For RAG / vector workloads, `sqlite-vec` (~600KB) is the recommended local backend. Turso / libsql is only useful when the user explicitly opts in via `libsql://` / `https://` / `--database-driver turso`.

  Changes:

  - `packages/cli/package.json`: moved `@objectstack/driver-turso` from `dependencies` to optional `peerDependencies` (`peerDependenciesMeta.optional = true`). npm 7+ does **not** auto-install optional peers; `optionalDependencies` would have still installed it.
  - `packages/runtime/package.json`: same.
  - All three dynamic-import sites for `driver-turso` (`runtime/src/standalone-stack.ts`, `runtime/src/cloud/artifact-environment-registry.ts`, `cli/src/commands/serve.ts`) now wrap the `import()` in try/catch with an actionable error message pointing users to `npm install @objectstack/driver-turso`.

  Verified in `/tmp/os-sim`: fresh `npm install @objectstack/cli` no longer contains `node_modules/@libsql`, `node_modules/libsql`, or `node_modules/@objectstack/driver-turso`. `objectstack start` boots cleanly with better-sqlite3; `--database libsql://…` produces the friendly error.

- Updated dependencies [4944f3a]
- Updated dependencies [430067b]
- Updated dependencies [4f9e9d4]
  - @objectstack/driver-sql@6.7.0
  - @objectstack/spec@6.7.0
  - @objectstack/driver-sqlite-wasm@6.7.0
  - @objectstack/core@6.7.0
  - @objectstack/formula@6.7.0
  - @objectstack/metadata@6.7.0
  - @objectstack/objectql@6.7.0
  - @objectstack/observability@6.7.0
  - @objectstack/driver-memory@6.7.0
  - @objectstack/plugin-auth@6.7.0
  - @objectstack/plugin-security@6.7.0
  - @objectstack/rest@6.7.0
  - @objectstack/service-cluster@6.7.0
  - @objectstack/service-i18n@6.7.0
  - @objectstack/types@6.7.0

## 6.6.0

### Patch Changes

- Updated dependencies [a49cfc2]
  - @objectstack/spec@6.6.0
  - @objectstack/core@6.6.0
  - @objectstack/formula@6.6.0
  - @objectstack/observability@6.6.0
  - @objectstack/plugin-auth@6.6.0
  - @objectstack/plugin-security@6.6.0
  - @objectstack/rest@6.6.0
  - @objectstack/service-cluster@6.6.0
  - @objectstack/service-i18n@6.6.0
  - @objectstack/types@6.6.0

## 6.5.1

### Patch Changes

- Updated dependencies [de239ef]
  - @objectstack/plugin-auth@6.5.1
  - @objectstack/spec@6.5.1
  - @objectstack/core@6.5.1
  - @objectstack/types@6.5.1
  - @objectstack/observability@6.5.1
  - @objectstack/formula@6.5.1
  - @objectstack/rest@6.5.1
  - @objectstack/plugin-security@6.5.1
  - @objectstack/service-cluster@6.5.1
  - @objectstack/service-i18n@6.5.1

## 6.5.0

### Patch Changes

- @objectstack/spec@6.5.0
- @objectstack/core@6.5.0
- @objectstack/types@6.5.0
- @objectstack/observability@6.5.0
- @objectstack/formula@6.5.0
- @objectstack/rest@6.5.0
- @objectstack/plugin-auth@6.5.0
- @objectstack/plugin-security@6.5.0
- @objectstack/service-i18n@6.5.0
- @objectstack/service-cluster@5.1.8

## 6.4.0

### Patch Changes

- Updated dependencies [f8651cc]
- Updated dependencies [f8651cc]
- Updated dependencies [0bf6f9a]
- Updated dependencies [0bf6f9a]
  - @objectstack/spec@6.4.0
  - @objectstack/plugin-auth@6.4.0
  - @objectstack/core@6.4.0
  - @objectstack/formula@6.4.0
  - @objectstack/observability@6.4.0
  - @objectstack/plugin-security@6.4.0
  - @objectstack/rest@6.4.0
  - @objectstack/service-cluster@5.1.7
  - @objectstack/service-i18n@6.4.0
  - @objectstack/types@6.4.0

## 6.3.0

### Patch Changes

- @objectstack/spec@6.3.0
- @objectstack/core@6.3.0
- @objectstack/types@6.3.0
- @objectstack/observability@6.3.0
- @objectstack/formula@6.3.0
- @objectstack/rest@6.3.0
- @objectstack/plugin-auth@6.3.0
- @objectstack/plugin-security@6.3.0
- @objectstack/service-i18n@6.3.0
- @objectstack/service-cluster@5.1.6

## 6.2.0

### Patch Changes

- dbb54e1: Fix: AI streaming endpoints (e.g. `POST /api/v1/ai/assistant/chat`) now
  actually stream Server-Sent Events instead of returning the stream
  descriptor JSON-serialized.

  The shared `sendResultBase()` in `dispatcher-plugin.ts` previously had a
  `// pass through as JSON for now` TODO, so any dispatcher route whose
  `result.result` was a stream descriptor (`{ type: 'stream', events,
headers, ... }`) would respond with a literal `{"type":"stream",
"events":{},"vercelDataStream":true,...}` body — breaking
  `@object-ui/plugin-chatbot` and any other Vercel-AI-SDK consumer.

  The dispatcher now:

  - Detects `{ type: 'stream' | stream: true, events, headers? }` shapes.
  - Applies the route-provided headers (defaults to
    `text/event-stream`/`no-cache`/`keep-alive` when none are supplied).
  - Performs an empty `res.write('')` synchronously so the Hono adapter's
    `isStreaming` flag flips before the route handler resolves (the adapter
    would otherwise close the body before the first async chunk lands).
  - Drains the `AsyncIterable<string>` of pre-encoded SSE chunks in the
    background, calling `res.end()` when the iterator finishes or errors.

  Non-stream `result.result` payloads keep the existing JSON behaviour.

- Updated dependencies [b4c74a9]
- Updated dependencies [b4c74a9]
  - @objectstack/plugin-auth@6.2.0
  - @objectstack/spec@6.2.0
  - @objectstack/core@6.2.0
  - @objectstack/formula@6.2.0
  - @objectstack/observability@6.2.0
  - @objectstack/plugin-security@6.2.0
  - @objectstack/rest@6.2.0
  - @objectstack/service-cluster@5.1.5
  - @objectstack/service-i18n@6.2.0
  - @objectstack/types@6.2.0

## 6.1.1

### Patch Changes

- @objectstack/spec@6.1.1
- @objectstack/core@6.1.1
- @objectstack/types@6.1.1
- @objectstack/observability@6.1.1
- @objectstack/formula@6.1.1
- @objectstack/rest@6.1.1
- @objectstack/plugin-auth@6.1.1
- @objectstack/plugin-security@6.1.1
- @objectstack/service-i18n@6.1.1
- @objectstack/service-cluster@5.1.4

## 6.1.0

### Patch Changes

- Updated dependencies [93c0589]
  - @objectstack/spec@6.1.0
  - @objectstack/core@6.1.0
  - @objectstack/formula@6.1.0
  - @objectstack/observability@6.1.0
  - @objectstack/plugin-auth@6.1.0
  - @objectstack/plugin-security@6.1.0
  - @objectstack/rest@6.1.0
  - @objectstack/service-cluster@5.1.3
  - @objectstack/service-i18n@6.1.0
  - @objectstack/types@6.1.0

## 6.0.0

### Major Changes

- 944f187: # v5.0 — `project` → `environment` hard rename

  The runtime concept previously called **"project"** (per-tenant business
  workspace; Org → **Project** → Branch hierarchy; per-project ObjectKernel,
  per-project DB, per-project artifact) is now uniformly called
  **"environment"**.

  This is a **hard rename with no aliases, deprecation shims, or compatibility
  layer**. Upgrade requires a coordinated update of CLI, runtime, server, and any
  clients calling the REST API.

  > Note: "project" in the npm / monorepo sense (the framework itself, `package.json`,
  > tsconfig project references, vitest `projects` config) is **unchanged**.

  ## Breaking changes

  ### CLI

  - Flags renamed:
    - `--project` / `-p` → `--environment` / `-e` (`os publish`, `os rollback`)
    - `--project-id` → `--environment-id` (`os dev`)
  - Default local env id: `proj_local` → `env_local`.
  - Env var: `OS_PROJECT_ID` → `OS_ENVIRONMENT_ID`.
  - Command group renamed: `os projects ...` → `os environments ...`
    (`bind`, `create`, `list`, `show`, `switch`).
  - Persisted auth-config key: `activeProjectId` → `activeEnvironmentId`.

  ### HTTP / REST

  - Scoped routes: `/api/v1/projects/:projectId/...` → `/api/v1/environments/:environmentId/...`.
  - Cloud control-plane routes: `/api/v1/cloud/projects/...` → `/api/v1/cloud/environments/...`
    (including `/cloud/environments/:id/artifact`, `/cloud/environments/:id/metadata`,
    `/cloud/environments/:id/credentials/rotate`, etc.).
  - Header: `X-Project-Id` (and lowercase `x-project-id`) → `X-Environment-Id`
    (`x-environment-id`).
  - Route param name in handlers: `req.params.projectId` → `req.params.environmentId`.
  - Hostname-routing and tenant-resolution code-paths use `environmentId` end-to-end.

  ### Runtime / spec

  - Exported symbols (no aliases):
    - `createSystemProjectPlugin` → `createSystemEnvironmentPlugin`
    - `SYSTEM_PROJECT_ID` → `SYSTEM_ENVIRONMENT_ID`
    - `ProjectArtifactSchema` → `EnvironmentArtifactSchema`
    - `PROJECT_ARTIFACT_SCHEMA_VERSION` → `ENVIRONMENT_ARTIFACT_SCHEMA_VERSION`
    - `ObjectOSProjectPlugin` → `ObjectOSEnvironmentPlugin`
    - `createSingleProjectPlugin` → `createSingleEnvironmentPlugin`
  - Plugin identifier strings:
    - `com.objectstack.runtime.objectos-project` → `objectos-environment`
    - `com.objectstack.studio.single-project` → `single-environment`
    - `com.objectstack.multi-project` → `multi-environment`
    - `com.objectstack.runtime.system-project` → `system-environment`
  - Provisioning hook: `provisionSystemProject` → `provisionSystemEnvironment`.

  ### Database / schemas

  - Column renames on `sys_metadata` and `sys_metadata_history`:
    `project_id` → `environment_id`.
  - Column renames on `sys_activity`: `project_id` → `environment_id` (plus index).
  - Object renames in platform-objects metadata: `sys_project` → `sys_environment`
    (lookup targets), `sys_project_member` → `sys_environment_member`,
    `sys_project_credential` → `sys_environment_credential`.
  - Auth-context field: `active_project_id` → `active_environment_id`.
  - JSON schemas under `packages/spec/json-schema/system/`:
    `ProjectArtifact*.json` → `EnvironmentArtifact*.json` (regenerated at build).

  ### Automatic forward migration

  A new migration `migrateProjectIdToEnvironmentId`
  (`packages/metadata/src/migrations/migrate-project-id-to-environment-id.ts`)
  auto-runs from `DatabaseLoader.ensureSchema()` on bootstrap and rewrites any
  existing `project_id` column on `sys_metadata` / `sys_metadata_history` to
  `environment_id` (idempotent, best-effort). Existing rows are preserved.

  The legacy reverse migration `migrateEnvIdToProjectId` is retained verbatim
  for historical / disaster-recovery use; it is **not** auto-run.

  ## Migration guide

  ```diff
  -os publish --project proj_xyz
  +os publish --environment env_xyz

  -curl -H "X-Project-Id: env_xyz" https://api.example.com/api/v1/data/customer
  +curl -H "X-Environment-Id: env_xyz" https://api.example.com/api/v1/data/customer

  -OS_PROJECT_ID=env_xyz os dev
  +OS_ENVIRONMENT_ID=env_xyz os dev

  -import { createSystemProjectPlugin, SYSTEM_PROJECT_ID } from "@objectstack/runtime";
  +import { createSystemEnvironmentPlugin, SYSTEM_ENVIRONMENT_ID } from "@objectstack/runtime";

  -import { ProjectArtifactSchema } from "@objectstack/spec";
  +import { EnvironmentArtifactSchema } from "@objectstack/spec";
  ```

  If you maintain a Cloud control-plane deployment, the `cloud` repository must
  be updated in lockstep to pick up the new plugin identifier strings
  (`single-environment`, `multi-environment`, `objectos-environment`).

### Patch Changes

- Updated dependencies [629a716]
- Updated dependencies [dbc4f7d]
- Updated dependencies [944f187]
  - @objectstack/spec@6.0.0
  - @objectstack/rest@6.0.0
  - @objectstack/core@6.0.0
  - @objectstack/formula@6.0.0
  - @objectstack/observability@6.0.0
  - @objectstack/plugin-auth@6.0.0
  - @objectstack/plugin-security@6.0.0
  - @objectstack/service-cluster@5.1.2
  - @objectstack/service-i18n@6.0.0
  - @objectstack/types@6.0.0

## 5.2.0

### Patch Changes

- b806f58: Scope `sys_user` visibility to fellow organization members.

  The default RLS policy on `sys_user` was `id = current_user.id`, which meant
  @-mention pickers, owner/assignee lookups, reviewer selectors and the user
  roster all returned just the current user. The RLS compiler doesn't support
  subqueries, so a `id IN (SELECT user_id FROM sys_member ...)` policy isn't
  expressible.

  This change:

  1. Pre-resolves `org_user_ids` (the IDs of all users in the active org) into
     `ExecutionContext` in **all three** REST entry-point resolvers
     (`@objectstack/rest`, `@objectstack/runtime`, `@objectstack/plugin-hono-server`).
  2. Adds the field to `ExecutionContextSchema` so it survives Zod parsing.
  3. Adds an `org_user_ids` field to the RLS compiler's user context.
  4. Adds a new `sys_user_org_members` policy (`id IN (current_user.org_user_ids)`)
     to both `member_default` and `viewer_readonly` permission sets, alongside
     the existing `sys_user_self` policy. The RLS compiler OR-combines them, so
     users see themselves AND their org collaborators.

  Capped at 1000 members per request. Large enterprises should plug in a
  directory cache or split per workspace.

- Updated dependencies [bab2b20]
- Updated dependencies [fa011d8]
- Updated dependencies [b806f58]
  - @objectstack/spec@5.2.0
  - @objectstack/plugin-security@5.2.0
  - @objectstack/rest@5.2.0
  - @objectstack/plugin-auth@5.2.0
  - @objectstack/core@5.2.0
  - @objectstack/formula@5.2.0
  - @objectstack/observability@5.2.0
  - @objectstack/service-cluster@5.1.1
  - @objectstack/service-i18n@5.2.0
  - @objectstack/types@5.2.0

## 5.1.0

### Patch Changes

- Updated dependencies [75f4ee6]
- Updated dependencies [823d559]
  - @objectstack/spec@5.1.0
  - @objectstack/core@5.1.0
  - @objectstack/formula@5.1.0
  - @objectstack/observability@5.1.0
  - @objectstack/plugin-auth@5.1.0
  - @objectstack/plugin-security@5.1.0
  - @objectstack/rest@5.1.0
  - @objectstack/service-i18n@5.1.0
  - @objectstack/types@5.1.0

## 5.0.0

### Minor Changes

- 5e9dcb4: **BREAKING — metadata: remove `project` and `branch` from `MetaRef`**

  The metadata layer no longer models project or branch. Customisation is now
  scoped purely to **organisation**. Project remains exclusively as an artifact
  packaging concept (the `objectstack.json` bundle envelope); branching is left
  to Git.

  What changed:

  - `MetaRef` is now `{ org, type, name, version? }` (was
    `{ org, project, branch, type, name, version? }`). `refKey()` is the two
    segment string `${org}/${type}/${name}` (was five segments).
  - `MetadataItem.seq` is monotonic **per org** (was per branch).
  - `BranchRef`, `MergeStrategy`, `MergeResult` types and the optional
    `fork`/`merge` methods on `MetadataRepository` are removed.
  - `ListFilter` / `WatchFilter` / `HistoryOptions` no longer accept `project`
    or `branch`.
  - `FileSystemRepository` disk layout simplified to
    `<root>/<type>/<name>.json` (was `<root>/<project>/<branch>/<type>/<name>.json`);
    change-log path is now `.objectstack/.log/main.jsonl` regardless of any
    branch concept. Constructor no longer accepts `project` / `branch`.
  - `SysMetadataRepository`: removed `projectLabel` / `branchLabel` options;
    the `sys_metadata` schema's `project_id` / `branch` columns (if present)
    are ignored. A future major release will `DROP` them.
  - `MetadataManager.setRepository(repo, opts)` no longer takes an opts object
    with `branch`.

  Migration:

  ```diff
  -const ref = { org: 'acme', project: 'crm', branch: 'main', type: 'view', name: 'home' };
  +const ref = { org: 'acme', type: 'view', name: 'home' };

  -new FileSystemRepository({ root, org: 'acme', project: 'crm', branch: 'main' });
  +new FileSystemRepository({ root, org: 'acme' });
  ```

  Existing `sys_metadata` rows continue to load; the deprecated columns are
  ignored at read time.

### Patch Changes

- 96ad4df: Fix dev-mode HMR data-reload for `*.view.ts` / `*.flow.ts` source-file edits.

  Three coordinated fixes close the long-standing gap where editing a
  declarative-metadata source file in dev (e.g. `case.view.ts`) would
  recompile `dist/objectstack.json` but the running server kept serving
  the stale boot-time value:

  1. **`@objectstack/objectql`** — `ObjectStackProtocolImplementation.getMetaItem`
     now consults `MetadataService` (HMR-aware) **before** the in-memory
     `SchemaRegistry` (boot-time cache). Previously the registry shadowed
     freshly-registered values: `manager.register('view','case',newDef)`
     updated MetadataManager but `getMetaItem` returned the stale registry
     copy because step 2 (registry) ran before step 3 (service). Reordered
     to "1. sys_metadata overlay → 2. MetadataService → 3. SchemaRegistry".

  2. **`@objectstack/runtime`** — `createStandaloneStack` now enables the
     `MetadataPlugin` artifact-file watcher in non-production environments
     (`NODE_ENV !== 'production'`). Previously hard-coded to `watch: false`,
     leaving nothing watching `dist/objectstack.json` when the CLI dev mode
     recompiled it.

  3. **`@objectstack/metadata`** & **`@objectstack/metadata-fs`** — Both
     chokidar watchers now use `usePolling: true` to avoid `fs.watch`
     EMFILE on macOS / busy dev hosts where the native file-descriptor
     pool can be exhausted by other long-running node processes.

  With these three changes:

  - CLI edits source → recompile artifact (~400ms)
  - Server's polling chokidar detects artifact change → `_loadFromLocalFile`
  - `_loadFromLocalFile` calls `manager.register(type, name, item)`
  - MetadataService now has the fresh value
  - Read path returns the fresh value via the new step-2 lookup
  - Studio SSE listeners re-render

- df18ae9: Fix dev-mode HMR data-reload for view metadata.

  `MetadataPlugin._parseAndRegisterArtifact` previously required a top-level
  `name` on every artifact item and silently skipped those without one.
  View bundles in the compiled artifact carry no top-level `name` (their
  identity is the target object, encoded under `list.data.object` /
  `form.data.object` — same pattern used by `ObjectQL.SchemaRegistry`'s
  `resolveMetadataItemName`). As a result, artifact-loaded views never
  reached `MetadataManager`, and HMR file pushes never affected the read
  path: API responses kept returning the boot-time `SchemaRegistry` copy.

  This change derives the registration key from `list.data.object` (or
  `form.data.object`) when no top-level `name` is present, mirroring the
  ObjectQL convention.

  Also splits the `MetadataPlugin` watch flag into two independent
  options so dev mode can enable artifact-file HMR without paying the
  cost of the source-file scanner:

  - `watch` — controls `NodeMetadataManager`'s recursive source scan
    (default `false`; turning it on in artifact mode would polling-scan
    the entire project root including `node_modules`).
  - `artifactWatch` — controls the cheap single-file polling watcher on
    the compiled artifact (`dist/objectstack.json`). The standalone stack
    enables this automatically when `NODE_ENV !== 'production'`.

- Updated dependencies [5cfdc85]
- Updated dependencies [2f9073a]
  - @objectstack/rest@5.0.0
  - @objectstack/spec@5.0.0
  - @objectstack/plugin-auth@5.0.0
  - @objectstack/plugin-security@5.0.0
  - @objectstack/core@5.0.0
  - @objectstack/formula@5.0.0
  - @objectstack/observability@5.0.0
  - @objectstack/service-i18n@5.0.0
  - @objectstack/types@5.0.0

## 4.2.0

### Patch Changes

- Updated dependencies [2869891]
  - @objectstack/spec@4.2.0
  - @objectstack/rest@4.2.0
  - @objectstack/core@4.2.0
  - @objectstack/formula@4.2.0
  - @objectstack/plugin-auth@4.2.0
  - @objectstack/plugin-security@4.2.0
  - @objectstack/service-i18n@4.2.0
  - @objectstack/types@4.2.0

## 4.1.1

### Patch Changes

- @objectstack/spec@4.1.1
- @objectstack/core@4.1.1
- @objectstack/types@4.1.1
- @objectstack/formula@4.1.1
- @objectstack/rest@4.1.1
- @objectstack/plugin-auth@4.1.1
- @objectstack/plugin-security@4.1.1
- @objectstack/service-i18n@4.1.1

## 4.1.0

### Minor Changes

- 96fb108: Artifact-first boot: `objectstack start` (and `objectstack serve`) now boot directly from a compiled `dist/objectstack.json` when no `objectstack.config.ts` is present.

  - `@objectstack/runtime` exports `createDefaultHostConfig()` and `resolveDefaultArtifactPath()` — a standalone-only default host that wraps `createStandaloneStack()` and surfaces the artifact's `requires` / `objects` / `manifest`. No dependency on `@objectstack/service-cloud`.
  - `objectstack start` accepts `OS_ARTIFACT_PATH` as a file path **or** an `http(s)://` URL. New flags `--artifact`, `--database`, `--database-driver`, `--database-auth-token`, `--auth-secret`, `--project-id`, `--port` let you specify all runtime conditions on the command line (each overrides the matching env var).
  - `objectstack dev` accepts the same runtime-override flags. When `--artifact` is supplied, the auto-compile step is skipped and the dev server boots the supplied artifact directly — no `objectstack.config.ts` required in cwd.
  - `objectstack start` no longer mounts Studio / Account / Console by default — those are dev/admin surfaces. Pass `--ui` to opt back in.
  - `objectstack serve` falls back to the default host config when the config file is missing but an artifact is resolvable.
  - `apps/objectos` (cloud / multi-project) is unchanged.

- 70db902: Add production observability primitives. `createDispatcherPlugin` now
  exposes an `observability` config that auto-instruments every mounted
  route with:

  - Request-id propagation: `X-Request-Id` echo + `req.requestId` (honors
    incoming header when well-formed, mints `req_<uuid>` otherwise).
  - `http_requests_total{method,route,status}` counter.
  - `http_request_duration_ms{method,route}` histogram.
  - `http_request_errors_total{method,route}` counter.
  - Error reporter call for 5xx (4xx are intentionally tracked via
    metrics only, not reported, to keep APM signal:noise high).

  All defaults are no-op (zero overhead). Hosts plug their own
  `MetricsRegistry` (Prometheus / OTel) and `ErrorReporter` (Sentry /
  Datadog) — see `docs/OBSERVABILITY.md` for adapter recipes and the
  go-live checklist.

  Standalone primitives also exported for adapter-layer use:
  `extractRequestId`, `resolveRequestId`, `parseTraceparent`,
  `formatTraceparent`, `InMemoryMetricsRegistry`,
  `InMemoryErrorReporter`, `instrumentRouteHandler`.

- 70db902: Add production HTTP hardening primitives. `createDispatcherPlugin` now
  sends conservative security response headers by default
  (CSP / X-Content-Type-Options / X-Frame-Options / Referrer-Policy /
  Permissions-Policy / Cross-Origin-Resource-Policy). HSTS is opt-in.

  Caller can disable with `securityHeaders: false` (e.g., when an upstream
  reverse proxy already injects them) or customize per-header via
  `SecurityHeadersOptions`.

  Also exports a standalone token-bucket `RateLimiter` with a pluggable
  `RateLimitStore` interface (in-memory default; trivially backed by
  Redis) and curated `DEFAULT_RATE_LIMITS` for auth / write / read buckets.
  The limiter is NOT auto-wired into the dispatcher — adapter-layer
  wire-up (Fastify / Hono / Express) is recommended for proper IP/key
  extraction; see `docs/HARDENING.md` for recipes.

### Patch Changes

- Updated dependencies [2108c30]
- Updated dependencies [23db640]
- Updated dependencies [d3b455f]
  - @objectstack/spec@4.1.0
  - @objectstack/plugin-security@4.1.0
  - @objectstack/core@4.1.0
  - @objectstack/formula@4.1.0
  - @objectstack/plugin-auth@4.1.0
  - @objectstack/rest@4.1.0
  - @objectstack/service-i18n@4.1.0
  - @objectstack/types@4.1.0

## 4.0.5

### Patch Changes

- 15e0df6: chore: unify all package versions to a single patch release
- Updated dependencies [15e0df6]
  - @objectstack/spec@4.0.5
  - @objectstack/core@4.0.5
  - @objectstack/types@4.0.5
  - @objectstack/formula@4.0.5
  - @objectstack/rest@4.0.5

## 4.0.4

### Patch Changes

- Updated dependencies [326b66b]
  - @objectstack/spec@4.0.4
  - @objectstack/core@4.0.4
  - @objectstack/rest@4.0.4
  - @objectstack/types@4.0.4

## 4.0.3

### Patch Changes

- @objectstack/spec@4.0.3
- @objectstack/core@4.0.3
- @objectstack/types@4.0.3
- @objectstack/rest@4.0.3

## 4.0.2

### Patch Changes

- Updated dependencies [5f659e9]
  - @objectstack/spec@4.0.2
  - @objectstack/core@4.0.2
  - @objectstack/rest@4.0.2
  - @objectstack/types@4.0.2

## 4.0.0

### Patch Changes

- f08ffc3: Fix discovery API endpoint routing and protocol consistency.

  **Discovery route standardization:**

  - All adapters (Express, Fastify, Hono, NestJS, Next.js, Nuxt, SvelteKit) now mount the discovery endpoint at `{prefix}/discovery` instead of `{prefix}` root.
  - `.well-known/objectstack` redirects now point to `{prefix}/discovery`.
  - Client `connect()` fallback URL changed from `/api/v1` to `/api/v1/discovery`.
  - Runtime dispatcher handles both `/discovery` (standard) and `/` (legacy) for backward compatibility.

  **Schema & route alignment:**

  - Added `storage` (service: `file-storage`) and `feed` (service: `data`) routes to `DEFAULT_DISPATCHER_ROUTES`.
  - Added `feed` and `discovery` fields to `ApiRoutesSchema`.
  - Unified `GetDiscoveryResponseSchema` with `DiscoverySchema` as single source of truth.
  - Client `getRoute('feed')` fallback updated from `/api/v1/data` to `/api/v1/feed`.

  **Type safety:**

  - Extracted `ApiRouteType` from `ApiRoutes` keys for type-safe client route resolution.
  - Removed `as any` type casting in client route access.

- e0b0a78: Deprecate DataEngineQueryOptions in favor of QueryAST-aligned EngineQueryOptions.

  Engine, Protocol, and Client now use standard QueryAST parameter names:

  - `filter` → `where`
  - `select` → `fields`
  - `sort` → `orderBy`
  - `skip` → `offset`
  - `populate` → `expand`
  - `top` → `limit`

  The old DataEngine\* schemas and types are preserved with `@deprecated` markers for backward compatibility.

- Updated dependencies [f08ffc3]
- Updated dependencies [e0b0a78]
  - @objectstack/spec@4.0.0
  - @objectstack/core@4.0.0
  - @objectstack/rest@4.0.0
  - @objectstack/types@4.0.0

## 3.3.1

### Patch Changes

- @objectstack/spec@3.3.1
- @objectstack/core@3.3.1
- @objectstack/types@3.3.1
- @objectstack/rest@3.3.1

## 3.3.0

### Patch Changes

- @objectstack/spec@3.3.0
- @objectstack/core@3.3.0
- @objectstack/types@3.3.0
- @objectstack/rest@3.3.0

## 3.2.9

### Patch Changes

- @objectstack/spec@3.2.9
- @objectstack/core@3.2.9
- @objectstack/types@3.2.9
- @objectstack/rest@3.2.9

## 3.2.8

### Patch Changes

- @objectstack/spec@3.2.8
- @objectstack/core@3.2.8
- @objectstack/types@3.2.8
- @objectstack/rest@3.2.8

## 3.2.7

### Patch Changes

- @objectstack/spec@3.2.7
- @objectstack/core@3.2.7
- @objectstack/types@3.2.7
- @objectstack/rest@3.2.7

## 3.2.6

### Patch Changes

- @objectstack/spec@3.2.6
- @objectstack/core@3.2.6
- @objectstack/types@3.2.6
- @objectstack/rest@3.2.6

## 3.2.5

### Patch Changes

- @objectstack/spec@3.2.5
- @objectstack/core@3.2.5
- @objectstack/types@3.2.5
- @objectstack/rest@3.2.5

## 3.2.4

### Patch Changes

- @objectstack/spec@3.2.4
- @objectstack/core@3.2.4
- @objectstack/types@3.2.4
- @objectstack/rest@3.2.4

## 3.2.3

### Patch Changes

- @objectstack/spec@3.2.3
- @objectstack/core@3.2.3
- @objectstack/types@3.2.3
- @objectstack/rest@3.2.3

## 3.2.2

### Patch Changes

- Updated dependencies [46defbb]
  - @objectstack/spec@3.2.2
  - @objectstack/core@3.2.2
  - @objectstack/rest@3.2.2
  - @objectstack/types@3.2.2

## 3.2.1

### Patch Changes

- Updated dependencies [850b546]
  - @objectstack/spec@3.2.1
  - @objectstack/core@3.2.1
  - @objectstack/rest@3.2.1
  - @objectstack/types@3.2.1

## 3.2.0

### Patch Changes

- Updated dependencies [5901c29]
  - @objectstack/spec@3.2.0
  - @objectstack/core@3.2.0
  - @objectstack/rest@3.2.0
  - @objectstack/types@3.2.0

## 3.1.1

### Patch Changes

- Updated dependencies [953d667]
  - @objectstack/spec@3.1.1
  - @objectstack/core@3.1.1
  - @objectstack/rest@3.1.1
  - @objectstack/types@3.1.1

## 3.1.0

### Patch Changes

- Updated dependencies [0088830]
  - @objectstack/spec@3.1.0
  - @objectstack/core@3.1.0
  - @objectstack/rest@3.1.0
  - @objectstack/types@3.1.0

## 3.0.11

### Patch Changes

- Updated dependencies [92d9d99]
  - @objectstack/spec@3.0.11
  - @objectstack/core@3.0.11
  - @objectstack/rest@3.0.11
  - @objectstack/types@3.0.11

## 3.0.10

### Patch Changes

- Updated dependencies [d1e5d31]
  - @objectstack/spec@3.0.10
  - @objectstack/core@3.0.10
  - @objectstack/rest@3.0.10
  - @objectstack/types@3.0.10

## 3.0.9

### Patch Changes

- Updated dependencies [15e0df6]
  - @objectstack/spec@3.0.9
  - @objectstack/core@3.0.9
  - @objectstack/rest@3.0.9
  - @objectstack/types@3.0.9

## 3.0.8

### Patch Changes

- Updated dependencies [5a968a2]
  - @objectstack/spec@3.0.8
  - @objectstack/core@3.0.8
  - @objectstack/rest@3.0.8
  - @objectstack/types@3.0.8

## 3.0.7

### Patch Changes

- Updated dependencies [0119bd7]
- Updated dependencies [5426bdf]
  - @objectstack/spec@3.0.7
  - @objectstack/core@3.0.7
  - @objectstack/rest@3.0.7
  - @objectstack/types@3.0.7

## 3.0.6

### Patch Changes

- Updated dependencies [5df254c]
  - @objectstack/spec@3.0.6
  - @objectstack/core@3.0.6
  - @objectstack/rest@3.0.6
  - @objectstack/types@3.0.6

## 3.0.5

### Patch Changes

- Updated dependencies [23a4a68]
  - @objectstack/spec@3.0.5
  - @objectstack/core@3.0.5
  - @objectstack/rest@3.0.5
  - @objectstack/types@3.0.5

## 3.0.4

### Patch Changes

- Updated dependencies [d738987]
  - @objectstack/spec@3.0.4
  - @objectstack/core@3.0.4
  - @objectstack/rest@3.0.4
  - @objectstack/types@3.0.4

## 3.0.3

### Patch Changes

- c7267f6: Patch release for maintenance updates and improvements.
- Updated dependencies [c7267f6]
  - @objectstack/spec@3.0.3
  - @objectstack/core@3.0.3
  - @objectstack/types@3.0.3
  - @objectstack/rest@3.0.3

## 3.0.2

### Patch Changes

- Updated dependencies [28985f5]
  - @objectstack/spec@3.0.2
  - @objectstack/core@3.0.2
  - @objectstack/rest@3.0.2
  - @objectstack/types@3.0.2

## 3.0.1

### Patch Changes

- Updated dependencies [389725a]
  - @objectstack/spec@3.0.1
  - @objectstack/core@3.0.1
  - @objectstack/rest@3.0.1
  - @objectstack/types@3.0.1

## 3.0.0

### Major Changes

- Release v3.0.0 — unified version bump for all ObjectStack packages.

### Patch Changes

- Updated dependencies
  - @objectstack/spec@3.0.0
  - @objectstack/core@3.0.0
  - @objectstack/types@3.0.0
  - @objectstack/rest@3.0.0

## 2.0.7

### Patch Changes

- Updated dependencies
  - @objectstack/spec@2.0.7
  - @objectstack/core@2.0.7
  - @objectstack/rest@2.0.7
  - @objectstack/types@2.0.7

## 2.0.6

### Patch Changes

- Patch release for maintenance and stability improvements
- Updated dependencies
  - @objectstack/spec@2.0.6
  - @objectstack/core@2.0.6
  - @objectstack/types@2.0.6
  - @objectstack/rest@2.0.6

## 2.0.5

### Patch Changes

- Updated dependencies
  - @objectstack/spec@2.0.5
  - @objectstack/core@2.0.5
  - @objectstack/rest@2.0.5
  - @objectstack/types@2.0.5

## 2.0.4

### Patch Changes

- Patch release for maintenance and stability improvements
- Updated dependencies
  - @objectstack/spec@2.0.4
  - @objectstack/core@2.0.4
  - @objectstack/types@2.0.4
  - @objectstack/rest@2.0.4

## 2.0.3

### Patch Changes

- Patch release for maintenance and stability improvements
- Updated dependencies
  - @objectstack/spec@2.0.3
  - @objectstack/core@2.0.3
  - @objectstack/types@2.0.3
  - @objectstack/rest@2.0.3

## 2.0.2

### Patch Changes

- Updated dependencies [1db8559]
  - @objectstack/spec@2.0.2
  - @objectstack/core@2.0.2
  - @objectstack/rest@2.0.2
  - @objectstack/types@2.0.2

## 2.0.1

### Patch Changes

- Patch release for maintenance and stability improvements
- Updated dependencies
  - @objectstack/spec@2.0.1
  - @objectstack/core@2.0.1
  - @objectstack/types@2.0.1
  - @objectstack/rest@2.0.1

## 2.0.0

### Patch Changes

- Updated dependencies [38e5dd5]
- Updated dependencies [38e5dd5]
  - @objectstack/spec@2.0.0
  - @objectstack/core@2.0.0
  - @objectstack/rest@2.0.0
  - @objectstack/types@2.0.0

## 1.0.12

### Patch Changes

- chore: add Vercel deployment configs, simplify console runtime configuration
- Updated dependencies
  - @objectstack/spec@1.0.12
  - @objectstack/core@1.0.12
  - @objectstack/types@1.0.12

## 1.0.11

### Patch Changes

- @objectstack/spec@1.0.11
- @objectstack/core@1.0.11
- @objectstack/types@1.0.11

## 1.0.10

### Patch Changes

- Updated dependencies [10f52e1]
  - @objectstack/core@1.0.10
  - @objectstack/spec@1.0.10
  - @objectstack/types@1.0.10

## 1.0.9

### Patch Changes

- @objectstack/spec@1.0.9
- @objectstack/core@1.0.9
- @objectstack/types@1.0.9

## 1.0.8

### Patch Changes

- @objectstack/spec@1.0.8
- @objectstack/core@1.0.8
- @objectstack/types@1.0.8

## 1.0.7

### Patch Changes

- ebdf787: feat: implement standard service discovery via `/.well-known/objectstack`
  - @objectstack/spec@1.0.7
  - @objectstack/core@1.0.7
  - @objectstack/types@1.0.7

## 1.0.6

### Patch Changes

- Updated dependencies [a7f7b9d]
  - @objectstack/spec@1.0.6
  - @objectstack/core@1.0.6
  - @objectstack/types@1.0.6

## 1.0.5

### Patch Changes

- b1d24bd: refactor: migrate build system from tsc to tsup for faster builds
  - Replaced `tsc` with `tsup` (using esbuild) across all packages
  - Added shared `tsup.config.ts` in workspace root
  - Added `tsup` as workspace dev dependency
  - significantly improved build performance
- 877b864: fix: add SPA fallback to hono, fix msw context binding, improve runtime resilience, and fix client-react build types
- Updated dependencies [b1d24bd]
  - @objectstack/core@1.0.5
  - @objectstack/types@1.0.5
  - @objectstack/spec@1.0.5

## 1.0.4

### Patch Changes

- @objectstack/spec@1.0.4
- @objectstack/core@1.0.4
- @objectstack/types@1.0.4

## 1.0.3

### Patch Changes

- fb2eabd: fix: resolve "process is not defined" runtime error in browser environments by adding safe environment detection and polyfills
- Updated dependencies [fb2eabd]
  - @objectstack/core@1.0.3
  - @objectstack/spec@1.0.3
  - @objectstack/types@1.0.3

## 1.0.2

### Patch Changes

- a0a6c85: Infrastructure and development tooling improvements

  - Add changeset configuration for automated version management
  - Add comprehensive GitHub Actions workflows (CI, CodeQL, linting, releases)
  - Add development configuration files (.cursorrules, .github/prompts)
  - Add documentation files (ARCHITECTURE.md, CONTRIBUTING.md, workflows docs)
  - Update test script configuration in package.json
  - Add @objectstack/cli to devDependencies for better development experience

- 109fc5b: Unified patch release to align all package versions.
- Updated dependencies [a0a6c85]
- Updated dependencies [109fc5b]
  - @objectstack/spec@1.0.2
  - @objectstack/core@1.0.2
  - @objectstack/types@1.0.2

## 1.0.1

### Patch Changes

- Fix TypeScript error in http-dispatcher tests to resolve CI build failures.
  - @objectstack/spec@1.0.1
  - @objectstack/core@1.0.1
  - @objectstack/types@1.0.1

## 1.0.0

### Major Changes

- Major version release for ObjectStack Protocol v1.0.
  - Stabilized Protocol Definitions
  - Enhanced Runtime Plugin Support
  - Fixed Type Compliance across Monorepo

### Patch Changes

- Updated dependencies
  - @objectstack/spec@1.0.0
  - @objectstack/core@1.0.0
  - @objectstack/types@1.0.0

## 0.9.2

### Patch Changes

- Updated dependencies
  - @objectstack/spec@0.9.2
  - @objectstack/core@0.9.2
  - @objectstack/types@0.9.2

## 0.9.1

### Patch Changes

- Patch release for maintenance and stability improvements. All packages updated with unified versioning.
- Updated dependencies
  - @objectstack/spec@0.9.1
  - @objectstack/core@0.9.1
  - @objectstack/types@0.9.1

## 0.8.2

### Patch Changes

- Updated dependencies [555e6a7]
  - @objectstack/spec@0.8.2
  - @objectstack/core@0.8.2
  - @objectstack/types@0.8.2

## 0.8.1

### Patch Changes

- @objectstack/spec@0.8.1
- @objectstack/core@0.8.1
- @objectstack/types@0.8.1

## 1.0.0

### Minor Changes

- # Upgrade to Zod v4 and Protocol Improvements

  This release includes a major upgrade to the core validation engine (Zod v4) and aligns all protocol definitions with stricter type safety.

### Patch Changes

- Updated dependencies
  - @objectstack/spec@1.0.0
  - @objectstack/core@1.0.0
  - @objectstack/types@1.0.0

## 0.7.2

### Patch Changes

- fb41cc0: Patch release: Updated documentation and JSON schemas
- Updated dependencies [fb41cc0]
  - @objectstack/spec@0.7.2
  - @objectstack/core@0.7.2
  - @objectstack/types@0.7.2

## 0.7.1

### Patch Changes

- Patch release for maintenance and stability improvements
- Updated dependencies
  - @objectstack/spec@0.7.1
  - @objectstack/types@0.7.1
  - @objectstack/core@0.7.1

## 0.6.1

### Patch Changes

- Patch release for maintenance and stability improvements
- Updated dependencies
  - @objectstack/spec@0.6.1
  - @objectstack/types@0.6.1
  - @objectstack/core@0.6.1

## 0.6.0

### Minor Changes

- b2df5f7: Unified version bump to 0.5.0

  - Standardized all package versions to 0.5.0 across the monorepo
  - Fixed driver-memory package.json paths for proper module resolution
  - Ensured all packages are in sync for the 0.5.0 release

### Patch Changes

- Updated dependencies [b2df5f7]
  - @objectstack/spec@0.6.0
  - @objectstack/objectql@0.6.0
  - @objectstack/types@0.6.0
  - @objectstack/core@0.6.0

## 0.4.2

### Patch Changes

- Unify all package versions to 0.4.2
- Updated dependencies
  - @objectstack/spec@0.4.2
  - @objectstack/objectql@0.4.2
  - @objectstack/types@0.4.2

## 0.4.1

### Patch Changes

- Version synchronization and dependency updates

  - Synchronized plugin-msw version to 0.4.1
  - Updated runtime peer dependency versions to ^0.4.1
  - Fixed internal dependency version mismatches

- Updated dependencies
  - @objectstack/spec@0.4.1
  - @objectstack/types@0.4.1
  - @objectstack/objectql@0.4.1

## 0.4.0

### Minor Changes

- Release version 0.4.0

## 0.3.3

### Patch Changes

- Workflow and configuration improvements

  - Enhanced GitHub workflows for CI, release, and PR automation
  - Added comprehensive prompt templates for different protocol areas
  - Improved project documentation and automation guides
  - Updated changeset configuration
  - Added cursor rules for better development experience

- Updated dependencies
  - @objectstack/spec@0.3.3
  - @objectstack/objectql@0.3.3
  - @objectstack/types@0.3.3

## 0.3.2

### Patch Changes

- Patch release for maintenance and stability improvements
- Updated dependencies
  - @objectstack/objectql@0.3.2
  - @objectstack/spec@0.3.2
  - @objectstack/types@0.3.2

## 0.3.1

### Patch Changes

- Organize zod schema files by folder structure and improve project documentation
  - @objectstack/spec@0.3.1
  - @objectstack/objectql@0.3.1
  - @objectstack/types@0.3.1

## 0.3.0

### Patch Changes

- Updated dependencies
  - @objectstack/spec@1.0.0
  - @objectstack/objectql@1.0.0
  - @objectstack/types@1.0.0

## 0.2.0

### Minor Changes

- Initial release of ObjectStack Protocol & Specification packages

  This is the first public release of the ObjectStack ecosystem, providing:

  - Core protocol definitions and TypeScript types
  - ObjectQL query language and runtime
  - Memory driver for in-memory data storage
  - Client library for interacting with ObjectStack
  - Hono server plugin for REST API endpoints
  - Complete JSON schema generation for all specifications

### Patch Changes

- Updated dependencies
  - @objectstack/spec@0.2.0
  - @objectstack/types@0.2.0
  - @objectstack/objectql@0.2.0

## 0.1.1

### Patch Changes

- Remove debug logs from registry and protocol modules
- Updated dependencies
  - @objectstack/spec@0.1.2
  - @objectstack/objectql@0.1.1
  - @objectstack/types@0.1.1
