# ADR-0008: Metadata Repository, Change Log & Subscription (M0 → M4)

**Status**: Proposed (2026-05-22)
**Deciders**: ObjectStack Protocol Architects
**Builds on**: [ADR-0003](./0003-package-as-first-class-citizen.md), [ADR-0004](./0004-cloud-multi-kernel.md), [ADR-0005](./0005-metadata-customization-overlay.md), [ADR-0006](./0006-project-environment-split.md)
**Supersedes (parts of)**: ad-hoc HMR wiring in `packages/metadata` and the local-only POST contract between CLI and runtime.

---

## TL;DR

ObjectStack today conflates *storage*, *cache* and *registry* into one box (`MetadataManager` + `SchemaRegistry`). This blocks HMR, prevents cloud-native editing, has no real audit trail, and will not scale to the four-quadrant write surface we already need (local files, Studio inline edits, REST writes, future cloud-DB sync).

We introduce four explicit layers — **Repository · Change Log · Cache · Registry** — modelled after the consensus arrived at by Salesforce, ServiceNow, Mendix, OutSystems, Hasura and Retool over the last 20 years. The Repository interface is pluggable (FS / Postgres / Hybrid). The Change Log is append-only and is the single mechanism through which *every* runtime consumer learns about updates. Studio's "live preview" stops being a special case and becomes the same code path that AI agents, Git webhooks and Studio inline editors use.

The migration is staged into M0 (event layer, ~1-2 weeks), M1 (cloud Postgres Repository, ~1 month), M2 (branches & promotion, ~1-2 months), M3 (offline + CRDT, ~2-3 months), M4 (ecosystem). Each milestone is independently shippable and never requires rewriting earlier work.

---

## 1. Context

### 1.1 What's broken today

| Symptom | Root cause |
|:---|:---|
| Editing `case.view.ts` in VSCode does not refresh Studio preview | `SchemaRegistry` is populated at boot, never refreshed; `MetadataManager.register` emits no events |
| `_loadFromLocalFile` only runs when `artifactSource.mode === 'local-file'`; config-eval dev silently no-ops | HMR is tied to one specific boot path (`standalone-stack`) rather than to the Repository concept |
| Studio inline edits (PUT `/api/v1/meta/view/:name`) persist to `sys_metadata` overlay but Studio preview still shows the stale artifact | Two writers (artifact + sys_metadata), no merge contract beyond "DB wins on read" |
| `sys_view`, `sys_flow`, `sys_agent`, `sys_tool` projection tables drift away from Zod schemas (already half-removed in ADR-0005) | Multiple storage formats for the same metadata type; no canonical form |
| There is no audit trail for "who changed `case.view.ts` and when" | No append-only log; `register()` overwrites in place |
| Tests must boot the entire kernel to read a view spec | `SchemaRegistry` is not separable from the runtime container |
| Future: cloud Studio cannot reuse the same code path | No Repository abstraction; `MetadataPlugin` is a leaf, not a port |

### 1.2 What the four write surfaces already need

```
   ┌───────────────────────────┐   ┌────────────────────────────┐
   │ Local files (CLI watch)   │   │ Studio inline edit (PUT)   │
   └───────────┬───────────────┘   └─────────────┬──────────────┘
               │                                  │
               ▼                                  ▼
        ┌─────────────────────────────────────────────────┐
        │       ??? (today: separate ad-hoc plumbing)     │
        └─────────────────────────────────────────────────┘
               ▲                                  ▲
               │                                  │
   ┌───────────┴──────────────┐    ┌──────────────┴─────────────┐
   │ REST / Tooling API write │    │ Cloud DB sync (future)     │
   └──────────────────────────┘    └────────────────────────────┘
```

Each surface re-invents:

- where to put the new spec
- how to validate it (Zod)
- how to notify in-process consumers
- how to notify other server replicas
- how to feed Studio's HMR badge

If we don't unify this now, every new surface (AI auto-edits, Git import, marketplace install, CRDT) will multiply the wiring.

### 1.3 What other low-code platforms converged on

