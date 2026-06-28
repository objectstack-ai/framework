# ADR-0076: objectql is the data engine — relocate metadata management (protocol) out of it; enforce the boundary; defer the engine repo-split

**Status**: Proposed (2026-06-28, rev. 5 — adds the kernel-architecture review: the engine is a clean primitive; the real debt is the `ObjectStackProtocol` god-interface, segmented per ISP in D8–D9) — v12 assessment
**Deciders**: ObjectStack Protocol Architects
**Builds on**: [ADR-0005](./0005-metadata-customization-overlay.md) (sys_metadata overlay substrate), [ADR-0025](./0025-plugin-package-distribution.md) (plugin package distribution), [ADR-0033](./0033-ai-assisted-metadata-authoring.md) (open-core boundary), [ADR-0048](./0048-cross-package-metadata-collision.md) (package id is the addressing unit), [ADR-0066](./0066-unified-authorization-model.md) (secure-by-default, posture-gated bypass)
**Consumers**: **new** `@objectstack/metadata-protocol` (receives `protocol` + `sys-metadata-repository` + `metadata-diagnostics`), `@objectstack/objectql` (loses protocol → becomes a lean data engine; keeps a back-compat re-export), `@objectstack/metadata-core` (gains the `SysMetadataEngine` interface), `@objectstack/plugin-security`, `@objectstack/plugin-sharing`, `@objectstack/spec`, and out-of-tree embedders — notably `../objectbase` (its `gateway`).

**Premise**: objectql was conceived as "a metadata-driven ORM that replaces TypeORM." It has outgrown that framing: it is a metadata-driven **data engine** sitting on top of knex (`driver-sql` → `knex@^3.2.10`). The complexity the team feels is not the engine; it is everything layered above and *beside* it — including `protocol.ts` (268KB of sys_metadata management / draft-publish / package ownership / locks) which lives *inside the objectql package by historical accident*, not by design.

> **Trigger**: `../objectbase`'s `gateway` wants to embed only the objectql engine without the platform. While scoping that, a sharper observation surfaced: **`protocol.ts` is metadata-domain code mis-located in the data-engine package.** Measurement confirms it (below). Relocating it — not a subpath, not a repo split — is the correct, cheap, *now* move that makes objectql lean by construction.

---

## TL;DR

1. **knex is a SQL query builder objectql already uses**, not an ORM to switch to. Retreating forfeits the one-library / one-object-model goal and removes none of the felt complexity.
2. **`protocol.ts` does not belong in the objectql package.** It implements `ObjectStackProtocol` (the contract lives in `@objectstack/spec`), manages sys_metadata, locks, commits, package ownership — pure metadata-domain work. It uses the engine only as storage, through a **5-method `SysMetadataEngine` interface** injected at runtime.
3. **Measured coupling makes the relocation cheap.** Last month: `protocol.ts` changed 47×; only **3 (6%)** also touched `engine.ts`, while **20 (43%)** touched `metadata-core`/`metadata`/`spec`. Blast radius of the move is **2 source files** (`plugin.ts` wiring, `index.ts` re-export). Its two helpers (`sys-metadata-repository`, `metadata-diagnostics`) depend only on `metadata-core`/`spec`/`types` and move with it.
4. **Decision (now):** relocate `protocol` + helpers into a **new `@objectstack/metadata-protocol`** package between `metadata-core` (pure contracts) and `metadata` (plugin). objectql becomes a lean data engine **by construction** — the 268KB genuinely leaves the package; the gateway depends on objectql with no protocol. Add a **boundary ratchet** so the engine stays pure. Add the **capability/profile** contract for optional permissions. Formula stays in core.
5. **Decision (later, separate concern):** extracting the *engine itself* into a standalone repo remains **trigger-gated** on its cross-package commit ratio (currently **88%** for `engine.ts`/`registry.ts`). That is orthogonal to — and unblocked by — the protocol relocation.

