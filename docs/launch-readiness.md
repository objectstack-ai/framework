# Launch Readiness Checklist

**Status:** Draft for team sign-off
**Scope:** Production launch (v1 / GA) of the ObjectStack framework monorepo
**Last reviewed:** 2026-06-04 (`main` @ `9f311f8` — ADR-0030 P3b-2 digest)

---

## How to use this document

Each item has an **owner**, a **verification box**, and a **sign-off box**. The
two are deliberately separate:

- ☐ **Verify** — a named engineer has confirmed the finding is real (or a false
  positive) by reading the actual code / running a repro. Several items below
  originate from an automated package-by-package sweep and are **not yet
  hand-verified** — do not action them before verifying.
- ☐ **Sign-off** — the fix is merged (or the risk is formally accepted and the
  acceptance recorded in the "Notes" column).

A "false positive" still gets ticked on Verify, with a one-line note explaining
why no fix is needed. **Do not mark a P0 signed-off on the strength of the sweep
alone.**

Priority key: **P0** = blocks launch · **P1** = fix at/just-after launch ·
**P2** = test-coverage / hardening gap · **Roadmap** = explicitly out of v1.

---

## Overall posture

The codebase is mature and disciplined. A repo-wide scan found **zero**
`TODO/FIXME/HACK` markers, `console.log` in source, empty `catch` blocks,
`@ts-ignore`, or hard-coded secrets. `main` CI is green (Build/Test Core, Lint &
Type Check, CodeQL). The core tier — `spec`, `objectql`, `plugin-security`,
`runtime`, the SQL drivers, `service-ai` — is assessed production-ready.

Launch risk is concentrated in a small number of themes below, not in code
quality. **The single most important caveat: the security- and data-integrity
findings (§P0) are from an automated sweep and MUST be hand-verified before any
fix or acceptance.**

---

## P0 — Blockers (verify, then fix or formally accept)

> Every P0 below must be **hand-verified** first — some may be false positives or
> already-guarded. Do not ship without each row at Verify ✓ **and** Sign-off ✓.

### P0-1 — Auth secret falls back to a weak dev secret
- **Area:** `plugin-auth` — `src/auth-manager.ts` (~L1052–1071, `generateSecret()`)
- **Risk:** If `OS_AUTH_SECRET` is unset in production, the manager logs a warning
  and falls back to `dev-secret-<timestamp>`. Session tokens become predictable →
  session forgery. (HIGH, security)
- **Action:** Throw (fail boot) when no secret is configured and
  `NODE_ENV === 'production'`; add a pre-boot config validation. Document
  `OS_AUTH_SECRET` as a required go-live env var.
- **Owner:** _______  ·  Verify ✅ (confirmed real @ `main`)  ·  Sign-off ☐  ·  Notes: Fixed — `generateSecret()` throws in production; +3 tests. Awaiting human sign-off.

### P0-2 — Metadata-service failure bypasses all RBAC/RLS (fail-open)
- **Area:** `plugin-security` — `src/security-plugin.ts:309–312`
- **Risk:** A metadata-resolution error is swallowed and the request proceeds via
  `next()` with **no permission checks**. If the metadata service degrades, every
  user bypasses RBAC/RLS. (HIGH, security)
- **Action:** Add a circuit-breaker + ERROR-level alerting; add an integration
  test asserting "metadata service down ⇒ request denied", not allowed. Decide
  fail-closed vs. fail-open explicitly and record the decision.
- **Owner:** _______  ·  Verify ✅ (confirmed real @ `main`)  ·  Sign-off ☐  ·  Notes: Decision = **fail-closed**. `catch` now logs ERROR + throws `PermissionDeniedError`; system ops still bypass. +2 tests. Awaiting human sign-off.