| Platform | Real source of truth | Editing surface | Versioning model | Promotion |
|:---|:---|:---|:---|:---|
| Salesforce | Org database | Setup UI + SFDX source | ApiVersion + Unlocked Packages | Change Sets / 2GP |
| ServiceNow | Platform DB | Studio + source control | Update Sets + App scope | Store promote |
| Mendix | Modeler file (.mpr) | Desktop IDE | Teamserver SVN-like | Compile artifact |
| OutSystems | LifeTime DB | Service Studio | TrueChange + Tags | LifeTime promote |
| Retool / Bubble | Cloud DB | Web IDE | Snapshots + branches | One-click deploy |
| Hasura | Postgres + metadata DB | Console + CLI | metadata.yaml + migrations | `metadata apply` |

The points they all agree on:

1. **A Repository is the single point of truth.** Files, DB rows and CRDT docs are *implementations* of one interface.
2. **An append-only change log is a first-class entity.** Audit, rollback, replication, multi-tenant sync and IDE HMR are all the same problem.
3. **Content-addressable specs.** Every spec snapshot has a stable hash; equal hashes mean equal behaviour.
4. **Optimistic locking via parent version.** Writes declare what they think the current head is; the server arbitrates.
5. **Org / Project / Branch / Env are not optional.** Every metadata item is fully qualified from day one.
6. **Promotion ≠ deploy.** Moving from dev to staging to prod is a deliberate replay of a change set, not a file copy.
7. **API tiers.** Bulk metadata API (slow, transactional) + tooling API (fast, single-item) + subscription API (events).
8. **Metadata types are pluggable.** Plugins can add both new types *and* new repositories.

We adopt all eight.

---

## 2. Decision

### 2.1 The four-layer architecture

```
┌─────────────────────────────────────────────────────────────────┐
│ REPOSITORY  (interface — pluggable source of truth)             │
│                                                                  │
│   FileSystemRepository  — local dev, TS / JSON files on disk    │
│   PostgresRepository    — cloud SaaS, `metadata_items` table     │
│   GitRepository         — Git-backed (CI/CD, backup, marketplace)│
│   HybridRepository      — local cache + remote DB (offline-first)│
│   InMemoryRepository    — tests, ephemeral environments          │
│                                                                  │
│   Single interface:                                              │
│     get(ref) · put(ref, spec, opts) · list(filter)               │
│     history(ref) · watch(filter) · fork(from, to) · merge(...)   │
└─────────────────────────┬───────────────────────────────────────┘
                          │ MetadataEvent { seq, op, ref, hash, parentHash, actor, ts }
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│ CHANGE LOG  (append-only, monotonic, per-branch)                │
│   - Single sequence number per (org, branch)                     │
│   - Persists in same backend as the Repository (FS journal / DB) │
│   - Sole mechanism for notifying *anyone* about a change         │
└─────────────────────────┬───────────────────────────────────────┘
                          │ subscribe(filter, since=seq) → AsyncIterable
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│ CACHE  (in-process, hot, lazy, event-invalidated)               │
│   - LRU + max-bytes ceiling                                      │
│   - get-or-fetch pattern: read miss → repository → cache         │
│   - On event: invalidate(type, name) — never eagerly refetch     │
│   - Cold-start friendly: zero items at boot, fills on demand     │
└─────────────────────────┬───────────────────────────────────────┘
                          │ get(ref) (transparent cache)
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│ REGISTRY  (typed views over the cache)                          │
│   SchemaRegistry — object/field shape lookups for ObjectQL       │
│   FlowRegistry   — triggers, schedule entries                    │
│   ViewRegistry   — HTTP /meta endpoints                          │
│   PermissionEngine, …                                            │
│   Each Registry subscribes to Change Log for the types it cares  │
│   about; no Registry owns storage.                               │
└─────────────────────────┬───────────────────────────────────────┘
                          │ broadcast (SSE / WS)
                          ▼
                  External clients (Studio, IDE plugins, dashboards)
```

### 2.2 Canonical form

The Repository's wire format is **Zod-normalised canonical JSON**:

```typescript
interface CanonicalSpec {
  /** The full normalised spec, with defaults filled by Zod. */
  body: Record<string, unknown>;
  /** sha256 of `canonicalize(body)` — stable across editing views. */
  hash: string;
}
```

TS source files, YAML, Studio UI forms and CRDT documents are *editing views* that converge on the canonical form before reaching the Repository. Two different inputs that normalize to the same canonical form **are equal** — no spurious change events fire.

### 2.3 Identifying a metadata item: `MetaRef`

```typescript
interface MetaRef {
  org: string;        // 'acme' or 'system' for built-ins
  // NOTE (2026-05-22): The earlier draft of this ADR included a
  // `project` field. Per ADR-0006 v4, `sys_project` no longer exists
  // — the dev-workspace identity is carried by `sys_package` /
  // `sys_package_version`. The scope tuple is therefore (org, branch).
  // A future "code identity" field is expected to come back as
  // `package: string` (the immutable package slug), but that is
  // deferred to M2 alongside branch promotion.
  branch: string;     // 'main', 'feature-x', 'pr-42'
  type: MetadataType; // 'view' | 'object' | 'flow' | 'agent' | 'tool' | 'dashboard' | …
  name: string;       // 'case', 'sales_pipeline', …
  /** Optional pin to a specific version; omit to mean 'branch HEAD'. */
  version?: string;
}
```

All three scopes are mandatory at the storage layer. Higher layers may default `org=system`, `branch=main` for convenience.

### 2.4 Event shape

```typescript
type MetadataOp = 'create' | 'update' | 'delete' | 'rename';

interface MetadataEvent {
  seq: number;            // monotonic per (org, branch)
  op: MetadataOp;
  ref: MetaRef;
  hash: string | null;    // null for delete
  parentHash: string | null;
  actor: string;          // user id, 'cli', 'ai:claude', …
  message?: string;       // optional commit message
  ts: string;             // ISO 8601
  source: string;         // 'fs', 'studio', 'rest', 'ai', 'git-import', …
}
```

This is the **only** payload the kernel ever broadcasts. Studio's HMR SSE, ObjectQL's SchemaRegistry refresh, and a future CDC pipeline to a data warehouse all consume the same event stream.

### 2.5 Write protocol (optimistic locking)

```typescript
repo.put(ref, spec, {
  parentVersion: 'sha256:abc…' | null,  // null = create
  actor: 'user:42',
  message: 'Rename Service Workflow column',
});
// → returns { version, seq } on success
// → throws ConflictError if parentVersion !== current head
```

A single contract used by:

- the CLI watcher (`parentVersion` = last seen hash)
- Studio inline editor (`parentVersion` = hash returned at GET time)
- REST tooling API (clients pass `If-Match: <hash>`)
- AI agents (same as REST)
- CRDT sync (server reconciles before put)

Conflict resolution is the **client's** job. The server is an arbitrator, never a merger (except when a Repository implementation explicitly opts in, e.g. CRDT-backed).

### 2.6 Repository interface

```typescript
export interface MetadataRepository {
  /** Read a single item (HEAD or pinned version). */
  get(ref: MetaRef): Promise<MetadataItem | null>;

  /** Write a new version. Throws ConflictError on parentVersion mismatch. */
  put(ref: MetaRef, spec: unknown, opts: PutOptions): Promise<PutResult>;

  /** Soft delete (tombstone). Hard purge is a separate admin op. */
  delete(ref: MetaRef, opts: DeleteOptions): Promise<DeleteResult>;

  /** Enumerate items matching a filter; backed by an index. */
  list(filter: ListFilter): AsyncIterable<MetadataItemHeader>;

  /** Item-level history; pagination by seq. */
  history(ref: MetaRef, opts?: HistoryOptions): AsyncIterable<MetadataEvent>;

  /** Live event stream; resume from `since` on reconnect. */
  watch(filter: WatchFilter, since?: number): AsyncIterable<MetadataEvent>;

  /** Branch ops (M2+). */
  fork?(from: BranchRef, to: BranchRef): Promise<void>;
  merge?(from: BranchRef, to: BranchRef, strategy: MergeStrategy): Promise<MergeResult>;
}
```