6. **Kernel review — the deeper debt is the contract, not the engine.** The engine hard-codes **zero** governance (RLS/RBAC/owner/tenant are all pluggable) and is the part to protect. But the central wire contract `ObjectStackProtocol` is a **70-method, 11-domain god-interface** (60/70 optional; no consumer uses >11%). Decision: **segment it per ISP** into `DataProtocol` + `MetadataProtocol` + optional capability protocols, keeping a composed alias for back-compat (see D8–D9). Spec/type-level and incremental.


## Context: the layers

| Layer | What it is | Where it lives today | Where it should live |
|---|---|---|---|
| SQL generation | dialect/pool/binding | `knex` (in `driver-sql`) | unchanged |
| **Data engine** | QueryAST→driver; CRUD; hooks; validation; formula | `objectql/src/{engine,registry,validation,hook-wrappers}` | unchanged (this is `@objectstack/objectql`) |
| **Metadata management** | `ObjectStackProtocol` impl; sys_metadata CRUD; draft/publish; locks; ownership; diagnostics | **`objectql/src/protocol.ts` (mis-located)** + `metadata-core` + `metadata` plugin | **new `@objectstack/metadata-protocol`** |
| Governance | RLS, sharing, field perms | `plugin-security`, `plugin-sharing` (already separate) | unchanged |

## Decision data

```
protocol.ts commits last month:        47
  also touched engine.ts:               3  (6%)    ← protocol↔engine ≈ decoupled
  also touched metadata-core/metadata/spec: 20  (43%)  ← its real neighbors
import sites of ObjectStackProtocolImplementation (source): plugin.ts, index.ts   (+ co-located helpers)
engine surface protocol needs: SysMetadataEngine = { find, findOne, insert, update, delete, transaction? }  (injected)

(for contrast) engine.ts/registry.ts commits last month: 50, of which 44 (88%) cross-package → engine itself NOT separable yet
```

## Decision

### D1 — Relocate protocol out of objectql into `@objectstack/metadata-protocol` [new — the centerpiece]

- Move `protocol.ts`, `sys-metadata-repository.ts`, `metadata-diagnostics.ts` from `@objectstack/objectql` into a **new `@objectstack/metadata-protocol`** package.
- Move the `SysMetadataEngine` interface into `@objectstack/metadata-core`; `metadata-protocol` depends on `metadata-core` + `spec` + `core` (for `IDataEngine`) + `types` — **not on the objectql package**. The concrete engine is injected at runtime (as today).
- `@objectstack/objectql` re-exports `ObjectStackProtocolImplementation` from the new package for back-compat (the only two source importers — `plugin.ts`, `index.ts` — are updated; `plugin.ts` keeps wiring it, now imported from `metadata-protocol`).
- Result: objectql is a lean data engine **by construction** — 268KB of metadata logic physically leaves the engine package. The gateway depends on `@objectstack/objectql` and never pulls protocol. (This **replaces** the rev.3 `./core` subpath proposal, which was a workaround for the false premise that protocol must stay in objectql. A subpath remains an optional later polish to also exclude the small `ObjectQLPlugin`/`kernel-factory` glue.)

### D2 — Boundary ratchet keeps the engine pure [new — keystone]

A CI test asserts `@objectstack/objectql` does **not** import `@objectstack/metadata-protocol` / `plugin` / `kernel` (the dependency points one way: `metadata-protocol → objectql-public-interface`, never back). This makes the relocation durable and creates backpressure against the engine re-absorbing metadata/platform concerns — the root cause of the original complexity. Fits the team's existing ratchet culture (liveness / api-surface / authz-matrix).

### D3 — Capability + profile contract for optional governance [new, extends ADR-0066]

Required capabilities are **derived** from object declarations (RLS block → `rls`; `requiredPermissions` → `permissions`; sharing → `sharing`). Plugins declare `provides: [...]`. The host validates at boot; **default fail-closed**. A host may run without the authz surface via an explicit `profile: 'trusted' | 'internal'` — **two-key**: build-time plugin absence + explicit runtime assertion; production env-gated. Lifts ADR-0066 posture-gated bypass to the assembly layer.