### P0-3 — Unescaped LIKE metacharacters in `contains`
- **Area:** `driver-sql` — `src/sql-driver.ts:1565, 1656`
- **Risk:** The `contains` / `$contains` operator embeds the user value into a
  `%...%` LIKE pattern without escaping `%` / `_`. Parameterization prevents SQL
  injection, but a `%` value matches everything → logic-level filter bypass.
  (HIGH, data)
- **Action:** Escape `%` and `_` (and the escape char) before building the LIKE
  pattern; add a test with a `%`/`_` payload.
- **Owner:** _______  ·  Verify ✅ (confirmed real @ `main`)  ·  Sign-off ☐  ·  Notes: Fixed — escape `%`/`_`/`\` + explicit `ESCAPE '\'` (SQLite needs it); +3 tests. Awaiting human sign-off.

### P0-4 — MongoDB filter passes arbitrary `$` operators through
- **Area:** `driver-mongodb` — `src/mongodb-filter.ts:82–84`
- **Risk:** Operator keys are passed straight to MongoDB with no allowlist, so
  `$where` / `$function` (server-side JS) reach the engine → query-intent bypass
  and a potential JS-execution surface. (HIGH **if MongoDB is a launch driver**)
- **Action:** Allowlist safe operators (`$eq/$ne/$gt/$gte/$lt/$lte/$in/$nin/$and/$or/...`);
  reject unknown ones at filter-build time. If MongoDB is not a v1 driver, mark
  Roadmap instead.
- **Owner:** _______  ·  Verify ✅ (confirmed real @ `main`)  ·  Sign-off ☐  ·  Notes: Fixed — translator now rejects unknown `$`-operators (blocks `$where`/`$function`); +4 tests. Awaiting human sign-off. (Still confirm whether MongoDB is a v1 driver.)

### P0-5 — Realtime & feed are in-memory only (no cluster coordination)
- **Area:** `service-realtime` (`in-memory-realtime-adapter.ts`), `service-feed`
  (`in-memory-feed-adapter.ts`)
- **Risk:** Publish/subscribe and feed storage are process-local. In a multi-node
  deployment, clients connected to node B never receive node A's events, and feed
  data is lost on restart / unbounded in memory. (HIGH **for HA/cluster**;
  N/A for single-instance)
- **Action (cluster launch):** Provide a Redis-backed realtime adapter and a
  DB-backed feed adapter, **or** formally restrict v1 to single-instance and
  document it as non-HA. Enforce a `maxItems` cap if shipping in-memory feed.
- **Decision = single-instance for v1 (non-HA).** Recorded: realtime/feed stay
  process-local for GA; HA is a post-GA fast-follow (the Redis primitive already
  exists — `service-cluster-redis`'s `RedisPubSub` — so the realtime adapter is a
  wrap, and a DB-backed feed adapter is the larger remaining piece). Both plugin
  JSDocs now state the non-HA contract explicitly.
- **Backstops shipped:** safety caps are now **default-on** — `InMemoryFeedAdapter`
  caps at `DEFAULT_MAX_FEED_ITEMS` (100k) and `InMemoryRealtimeAdapter` at
  `DEFAULT_MAX_SUBSCRIPTIONS` (50k); `createFeedItem`/`subscribe` throw loudly at
  the cap (fail-loud beats silent OOM). `0` is an explicit unbounded opt-out
  (tests / short-lived processes). +4 tests (default-cap + opt-out, both packages).
- **Owner:** _______  ·  Verify ✅ (confirmed real @ `main`)  ·  Sign-off ☐  ·  Notes: **Accepted for v1 as single-instance/non-HA**; caps default-on + documented. HA adapters tracked as post-GA roadmap. Awaiting human sign-off.

---

## P1 — Fix at launch or immediately after

### P1-1 — External calls have no timeout / retry / backoff
- **Area:** `embedder-openai` (`src/index.ts:~157`), `connector-rest` (~L157),
  `connector-slack` (~L155), `connector-mcp`