`MetadataItem` = `MetaRef` + canonical spec + version metadata. `MetadataItemHeader` = the same minus `body` (cheap to list).

### 2.7 Three Repository implementations we ship in M0–M1

**`FileSystemRepository`** (M0)
- Scans `src/**/*.{ts,view.ts,object.ts,…}` at boot, builds a `(type,name) → filePath` index, lazy parses on `get`.
- Watches with `chokidar`; on change, parses → diffs hash → emits event if changed.
- Stores the change log as a JSONL file in `.objectstack/.log/<branch>.jsonl` (gitignored).
- `put` is **read-only** by default in this implementation — the file system is owned by the developer's IDE. Cloud-mode Studio inline edits will use the Postgres backend instead. (Optional opt-in `writeMode: 'patch'` for future "Studio writes back to source files".)

**`PostgresRepository`** (M1)
- Schema: `metadata_items(org, branch, type, name, version, parent_version, body, hash, actor, message, ts, deleted)` with `(org, branch, type, name)` partial-unique index on `deleted=false`.
- Change log table: `metadata_events(seq SERIAL, org, branch, op, type, name, hash, parent_hash, actor, ts, source)`.
- `watch` implemented via `LISTEN metadata_events`; multi-replica safe because every server `LISTEN`s independently.
- `put` runs inside a transaction with `SELECT … FOR UPDATE` on the current head to enforce optimistic locking.

**`InMemoryRepository`** (M0, used by tests + edge runtime)
- Same interface, `Map<string, MetadataItem[]>` storage, in-memory EventTarget for `watch`.

### 2.8 Cache layer

```typescript
class MetadataCache {
  constructor(private repo: MetadataRepository, opts: CacheOptions) {
    repo.watch({}).then(stream => this.consume(stream));
  }
  async get(ref: MetaRef): Promise<MetadataItem | null> { /* LRU + lazy fill */ }
  invalidate(ref: MetaRef): void { /* O(1) */ }
}
```

- **Never** eagerly preloads — the entire premise is that an org with 10k metadata items shouldn't pay 30s of boot just so the first request is fast.
- Bounded by `maxItems` and `maxBytes`; LRU eviction.
- On `MetadataEvent`, evicts the affected ref. The next read pulls fresh.

### 2.9 Registry layer

Each Registry is a *typed projection* over the cache, owned by the consumer module:

- `SchemaRegistry` (ObjectQL) subscribes to `type=object` events and rebuilds field indexes
- `FlowTriggerRegistry` (automation) subscribes to `type=flow` events and (un)registers triggers
- `ViewRegistry` (HTTP) doesn't need long-lived state — it serves `/api/v1/meta/:type/:name` straight from the cache
- `PermissionEngine` subscribes to `type=permission` events and rebuilds its decision tree

A Registry **never** owns storage. If a Registry needs to persist computed state (e.g. compiled permission tree), it does so under a separate key in its own store.

### 2.10 Studio's HMR is no longer a special case

```
Today:
  CLI → POST /api/v1/dev/metadata-events → MetadataPlugin._loadFromLocalFile
        (only if artifactSource.mode === 'local-file')

After M0:
  FileSystemRepository watcher → put() → MetadataEvent → SSE bridge
  (Studio is just another `watch()` subscriber over SSE)
```

The CLI's POST endpoint goes away. The CLI in local dev no longer needs to talk to the server at all — both processes share the same Repository implementation (FileSystem) backed by the same directory. The server's chokidar instance is the source of truth.

---

## 3. Boot-time semantics (clarifying "is everything loaded into a DB?")

**No.** What happens at boot depends on which Repository implementation is plugged in.