### D4 — Formula stays in core [ruled]

`@objectstack/formula` is used by `engine.ts` (formula fields), `validation/rule-validator.ts`, `hook-wrappers.ts`, `seed-loader.ts` — a hard dependency of the engine. `cel-js` is small and not the complexity driver.

### D5 — One object model, authored once [existing → ruled]

Definitions live in `@objectstack/spec` (zero runtime deps); gateway and backend import the same `*.object.ts` and call the same engine; only the installed capability set differs.

### D6 — Capabilities attach uniformly across assembly modes [existing → ruled]

RLS/permissions/sharing attach via engine **middleware** (`ql.registerMiddleware(...)`) + hooks — kernel-independent. Ratify this as the public, supported capability-attachment API.

### D7 — Engine repo-split is a separate, trigger-gated future phase [sequencing]

Extracting the *engine* into a standalone repo (the `objectui` sibling-link, no-publish model) is gated on the engine's cross-package commit ratio (currently **88%**) falling. This ADR's relocation (D1) is independent of and unblocked by D7. `objectui` separates cleanly because it is a stable downstream leaf; the engine is an upstream foundation still in 88% cross-cutting co-evolution — separating it now would reproduce the overhead that caused the earlier `@objectql/core` merge-back.

### D8 — The engine stays a pure, governance-free primitive [ratify — kernel review]

A deep read of `engine.ts` (~3.3k LOC) confirms it hard-codes **no** governance: RLS, RBAC, field-masking, owner stamping, and tenant `organization_id` are all injected by plugins via `registerMiddleware` + hooks (`plugin-security` / `plugin-sharing` / `org-scoping`); the driver port is minimal (CRUD+DDL); boot ordering is sound. This pluggable-primitive property is the kernel's most valuable asset. **No protocol, metadata-management, or governance logic may enter the engine** — protect this over any tidiness goal (the `./core` ratchet, D2, guards it).

### D9 — Segment the `ObjectStackProtocol` god-interface per ISP [new — kernel review]

The central contract in `spec/api/protocol.zod.ts` bundles **70 methods across 11 unrelated domains** — Data (9), Metadata (8), Feed (13), Notifications (7), Realtime (6), Packages (6), Views (5), Permissions (3), Workflows (3), AI (3), i18n (3), Analytics (2), Automation (1). **60/70 are optional, and no consumer uses more than ~11%** (REST ~11%, objectql ~2%, analytics ~3%). It aggregates domains that already have their own services (`service-analytics` / `service-realtime` / `service-messaging`), which forces the ~5.6k-LOC facade, makes the contract un-versionable, and is the root cause of the `metadata-protocol` naming confusion (the package also carries the thin data facade).

Decision — split the interface into focused contracts:
- **`DataProtocol`** — `findData/getData/createData/updateData/deleteData` (+ batch): thin wire-normalizers over the engine.
- **`MetadataProtocol`** — metadata read/write, draft/publish, locks (ADR-0010), commits (ADR-0067), package ownership (ADR-0048), `loadMetaFromDb`: the heavy control plane (the true content of `@objectstack/metadata-protocol`).
- **Optional capability protocols** — `AnalyticsProtocol` / `FeedProtocol` / `RealtimeProtocol` / `NotificationProtocol` / `ViewProtocol` / …, each owned by its existing service and independently optional/versionable.
- **Back-compat** — keep `ObjectStackProtocol = DataProtocol & MetadataProtocol & Partial<…>` as a composed alias so current callers/types keep working.

The segmentation is **spec/type-level and may start incrementally now** (define sub-interfaces; narrow consumers over time). The implementation restructure + the `@objectstack/metadata-protocol` rename are breaking and ride the **same cross-repo window as D7 / Step 2**.

## Feasibility (verified against current source)