- **Risk:** Naked `fetch` with no timeout or 429/5xx backoff → a slow or
  rate-limited external API hangs the entire agent turn with no recovery.
- **Action:** Add a default request timeout (e.g. 30s, configurable) + exponential
  backoff (3 tries) + a circuit breaker; tests for 429 / timeout paths.
- **Fix:** New shared `resilientFetch` (`@objectstack/spec/shared`) — 30s per-attempt
  timeout (AbortController) + exponential backoff with jitter (3 tries) on
  network errors / 429 / 5xx, honouring `Retry-After`; never retries a
  caller-initiated abort. Wired into `connector-rest`, `connector-slack`,
  `embedder-openai`. `connector-mcp` uses the MCP SDK transport, so it gets a 30s
  per-request `timeout` on `callTool` / `listTools` instead. +13 tests (helper 9,
  connector retry 1, plus existing suites green).
- **Deferred (follow-up, not blocking):** a **circuit breaker** — it's stateful
  and per-host; timeout + backoff already removes the "hangs the agent turn / no
  recovery" risk. Making timeout/retry **per-call configurable** (currently
  sensible defaults) is a small follow-up.
- **Owner:** _______  ·  Verify ✅ (confirmed real @ `main`)  ·  Sign-off ☐  ·  Notes: Timeout + backoff shipped across all 4 paths; circuit breaker deferred (rationale above). Awaiting human sign-off.

### P1-2 — Unbounded growth: execution logs, job runs, event log
- **Area:** `service-automation` (in-memory exec logs, hard 1000 cap),
  `service-job` (`sys_job_run`, no retention), `service-messaging`
  (event log retention is opt-in)
- **Risk:** Long-running pods OOM; history tables grow without bound.
- **Action:** Make retention **default-on** for all event/run tables; schedule
  sweepers at startup; persist automation logs to a table rather than memory.
- **Verification finding (corrected scope):** only one of the three is truly
  unbounded. **automation** exec logs are *already* a bounded 1000-entry ring
  buffer (`engine.ts` `recordLog` — `splice`); memory-safe today, never persisted
  → no OOM risk. **`sys_job_run`** is the real leak: append-only, zero retention.
  **messaging** retention was fully built + tested (`NotificationRetention`) but
  shipped opt-in (`retentionDays: 0`).
- **Fixes shipped:**
  - **service-job** — new `JobRunRetention` (mirrors `NotificationRetention`):
    bulk `delete sys_job_run where created_at < cutoff` under a system context,
    **default-on** at `DEFAULT_JOB_RUN_RETENTION_DAYS` (30d), swept every 6h via
    an unref'd timer wired in `JobServicePlugin`'s `kernel:ready` (DB path only);
    `retentionDays: 0` disables. +5 tests.
  - **service-messaging** — flipped `retentionDays` default `0 → 90`
    (`DEFAULT_NOTIFICATION_RETENTION_DAYS`); sweeper/timer/shutdown already
    existed. **Behaviour change**: notification history now auto-prunes at 90d by
    default (set `0` to keep the old keep-forever behaviour). Changeset notes it.
  - **service-automation** — exec-log ring buffer cap made configurable via
    `AutomationServicePluginOptions.maxLogSize` (default unchanged at 1000,
    `DEFAULT_MAX_EXECUTION_LOG_SIZE`); +2 tests. Durable `sys_automation_run`-style
    persistence is deferred to the HA fast-follow (roadmap), not a GA blocker.