| Mode | Real source | Boot work | In-memory at startup | First-read cost |
|:---|:---|:---|:---|:---|
| Local dev | TS / JSON files | Scan dir → build `(type,name)→path` index (~50ms for 1k items) | Index only; *no* parsed specs | Parse on first `get` (~5ms / item) |
| Cloud SaaS | Postgres rows | Open pool + `LISTEN metadata_events` | Empty cache | `SELECT … LIMIT 1` (~3ms) |
| Multi-replica cloud | Postgres rows | Same | Empty | Same — `LISTEN` keeps replicas converged |
| Tests | In-memory map | None | Empty | O(1) |
| Hybrid (offline) | Local FS index + remote DB | Load local snapshot + start sync worker | Local snapshot only (small) | Hits local first |

Key invariants:

1. **No mode does an eager full-load.** This is non-negotiable for scaling to enterprise org sizes.
2. **Cache is bounded.** A misconfigured caller can't OOM the process by walking every item.
3. **Multiple Repositories may be composed.** Built-in metadata from `system` org lives in a `FileSystemRepository`; tenant overlays live in `PostgresRepository`. A `LayeredRepository` composes both.
4. **No global mutable state outside the cache.** Tests can spin up a kernel with `InMemoryRepository` and run sub-second.

---

## 4. Multi-tenancy & namespacing

| Layer | Scope key |
|:---|:---|
| Repository | `org / branch` is part of every read and every write |
| Cache | Same — cache key includes all four parts of `MetaRef` |
| Change log | Per `(org, branch)` monotonic sequence |
| Registry | Each kernel instance is bound to one `(org, branch, env)` triple; one server may host many kernels (ADR-0004) |

Cross-org references are not allowed at the protocol level; they go through marketplace **packages** (ADR-0003).

---

## 5. Branching & promotion (M2)

Inspired by Salesforce Scratch Orgs + Git mental model:

- `main` — the default branch; production reads from here in cloud mode.
- `dev/<user>` — per-user dev branches (cloud Studio Quick-Edit).
- `pr/<n>` — branches associated with a review.
- `local` — implicit branch for `objectstack dev` (never pushed unless explicitly promoted).

`promote(fromBranch, toBranch, sinceSeq)`:

1. Reads events `seq > sinceSeq` from `fromBranch`.
2. Validates each against `toBranch` HEAD.
3. Replays as new `put`s on `toBranch` with `actor = 'promote:<user>'`.
4. Conflicts surface to the caller for manual resolution.

This is a single-table operation on `PostgresRepository`; on `FileSystemRepository` it produces a patch file users can apply manually.

---

## 6. Schema evolution

ADR-0005 already covers the overlay case. ADR-0008 generalizes:

- Every spec stored in the Repository is tagged with the **Zod schema version** that wrote it.
- On read, if the stored version is older than the current, a registered codemod runs in-flight (no rewrite to storage).
- `objectstack migrate` is an explicit operation that materialises the codemod results back to storage.
- This mirrors Hasura's `metadata.yaml` + `migrations/` split.

---

## 7. AI as a Repository client

To prevent the anti-pattern of "AI modifies runtime state directly":

- AI agents author changes through the same `repo.put` contract, with `actor='ai:<model>'`.
- Every AI-authored change is reviewable (same audit log as humans).
- Optional `repo.proposePut(...)` workflow stages the change as a draft event without committing to HEAD; a human reviewer flips it to active.

This brings AI editing under the same governance umbrella as human editing — no special path, no parallel state.

---

## 8. Non-goals

1. We are **not** introducing a graph database. The Repository is a flat content-addressable store; relationships live inside specs.
2. We are **not** building a custom diff/merge algorithm in M0–M3. Branch merge in M2 starts with "last writer wins" + conflict surfacing; semantic merge is a research milestone in M4+.
3. We are **not** changing how `dist/objectstack.json` artifacts work for *compiled* deployment. The artifact is still the canonical immutable bundle used by edge / serverless. The Repository is the *editable* layer.
4. We are **not** unifying with the data plane (`sys_user`, `sys_role`, business rows). Metadata and data are different concerns; only metadata goes through this Repository.

---

## 9. Migration plan

The plan is intentionally staged so each milestone is **independently shippable** and **never requires rewriting** earlier work. Code written in M0 is the same code running in M4.

### Milestone overview