| Claim | Status | Evidence |
|---|---|---|
| protocol is metadata-domain, not engine | ✅ | implements `ObjectStackProtocol` (`spec/api`); manages sys_metadata/locks/commits/ownership |
| protocol decoupled from the engine | ✅ | 6% commit co-change with `engine.ts`; needs only the 5-method `SysMetadataEngine` (injected) |
| relocation blast radius is tiny | ✅ | only `plugin.ts` + `index.ts` import the impl; helpers depend only on metadata-core/spec/types |
| splitting protocol saves engine deps | ✅ (for the engine package) | protocol's deps (spec/*, core, metadata-core) leave with it; engine keeps only its own |
| engine itself separable now | ❌ | 88% of engine/registry commits cross-package → D7 deferred |

## Worked example

```ts
// Gateway (objectbase) — depends on the (now lean) engine; protocol is simply not in the package
import { ObjectQL } from '@objectstack/objectql';
import { MemoryDriver } from '@objectstack/driver-memory';
import { Account } from '@shared/objects/account.object'; // SAME definition as the backend

const engine = new ObjectQL({ profile: 'trusted' });
engine.registerDriver(new MemoryDriver(), true);
await engine.init();
engine.registry.registerObject(Account);
await engine.find('account', { where: { active: true } });

// Backend — adds metadata management + governance on top of the same engine
import { createObjectQLKernel } from '@objectstack/objectql';
import { ObjectStackProtocolImplementation } from '@objectstack/metadata-protocol';
import { SecurityPlugin } from '@objectstack/plugin-security';
```

## Phasing

1. **P1 — Relocate protocol** to `@objectstack/metadata-protocol` (move 3 files; move `SysMetadataEngine` into metadata-core; update `plugin.ts` import + `index.ts` re-export). Behavior unchanged.
2. **P2 — Boundary ratchet** (objectql must not import metadata-protocol/plugin/kernel) + export-surface ratchet.
3. **P3 — Capability/profile contract** (the only substantial new code).
4. **P4 — Standalone embed example + smoke** under `examples/`.
5. **Later (D7)** — engine repo-split when the cross-package ratio drops.

## Consequences

- **+** objectql is lean by construction; protocol lands in its proper domain; real enforced package boundary (not a convention); gateway unblocked; all without breaking downstream (re-export shim).
- **+** Cheap and low-risk now (6% coupling, 2-file blast radius, narrow injected interface).
- **−** One new package in the fixed version group; a major-version bump for the moved export (mitigated by the re-export shim).
- **Risk (highest)**: capability/profile under-specified → silent authz bypass. Mitigation: default fail-closed; `trusted` two-key + prod env-gate; authz-matrix ratchet.
- **Risk**: tsup DTS stricter than tsc / turbo build-order during the package move. Mitigation: incremental, watch DTS.

## Open questions (with recommended positions)

1. **protocol's new home** — resolved: a dedicated **`@objectstack/metadata-protocol`** between `metadata-core` (kept pure) and the `metadata` plugin (avoids dragging chokidar/fs deps onto pure runtime protocol logic).
2. **`SysMetadataEngine` interface home** — recommend `@objectstack/metadata-core` (it is a contract; metadata-protocol depends on metadata-core anyway).
3. **Capability granularity** — derive from object declarations; do not overload per-user `requiredPermissions`.
4. **`trusted` profile** — two-key (build-time absence + explicit runtime assertion), prod env-allowlisted.
5. **D7 trigger threshold** — what cross-package ratio (from 88%) over what window signals "extract the engine"? Track in CI; set on first review.
6. **Data-facade home** — does the `DataProtocol` impl live in the engine-adjacent transport layer / `rest`, or a small `@objectstack/protocol-data`? (It is thin and transport-shaped.)
7. **Metadata package name (post-segmentation)** — keep `@objectstack/metadata-protocol` for the `MetadataProtocol` impl, or rename (`@objectstack/protocol-metadata` / `@objectstack/metadata-runtime`)?
8. **Per-domain versioning** — once segmented, do capability protocols get independent version markers / a `getCapabilities()` discovery method?