- **Superseded (ADR-0057, #2786/#2834):** the plugin-local sweepers above were
  the stop-gap. Retention is now a *declarative platform primitive*: objects
  carry a `lifecycle` block (`sys_job_run` 30d, notification pipeline 90d) and
  the ObjectQL-registered **LifecycleService** is the ONE sweeper —
  `JobRunRetention` / `NotificationRetention` and their `retentionDays`
  options were removed. Windows are tuned via the `lifecycle` settings
  namespace (`retention_overrides`, tenant-scoped). `sys_automation_run`
  deliberately keeps its OWN terminal-only sweep (suspended runs are live
  resumable state; the declarative contract has no status predicate).
- **Owner:** _______  ·  Verify ✅ (confirmed real @ `main`; scope corrected)  ·  Sign-off ☐  ·  Notes: `sys_job_run` retention is the one true fix; messaging default-flipped; automation already bounded (now tunable). Awaiting human sign-off.

### P1-3 — Graceful shutdown (mostly a false positive; one real drain bug fixed)
- **Area:** `core` (`kernel.ts`), `cli` (`serve.ts`), `plugin-hono-server` (`adapter.ts`)
- **Verification finding:** The sweep's "no SIGTERM/SIGINT handling" is **wrong**.
  `Kernel.registerShutdownSignals()` (called at start) already handles
  SIGINT/SIGTERM/SIGQUIT → `shutdown()` → `performShutdown()` (ordered plugin
  destroy in reverse + `kernel:shutdown` hook + `onShutdown` handlers), bounded by
  a **default 60s** `shutdownTimeout`. `serve.ts` boots through the kernel, so the
  production path inherits all of this. The ≥60s grace floor already exists.
- **Real (narrower) gap — FIXED:** the standalone Hono server's `close()` called
  `closeAllConnections()`, which **force-killed in-flight requests** instead of
  draining them. Replaced with: `server.close()` (stop new + drain active) +
  `closeIdleConnections()` (release idle keep-alive), and force-close only after a
  bounded **drain window** (default 10s, < the kernel's 60s). +2 integration tests.
- **Residual (not blocking):** the Hono adapter
  intentionally leave signal handling to the host app; cluster/Redis close should
  be registered via `kernel.onShutdown(...)` by the cluster plugin — confirm it is.
- **Owner:** _______  ·  Verify ✅ (mostly false positive; drain bug fixed)  ·  Sign-off ☐  ·  Notes: Kernel shutdown already correct; hono drain fixed + tested. Awaiting human sign-off.

### P1-4 — Per-request hostname → environment resolution (no cache)
- **Area:** `rest` — `src/rest-server.ts:~504–530`
- **Risk:** `resolveByHostname()` runs on every unscoped request → control-plane
  latency spike under load; silent fallback to default project masks it.
- **Action:** Add an in-memory TTL cache (~30s) for `hostname → environmentId`.
- **Owner:** _______  ·  Verify ✅ (confirmed real @ `main`)  ·  Sign-off ☐  ·  Notes: Fixed — `RestServer.resolveHostnameCached()` caches hostname→env (positive **and** negative) for 30s across all 3 call sites; +3 tests. Awaiting human sign-off.

### P1-5 — Cluster pub/sub is fire-and-forget (metadata-changed)
- **Area:** `service-cluster-redis` — `src/pubsub.ts:~75–90`
- **Risk:** `publish()` doesn't wait for subscribers; a crash right after a schema
  change leaves other nodes with a stale schema until the next full reload.
- **Action:** Acceptable for non-critical events if documented; ensure schema
  mutations re-sync on error boundaries (history exists in `sys_metadata_history`).
  Record the durability contract.
- **Durability contract (recorded):** Redis pub/sub is **at-most-once** by design
  (already noted in `pubsub.ts`). `metadata.changed` is a **cache-invalidation hint
  only** — the durable source of truth is the transactional write to `sys_metadata`
  (+ `sys_metadata_history`). A node that misses the event serves its cached schema
  until the next reload and **loses no data** (self-heals on reload/restart against
  the DB). Documented in `pubsub.ts publish()`. **Accept** for v1: no exactly-once
  state may flow through this channel — durable state uses an outbox.
- **Owner:** _______  ·  Verify ✅ (by design — contract recorded)  ·  Sign-off ☐  ·  Notes: No code fix needed; risk **accepted** with rationale + code comment. Awaiting human sign-off.

---

## P2 — Test-coverage & hardening gaps (ready, but shore up)

| ID | Area | Gap | Action | Owner | Verify | Sign-off |
|----|------|-----|--------|-------|:------:|:--------:|
| P2-1 | `metadata-fs` | **NEEDS-WORK.** Atomicity / `watch` replay consistency under concurrent FS writes; 200ms chokidar self-write suppression is racy on slow/network FS | Add fault-injection tests (crash mid-write, concurrent put+delete, watch replay); validate `writeJsonAtomic` | ____ | ☐ | ☐ |
| P2-2 | `cli` | Missing `serve` integration test (kernel init + HMR reload + SIGINT); possible missing `environments.ts` implementation (test exists) | Add serve/dev integration test; confirm `environments` command exists | ____ | ☐ | ☐ |
| P2-3 | `plugin-webhooks` | Thin tests (1 test file); `eventId` dedup can collide on identical-ms timestamps | Add UUID suffix to `eventId`; expand auto-enqueuer tests | ____ | ☐ | ☐ |
| P2-4 | `service-queue` | CAS claim (read-then-update) is not atomic → tolerated duplicate delivery; empty idempotency key bypasses dedup | Enforce non-empty idempotency key; add a lease safety margin; document at-least-once | ____ | ☐ | ☐ |
| P2-5 | `plugin-audit` | `sys_session` mutations are not audited | Confirm login/logout are logged elsewhere (`sys_audit_log`); close the compliance gap if not | ____ | ☐ | ☐ |
| P2-6 | `core` / `runtime` | `getService()` is sync but may return a Promise → unhandled-rejection footgun for plugin authors | Tighten the type / add a guard; document the sync-only contract | ____ | ☐ | ☐ |

---

## Roadmap — Explicitly out of scope for v1 (no action to launch)

These are **designed but unbuilt** and should be named "not in v1" in the release
notes, not treated as blockers.

- ☐ **Unverified features — confirm stub vs. minimal, then include or exclude:**
  `knowledge-ragflow`, `connector-openapi` (the sweep could not locate full
  implementations; the packages exist — verify scope before GA).
- ☐ **HA / multi-node (post-GA fast-follow, from P0-5 decision):** Redis-backed
  realtime adapter (wrap `service-cluster-redis`'s `RedisPubSub`), DB-backed feed
  adapter, and persisting automation execution logs to a table (currently a
  process-local 1000-entry ring buffer — see P1-2). Not needed for single-instance v1.
- ☐ **Proposed ADRs (roadmap):** ADR-0021 (analytics semantic layer),
  ADR-0022/0023/0024 (connectors / OpenAPI→connector / MCP connectors),
  ADR-0025/0026 (plugin & client-UI distribution), ADR-0027 (metadata authoring
  lifecycle), ADR-0028 (naming/namespace isolation), ADR-0029 (kernel object
  ownership — **partially landed**: K0 + D7 + several K2 domains), ADR-0033
  Phase D (enterprise AI-authoring governance).

---

## Release mechanics

- ☐ `main` CI green at the release commit (Build/Test Core, Lint & Type Check, CodeQL).
- ☐ Pending changesets reviewed (4 at last check) and version bump intentional.
- ☐ `pnpm run release` path verified (`build` → `build-console.sh` → `changeset publish`).
- ☐ Required env vars documented for go-live (at minimum `OS_AUTH_SECRET`; see P0-1).
- ☑ Deployment topology decided: **single-instance** for v1 (drives P0-5; HA is a
  post-GA fast-follow). Realtime/feed run process-local with default-on memory caps.

---

## Provenance

The per-package findings were produced by an automated, read-only package-by-package
sweep on 2026-06-04 and synthesized here. They are a **starting point for review,
not a verified defect list** — each item carries its own Verify box for exactly
this reason. File:line references are approximate and must be confirmed against
`main` before acting.