| Milestone | Duration | Outcome | Unlocks |
|:---|:---|:---|:---|
| **M0 — Event layer** | 1-2 weeks | Repository interface + Change Log + InMemory & FileSystem impls + Studio HMR migrated | Real local HMR; deletes the artifact-mode special case |
| **M1 — Cloud Repository** | 1 month | `PostgresRepository` + multi-tenant scoping + Tooling API | Cloud Studio editing; multi-replica safe |
| **M2 — Branch & promotion** | 1-2 months | Forks, diffs, three-way merge, `promote` CLI | Dev/staging/prod separation; PR-style workflows |
| **M3 — Offline + CRDT** | 2-3 months | `HybridRepository`; IndexedDB client cache; Yjs collaborative editing | Linear/Figma-class editor UX; marketplace packages |
| **M4 — Ecosystem** | continuous | Third-party Repository & type plugins; AI proposal workflow; signed packages | Open ecosystem; AI governance |

### M0 — Event layer (most urgent, unblocks current HMR)

**Deliverables**

1. New package `packages/metadata-core/` with:
   - `MetadataRepository` interface (Zod-typed `MetaRef`, `MetadataItem`, `MetadataEvent`, `PutOptions`, `ConflictError`)
   - `canonicalize(spec, schema)` helper (stable JSON + sha256 hash)
   - `MetadataCache` (bounded LRU, event-invalidated)
   - `InMemoryRepository` reference implementation (tests + edge runtime)
2. `packages/metadata/` refactored:
   - Existing `MetadataManager` rewritten as a thin wrapper over `MetadataCache` + `MetadataRepository`
   - `_loadFromLocalFile` → moves into `FileSystemRepository`
   - HMR SSE route migrates from "POST trigger" → "subscribe to repo.watch() and forward to clients"
3. `packages/metadata-fs/` new (or sub-export of metadata):
   - `FileSystemRepository` with chokidar-backed `watch`
   - Boot-time index scan; lazy parse on `get`
   - JSONL change log under `.objectstack/.log/`
4. `packages/objectql/` change:
   - `SchemaRegistry` subscribes to repo events for `type=object` and invalidates entries
   - Read path: cache → repository (no more boot-time eager fill)
5. `packages/cli/` change:
   - `objectstack dev` no longer POSTs to the server; the server's own chokidar instance reacts
   - `objectstack compile` continues to produce `dist/objectstack.json` for prod deploys
6. `apps/studio/` change:
   - HMR SSE client schema bumps to include `MetadataEvent` fields
   - Replace ad-hoc reload triggers with `useMetadataEvent({ type, name })` hook
7. ADR-0005 overlay path:
   - Reframed in terms of M0: overlay = a second Repository implementation, composed via `LayeredRepository(systemFS, tenantOverlay)`
   - `sys_metadata` table is now the *Repository backend* for tenant edits; no projection tables
8. Tests:
   - Contract test suite that any Repository implementation must pass (golden test from spec)
   - Property tests for canonicalize idempotence and hash stability

**Acceptance criteria**

- [ ] Editing any view/object/flow/dashboard in VSCode reflects in Studio Preview within 1s, in both artifact-mode and config-eval-mode dev
- [ ] `GET /api/v1/meta/view/case` reflects the new spec immediately after a file save (no restart)
- [ ] `objectstack dev` no longer requires the `/api/v1/dev/metadata-events` POST endpoint
- [ ] All existing tests pass; new contract suite passes for both `InMemoryRepository` and `FileSystemRepository`
- [ ] Cold start of `examples/app-crm` is ≤ current baseline (no eager full-load)
- [ ] `MetadataEvent` stream visible in `apps/studio/Logs` panel
- [ ] No code in `packages/objectql/src/protocol.ts` reads files or imports from `@objectstack/metadata-fs`

**Out of scope for M0**

- Postgres backend
- Branches (only `main`)
- Promotion
- CRDT
- AI governance

### M1 — Cloud Repository

**Deliverables**

1. `packages/metadata-postgres/`:
   - `PostgresRepository` with `metadata_items` + `metadata_events` tables
   - `LISTEN/NOTIFY` for `watch`
   - Migration files under `packages/metadata-postgres/migrations/`
