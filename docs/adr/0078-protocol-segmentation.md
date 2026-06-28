# ADR-0078: Segment the `ObjectStackProtocol` god-interface (ISP); keep the engine a pure primitive

**Status**: Proposed (2026-06-28) — kernel architecture assessment; execution gated to the cross-repo window (with ADR-0076 Step 2)
**Deciders**: ObjectStack Protocol Architects
**Builds on**: [ADR-0076](./0076-objectql-core-tiering.md) (objectql core tiering — protocol relocated to its own package; lean `./core` entry; Step 2 deferred), [ADR-0066](./0066-unified-authorization-model.md) (governance is pluggable, not in the engine), [ADR-0025](./0025-plugin-package-distribution.md) / [ADR-0033](./0033-ai-assisted-metadata-authoring.md) (open-core boundary)
**Consumers**: `@objectstack/spec` (`api/protocol.zod.ts` — the contract), `@objectstack/metadata-protocol` (the impl), `@objectstack/rest` (dispatcher), `@objectstack/objectql` (engine + boot), and the domain services that already implement slices (`service-analytics`, `service-realtime`, `service-messaging`, …).

**Premise**: A deep review of the data kernel (prompted by "why does objectql depend on protocol, and protocol isn't only metadata") found that the engine is well-designed but the **central wire contract is a god-interface**. This ADR records that finding and the decision to segment the contract, separately from the packaging work already done in ADR-0076.

---

## TL;DR

1. **The engine is the crown jewel and it is correct — protect it.** `engine.ts` (~3.3k LOC) hard-codes **zero** governance: RLS, RBAC, field-masking, owner stamping, tenant `organization_id` are all in plugins via `registerMiddleware` + hooks. The driver port is minimal (CRUD+DDL). Boot ordering is sound. **Do not add protocol/governance concerns to the engine.**
2. **The real debt is `ObjectStackProtocol`: a 70-method, 11-domain god-interface.** Data(9) + Metadata(8) + Feed(13) + Notifications(7) + Realtime(6) + Packages(6) + Views(5) + Permissions(3) + Workflows(3) + AI(3) + i18n(3) + Analytics(2) + Automation(1). **60/70 are optional; no consumer uses >11%** (REST ~11%, objectql ~2%, analytics ~3%).
3. **Decision: segment the contract per ISP** into `DataProtocol`, `MetadataProtocol`, and optional capability protocols (Analytics/Feed/Realtime/Notification/View/…). Keep a composed alias `ObjectStackProtocol = DataProtocol & MetadataProtocol & Partial<…>` for back-compat. This is mostly **spec/type-level and incremental**.
4. **The implementation and package naming follow the contract.** Once split, the `DataProtocol` impl is thin (near-engine), the `MetadataProtocol` impl is the heavy control plane; the capability domains are served by their **already-existing** services, not bundled. `@objectstack/metadata-protocol` is then accurately named (or split). Done at the **cross-repo window with ADR-0076 Step 2** (cloud boots `ObjectQLPlugin` directly in ~8 sites).

## Context

### What the review established

| Layer | Finding | Verdict |
|---|---|---|
| `IDataDriver` port | CRUD + DDL only | minimal, clean |
| **engine (`objectql`)** | in-process data primitive; **zero governance hard-coded** (verified: no RLS/permission/tenant logic in `engine.ts`); governance is 100% middleware/hooks (`plugin-security`/`plugin-sharing`/`org-scoping`) | **clean primitive — protect** |
| capability seam | `registerMiddleware((ctx,next)=>…)` onion + per-object/priority hooks | clean, well-defined |
| **`ObjectStackProtocol`** | 70 methods, 11 unrelated domains, 60 optional, no consumer >11% | **god-interface — the debt** |
| `ObjectStackProtocolImplementation` | ~5.6k LOC; *large but maintainable* (uses only public engine API; repository pattern isolates overlay) | size is **driven by the god-interface** |

### Why the god-interface is the root cause

The contract conflates the **data plane** (CRUD), the **metadata control plane** (sys_metadata mgmt), and a long tail of **capability domains** (feed, realtime, notifications, analytics, AI, i18n, …) that **already have their own services**. The interface merely *aggregates* them. Consequences:

- Anything that "implements the protocol" is nominally on the hook for 11 domains → forces a monolithic ~5.6k-LOC facade.
- The contract **cannot be versioned** — a change in any one domain perturbs the whole protocol.
- It is the shared root cause of the symptoms surfaced earlier: the misleading `metadata-protocol` name (the package is *not* only metadata — it also carries the thin data facade), and the difficulty explaining "what protocol is."

### What ADR-0076 already did (and did not)

ADR-0076 relocated the protocol implementation into its own package and added the lean `@objectstack/objectql/core` entry (shipped in #2415). That fixed **packaging and the engine-embed story**. It did **not** address the **shape of the contract** — that is this ADR.

## Decision

### D1 — The engine stays a pure, governance-free primitive [ratify]
No protocol, metadata-management, or governance logic enters `engine.ts` / `@objectstack/objectql/core`. Governance remains pluggable (ADR-0066). The `./core` boundary ratchet (ADR-0076) guards this. This is the kernel's most valuable property; protect it over any tidiness goal.

### D2 — Segment `ObjectStackProtocol` per the Interface Segregation Principle [new]
Split the single interface in `spec/api/protocol.zod.ts` into focused contracts:
- **`DataProtocol`** — `findData/getData/createData/updateData/deleteData` (+ batch). Thin wire-normalizers over the engine.
- **`MetadataProtocol`** — `getMetaItem(s)/saveMetaItem/publishMetaItem/deleteMetaItem/getMetaTypes/getDiscovery/getUiView` + draft/publish, locks (ADR-0010), commits (ADR-0067), package ownership (ADR-0048), `loadMetaFromDb`. The heavy control plane.
- **Optional capability protocols** — `AnalyticsProtocol`, `FeedProtocol`, `RealtimeProtocol`, `NotificationProtocol`, `ViewProtocol`, … each owned by its existing service, each independently optional and versionable.
- **Back-compat**: keep `ObjectStackProtocol = DataProtocol & MetadataProtocol & Partial<AnalyticsProtocol & FeedProtocol & …>` as a composed alias so current callers/types keep working. The split is largely **type-level and can land incrementally** (define sub-interfaces first; narrow consumers over time).

### D3 — Implementation and packaging follow the contract [new]
- `DataProtocol` impl is thin (normalize → engine); it may live next to the engine-adjacent transport layer rather than inside the metadata package.
- `MetadataProtocol` impl is the substantial control plane and is the true content of today's `@objectstack/metadata-protocol`.
- Capability domains are **served by their existing services** (`service-analytics` / `service-realtime` / `service-messaging` / …), not re-bundled into one facade.
- **Rename**: once the data facade is separated, `@objectstack/metadata-protocol` is accurately the metadata-protocol package (or is renamed to reflect the data/metadata split). Treat the rename as breaking and bundle it with the cross-repo window.

### D4 — Sequencing: contract now (incremental, low-risk), packaging at the cross-repo window [new]
- The **contract segmentation (D2)** is spec/type-level, mostly non-breaking via the composed alias, and may begin incrementally at any time.
- The **impl/package restructure + rename (D3)** and **ADR-0076 Step 2** (making the engine package itself protocol-free) share the same blast radius — cloud constructs `ObjectQLPlugin` directly in ~8 sites — and must land in a **coordinated framework+cloud window** (a major). Do them together.

## What stays unchanged
- The engine, the driver port, and the middleware/hook capability seam (ADR-0066/0076).
- Existing domain services (analytics/realtime/messaging) keep their implementations; only the *contract* stops aggregating them.
- `@objectstack/objectql/core` remains the lean embed entry.

## Consequences
- **+** A versionable, segregated contract; implementers depend only on the slice they serve; SDK/codegen per-domain; the ~5.6k-LOC facade is no longer forced.
- **+** Resolves the naming confusion at the root (data vs metadata vs capability domains become distinct).
- **+** The high-leverage part (D2) is incremental and low-risk (type-level + composed alias).
- **−** A full split touches `spec` (the contract) and every implementer/consumer; the rename is breaking → must ride the coordinated cross-repo major.
- **Risk**: doing D2 half-way (sub-interfaces defined but consumers never narrowed) yields churn with little gain. Mitigation: pair each new sub-interface with at least one consumer narrowed to it, and track coverage.

## Open questions
1. **Data facade home** — does `DataProtocol` impl live in the engine-adjacent transport package, in `rest`, or in a small `@objectstack/protocol-data`? (It is thin and transport-shaped.)
2. **Metadata package name** — keep `@objectstack/metadata-protocol` for the `MetadataProtocol` impl, or rename to `@objectstack/metadata-runtime` / `@objectstack/protocol-metadata`?
3. **Per-domain versioning** — once segmented, do capability protocols get independent version markers / a capability-discovery method (`getCapabilities()`)?
4. **Order vs ADR-0076 Step 2** — segment the contract first (incremental) and let Step 2 + rename follow, or do all in one coordinated PR set? (Leaning: contract first, packaging at the window.)