2. Multi-tenant scoping:
   - `MetaRef.org/branch` propagation through HTTP middleware → kernel context → repository
   - Per-tenant row-level guards
3. Tooling API:
   - `GET /api/v1/tooling/meta/:type/:name` (returns `{ item, version, hash }`)
   - `PUT /api/v1/tooling/meta/:type/:name` (requires `If-Match`)
   - `DELETE …`
   - `GET /api/v1/tooling/events?since=<seq>` (long-poll fallback when SSE unavailable)
4. `LayeredRepository(builtinFS, tenantPg)`:
   - System metadata stays on disk for the kernel binary
   - Customer overlays live in Postgres; reads merge layers (top wins)
5. Studio cloud mode:
   - Inline edits PUT to tooling API
   - Multi-replica server: edits propagate via `LISTEN` to all replicas within ~100ms

**Acceptance criteria**

- [ ] Cloud Studio user A edits a view; user B (different browser, different replica) sees the change within 1s
- [ ] Pulling the plug on one server replica does not cause stale reads on the others (verified via chaos test)
- [ ] Tooling API supports `If-Match` and returns `412 Precondition Failed` on conflict
- [ ] Audit log query (`SELECT * FROM metadata_events WHERE actor=…`) returns expected entries

### M2 — Branch & promotion

**Deliverables**

1. `repo.fork(from, to)` and `repo.merge(from, to, strategy)` on `PostgresRepository`
2. `objectstack promote --from dev --to staging --since-seq=N` CLI command
3. Studio branch picker UI + diff viewer
4. Conflict resolution modal in Studio (three-way diff of current head vs incoming vs base)

### M3 — Offline + CRDT

**Deliverables**

1. `HybridRepository` with IndexedDB local cache + background sync
2. Yjs CRDT integration for collaborative inline editing (one editor, multi-cursor)
3. Marketplace package import/export (signed bundles produced from a sequence of events)

### M4 — Ecosystem

**Deliverables**

1. Public Repository plugin SDK
2. AI proposal workflow (`repo.proposePut` + review queue + approve/reject)
3. Signed packages with publisher verification
4. Cross-org marketplace

---

## 10. M0 work breakdown (tactical)

The M0 milestone is itself decomposed into shippable PRs. Each PR is independently mergeable and adds value on its own.

### PR-1: `packages/metadata-core` skeleton (1-2 days)
- Zod schemas for `MetaRef`, `MetadataItem`, `MetadataEvent`, `PutOptions`
- `canonicalize()` + sha256
- `MetadataRepository` interface (no implementations yet)
- `ConflictError`, `NotFoundError`, `SchemaValidationError` typed errors
- 100% test coverage for canonicalize / hash stability

### PR-2: `InMemoryRepository` + contract test suite (1 day)
- Reference implementation backed by `Map`
- Contract-test suite that any Repository must pass (parameterized over implementation)
- Migrate edge-runtime and test fixtures off `MetadataManager` to `InMemoryRepository`

### PR-3: `MetadataCache` (1 day)
- Bounded LRU + max-bytes
- Subscribes to `repo.watch()`, invalidates on event
- Lazy-fill on read miss
- Property tests for cache coherence under concurrent reads + invalidations

### PR-4: `FileSystemRepository` (2-3 days)
- Boot scan → `(type,name)→filePath` index
- Lazy parse on `get`
- chokidar watch → diff hash → emit event
- JSONL change log under `.objectstack/.log/<branch>.jsonl`
- Contract suite passes

### PR-5: `LayeredRepository` (0.5 day)
- Composes N repositories; reads top-to-bottom; writes go to the topmost writable
- Forwards events from all layers, tagged with source layer

### PR-6: Refactor `packages/metadata` over the new core (2 days)
- `MetadataManager` becomes a thin wrapper for backwards compatibility
- `_loadFromLocalFile` deleted; replaced by `FileSystemRepository`
- HMR SSE route migrates to `repo.watch()` subscriber

### PR-7: ObjectQL `SchemaRegistry` subscribes to events (1 day)
- `protocol-service` init wires `repo.watch({type:'object'})` → registry.invalidate
- Boot no longer eagerly loads all objects
- Read path: cache-first
- Regression tests: existing CRM tests pass without modification

### PR-8: CLI `objectstack dev` deshims (0.5 day)
- Remove `/api/v1/dev/metadata-events` POST
- CLI no longer compiles on every save in dev mode (server's watcher handles it)
- `objectstack compile` still works for prod deploys

### PR-9: Studio `useMetadataEvent` hook (1 day)
- React hook over SSE
- Replaces ad-hoc reload triggers in `MetadataPreview`, `LiveFormPreview`, Object Hub
- HMR status indicator uses event seq for "N changes since boot" display

### PR-10: ADR-0005 overlay path migration (1 day)
- Re-express overlay as `LayeredRepository(systemFS, sysMetadataPg)`
- No projection tables — `sys_view` etc. fully decommissioned (mostly already done per ADR-0005)
- Studio PUT goes through tooling API → tenant repo

### PR-11: Documentation + ADR cross-references (0.5 day)
- Update ADR-0005 to reference ADR-0008
- New `content/docs/concepts/metadata-lifecycle.mdx`
- Update `content/docs/concepts/architecture.mdx` to include the four-layer diagram

### Total M0 effort

- Engineering: ~10-12 PR-days, parallelizable to ~6-7 calendar days with 2 engineers
- Review/iteration: + ~30%
- Realistic: **~2 calendar weeks** with one senior engineer; ~1 week with two

---

## 11. Risks & mitigations

| Risk | Likelihood | Impact | Mitigation |
|:---|:---|:---|:---|
| Canonicalize is non-idempotent in edge cases (e.g. number precision, key order in nested objects) | Med | High (silent change storm) | Property-tested in PR-1; fuzz with `fast-check` |
| chokidar misses events on macOS atomic rename | Med | Med (stale until manual refresh) | Already a known issue; fall back to polling every 5s for safety |
| `LISTEN/NOTIFY` payload size exceeds 8KB in Postgres | Low | Med (drop notify, leave replicas stale) | Payload carries only `(seq, type, name)`; consumers re-fetch |
| Multi-replica `seq` collisions on writes | Med | High (corrupted log) | Use Postgres `SERIAL` column on `metadata_events`; never trust client-supplied seq |
| Cache invalidation causes thundering herd on hot ref | Low | Med (DB load spike) | Coalesce concurrent fetches via in-flight promise map |
| Migration from existing `MetadataManager` breaks downstream consumers | Med | High (regression) | Keep `MetadataManager` as a deprecated wrapper for one release cycle; new code uses Repository |
| Overlay merge semantics change with `LayeredRepository` | Med | Med (different precedence than ADR-0005) | Add explicit precedence test suite; document in ADR-0005 amendment |

---

## 12. Open questions

1. **Should `MetadataEvent` carry the full new spec or just the hash?** Carrying the spec saves a round-trip on the consumer but bloats the event log. Likely answer: carry hash only; consumers fetch via cache.
2. **How do we represent rename atomically?** Two events (`delete`+`create`) or a single `rename` op? Going with a single `rename` op for cache-friendliness.
3. **What's the canonical hash function?** sha256 over canonicalized JSON. Algorithm pluggable but default fixed.
4. **Per-branch change log table or one big table?** Single table with index on `(org, branch, seq)`; partitioning if scale demands.
5. **Do we sync built-in metadata between server and client (offline mode)?** No in M3; only tenant edits sync.
6. **Where do schema-version codemods live?** New `packages/metadata-codemods/`; auto-discovered via plugin registry.

---

## 13. Decision

**Adopt.** Begin M0 immediately. M1 contingent on M0 completion and Cloud team capacity. M2+ tracked on the public roadmap; specifics subject to revision based on M0/M1 lessons learned.

The Repository / Change Log / Cache / Registry separation is now the canonical mental model for all metadata work in the codebase. Code reviews should reject changes that re-conflate these layers.

