# ObjectStack - Road Map

> **Last Updated:** 2026-04-26
> **Authoritative Spec:** [content/docs/concepts/north-star.mdx](content/docs/concepts/north-star.mdx) - §7 Alignment Check is the single source of truth for Built / Drift / Missing.
> This file is the **actionable checklist** derived from that ledger. When north-star §7 changes, update this file too.

---

## How to Read This File

| Symbol | Meaning |
|:---:|:---|
| ✅ | Shipped - code exists and is integrated |
| 🟡 | Partial / Drift - exists but wrong shape, needs evolution |
| 🔴 | Not started |
| ⛔ | Explicit non-goal - do not implement in Phase 1 |

Phase 1 is **code-first ObjectStack**:

- The local TypeScript workspace is the only user-metadata authoring surface.
- `objectstack compile` produces JSON.
- `objectstack publish` uploads that JSON to the control plane.
- Studio is a control-plane dashboard, metadata viewer, artifact inspector, and observability surface.
- ObjectOS pulls artifacts through HTTP and never reads control-plane DB tables directly.

The implementation path is therefore:

```
Artifact format -> control-plane metadata -> Artifact API -> ObjectOS loader -> publish endpoint -> Studio viewer
```

---

## ✅ Built (Aligned)

Code that exists and matches the intended architecture. Do not regress these.

| What | Code anchor |
|:---|:---|
| Organization CRUD + member/invitation system | [apps/studio/src/hooks/useSession.ts](apps/studio/src/hooks/useSession.ts) |
| Project CRUD + per-project Turso/memory DB provisioning | [packages/services/service-tenant/](packages/services/service-tenant/) |
| Per-project ObjectKernel with LRU cache | [packages/runtime/src/project-kernel-factory.ts](packages/runtime/src/project-kernel-factory.ts) |
| Hostname-based routing: `sys_project.hostname` -> kernel resolution | [packages/runtime/src/environment-registry.ts](packages/runtime/src/environment-registry.ts) |
| `ControlPlaneProxyDriver` - org-scoped data isolation | [packages/runtime/src/control-plane-proxy-driver.ts](packages/runtime/src/control-plane-proxy-driver.ts) |
| `AppCatalogService` - per-project app events -> org-scoped `sys_app` catalog | [packages/services/service-tenant/src/services/app-catalog.service.ts](packages/services/service-tenant/src/services/app-catalog.service.ts) |
| TS -> JSON compile pipeline (`objectstack compile`) | [packages/cli/src/commands/compile.ts](packages/cli/src/commands/compile.ts) |
| Zod -> JSON Schema publishing (`z.toJSONSchema`) - TS/JSON bridge | [packages/spec/scripts/build-schemas.ts](packages/spec/scripts/build-schemas.ts) |
| Scaffolded TS file tree (`create-objectstack` -> `defineStack()` + split `src/objects/*.ts`) | [packages/create-objectstack/src/index.ts](packages/create-objectstack/src/index.ts) |
| JSON-payload metadata column (`sys_metadata.metadata` textarea) | [packages/metadata/src/objects/sys-metadata.object.ts](packages/metadata/src/objects/sys-metadata.object.ts) |
| CLI `publish` - local JSON -> remote server wire (endpoint shape still wrong, see D2) | [packages/cli/src/commands/publish.ts](packages/cli/src/commands/publish.ts) |

---

## 🟡 Drift (Needs Cleanup)

Existing code that contradicts the intended Phase 1 architecture. Fix these before building new surface area that depends on them.

### D1 - 🟡 MetadataPlugin maintains a DB bridge in ObjectOS (Biggest Drift)

**Priority: P0.** The primary startup read has been partially fixed — `local-file` mode (M1.x) lets ObjectOS boot from `dist/objectstack.json` without touching any database. However, [packages/metadata/src/plugin.ts](packages/metadata/src/plugin.ts) still:

1. Registers `SysMetadataObject` and `SysMetadataHistoryObject` into the **ObjectOS** manifest — these tables belong only in `apps/cloud` (control plane).
2. Bridges ObjectQL to a `DatabaseLoader` via `setDataEngine()` after startup — subsequent `metadata.register()` writes persist metadata to `sys_metadata` in the project DB, and `metadata.list()` / `get()` aggregate from it.

Under Phase 1 the project DB contains **business rows only**. Metadata lives in the control plane and is delivered to ObjectOS as an immutable artifact. The DB bridge breaks that boundary and undermines the `commitId` + `checksum` immutability guarantee — `sys_metadata` rows in the project DB may diverge from the published artifact.

**What is already done:**
- `local-file` artifact mode — ObjectOS boots from `dist/objectstack.json` without any DB read (M1.x). ✅

**Remaining fix path:**
1. Remove `SysMetadataObject` / `SysMetadataHistoryObject` registration from `MetadataPlugin.init()` — these tables belong in `apps/cloud` only.
2. Remove the `setDataEngine()` / `DatabaseLoader` bridge from `MetadataPlugin.start()` — ObjectOS metadata is read-only (artifact → kernel); history and versioning are control-plane concerns.
3. Implement the Artifact API endpoint (M3) and swap `MetadataPlugin`'s source to HTTP fetch (M4).
4. Confirm `sys_metadata` is absent from the project DB schema after the D8 split into `apps/cloud` + `apps/server`.

**Depends on:** M3, M4. **Prerequisite for:** D8 clean split.

### D2 - `objectstack publish` uses legacy `/api/v1/packages` endpoint

[packages/cli/src/commands/publish.ts](packages/cli/src/commands/publish.ts) POSTs a "package" payload that is not the Phase 1 project metadata endpoint.

**Required evolution:**
- Endpoint: `POST /api/v1/cloud/projects/:projectId/metadata`
- Payload: compiled `dist/objectstack.json` (output of `objectstack compile`)
- Server behavior: validate with Zod, write current project metadata state, create `commitId`, compute checksum
- Response: `{ projectId, commitId, checksum }`

### D3 - Remove `env_id` from metadata storage

**Decision (2026-04-25): delete, don't repurpose.** Phase 1 metadata is scoped by `organization_id` + `project_id`. Deployment target differences are runtime/deployment configuration, not metadata row partitioning. Branch-like variants are explicitly deferred.

**Fix path:**
1. Add/control-plane metadata ownership columns: `organization_id` + `project_id`.
2. Backfill existing rows to the owning organization/project.
3. Delete `env_id` column and all references.
4. Update unique indexes from environment-scoped keys to project-scoped keys.

Known anchors to scrub:
- [packages/metadata/src/objects/sys-metadata.object.ts](packages/metadata/src/objects/sys-metadata.object.ts)
- [packages/metadata/src/objects/sys-metadata-history.object.ts](packages/metadata/src/objects/sys-metadata-history.object.ts)
- [packages/metadata/src/loaders/database-loader.ts](packages/metadata/src/loaders/database-loader.ts)
- [packages/metadata/src/projection/metadata-projector.ts](packages/metadata/src/projection/metadata-projector.ts)
- [packages/metadata/src/utils/history-cleanup.ts](packages/metadata/src/utils/history-cleanup.ts)
- [packages/objectql/src/plugin.ts](packages/objectql/src/plugin.ts)
- [packages/objectql/src/protocol.ts](packages/objectql/src/protocol.ts)
- [packages/client/src/index.ts](packages/client/src/index.ts)

### D4 - `namespace` residue

Deprecated in favor of embedding prefix in object `name`, but leftovers remain. Identity must be single-sourced on `name`.

### D5 - Plugin `scope` enum bloat

Grew to 5 values (`cloud` / `system` / `project` / `platform` / `environment`) with the last two marked as deprecated aliases. Break cleanly; do not carry aliases forward.

### D6 - Half-wired abstractions

`ScopedServiceManager` and `SharedProjectPlugin` were added but their integration into the request path is incomplete. Either finish them or remove them.

### D7 - Plugin-config churn

Commit `a4f5eb51`: large reorganization moving object registration between files without obvious feature value. Should converge on one canonical home.

### D8 - `apps/server` is a hybrid (Control Plane + ObjectOS in one process)

[apps/server/objectstack.config.ts](apps/server/objectstack.config.ts) currently registers control-plane and ObjectOS concerns on the same `ObjectKernel`. North-star §5 names these as two separate vertices; implementation should follow.

**Decision:** split into **`apps/cloud`** (Control Plane Server) and **`apps/server`** (ObjectOS Runtime). Both are ObjectStack-framework apps booted from their own `objectstack.config.ts`. They share the same `ObjectKernel`, spec, and adapter stack. They differ only in their plugin manifest.

**Plugin partition:**

| Plugin | `apps/cloud` (Control Plane) | `apps/server` (ObjectOS) |
|:---|:---:|:---:|
| `createControlPlanePlugins(...)` (ObjectQL on control DB + driver + system-project + sys_* metadata) | Yes | - |
| `MultiProjectPlugin` (`env-registry`, `kernel-manager`, `template-seeder`) | Yes | - |
| `AuthPlugin` | Yes | Yes |
| `createTenantPlugin(...)` | Yes | Yes |
| `SecurityPlugin` | Yes | Yes |
| `AuditPlugin` | Yes | Yes |
| `SetupPlugin` (Studio bootstrap) | Yes (optional) | - |
| `ObjectQLPlugin` (project-scoped) | - | Yes |
| `MetadataPlugin` (artifact-loader mode - see M4) | - | Yes |
| User-app `AppPlugin` (compiled app) | - | Yes |

**Fix path:**
1. Create `apps/cloud/` with its own `objectstack.config.ts` carrying the Control Plane manifest above.
2. Strip control-plane plugins out of [apps/server/objectstack.config.ts](apps/server/objectstack.config.ts); reduce it to the ObjectOS manifest.
3. Decide deployment topology (separate Vercel projects vs. one repo / two entrypoints).

**Depends on:** M3, M4. Until ObjectOS can boot from Artifact API, `apps/server` cannot run standalone.

---

## 🔴 Missing (Not Started)

Ordered by dependency. Items higher in the list unblock those below them.

### M1 - Artifact format v0

- [ ] Add a Zod schema for the artifact envelope.
- [ ] Minimum envelope: `schemaVersion`, `projectId`, `commitId`, `checksum`, `metadata`, `functions`, `manifest`.
- [ ] Specify function-code packaging and plugin/driver requirement declaration.
- [ ] Decide which fields are required now and which are reserved for future S3 indirection.

**Prerequisite for:** M3, M4.

### M1.x - Runtime Inputs 边界化

明确 ObjectOS 启动输入 = **Artifact**（不可变、可缓存的元数据信封）+ **Deployment Config**（业务 DB 坐标、凭据、项目身份、密钥；不进 artifact）。详见 [north-star.mdx §6.3](content/docs/concepts/north-star.mdx)。

- [x] north-star.mdx §6.3 增补 Runtime Inputs 节（含本地单 project env 表 + 反模式说明）
- [x] 实现本地 single / multi-project env 路径：`OBJECTSTACK_MULTI_PROJECT` / `OBJECTSTACK_PROJECT_ID` / `OBJECTSTACK_DATABASE_URL` / `OBJECTSTACK_DATABASE_DRIVER` / `OBJECTSTACK_ARTIFACT_PATH`（默认 `./dist/objectstack.json`）/ `AUTH_SECRET`
- [x] 修复 Drift：`ProjectKernelFactory` 不再直连控制面 DB 读 `sys_project` / `sys_project_credential`，改走 Artifact API + Deployment Config 注入（`localProject` 分支）
- [x] [apps/server/objectstack.config.ts](apps/server/objectstack.config.ts) 的 env 命名收敛到 `OBJECTSTACK_*` 前缀，`isLocalMode` 分流本地/云端路径

**Resolves:** Open Question §9.2（已解决）+ 新增 Drift（`ProjectKernelFactory` 绕过 Artifact API）。

### M2 - Metadata migration to control plane

- [ ] Move user metadata out of project DBs into the control-plane DB.
- [ ] Scope metadata rows by `organization_id` + `project_id`.
- [ ] Add or update unique keys for `project_id` + metadata `type` + metadata `name`.
- [ ] Data migration script for existing installations.
- [ ] Keep project DBs for business rows only.

**Prerequisite for:** M3, D1 fix, D3.

### M3 - Project Artifact API endpoint

- [ ] `GET /api/v1/cloud/projects/:projectId/artifact` - assembles the current project's metadata + inlined function code into a single consumable blob.
- [ ] Validate the outgoing artifact with the M1 Zod schema.
- [ ] Content hash / ETag for cache validation.
- [ ] Response includes `commitId` and `checksum`.
- [ ] Reserve response shape for future `{ url, expiresAt, checksum }` indirection, but do not build S3 yet.

**Prerequisite for:** M4, D1 fix.

### M4 - ObjectOS artifact loader

- [ ] Swap `MetadataPlugin` data source: project-DB reads -> HTTP fetch against Artifact API.
- [ ] Validate artifact with Zod before hydrating kernel.
- [ ] Local artifact cache with durability across control-plane outages.
- [ ] Cache key by `projectId` + `commitId`/`checksum`.

**Resolves:** D1.

### M5 - Project publish endpoint

- [ ] `POST /api/v1/cloud/projects/:projectId/metadata` - receives compiled JSON.
- [ ] Validates payload with `ObjectStackDefinitionSchema` or the canonical compiled stack schema.
- [ ] Writes current project metadata state to control-plane storage.
- [ ] Creates `commitId`, computes checksum, and returns `{ projectId, commitId, checksum }`.
- [ ] Evolves [packages/cli/src/commands/publish.ts](packages/cli/src/commands/publish.ts) to call this endpoint.

**Resolves:** D2.

### M6 - Studio metadata/artifact viewer

- [ ] Project metadata browser for Objects / Fields / Functions / Views / Flows / Agents.
- [ ] Artifact inspector: schema version, commit id, checksum, publish time, payload preview.
- [ ] Publish history list.
- [ ] Runtime health/logs panels.
- [ ] Explicitly read-only for user metadata.

### M7 - `objectstack dev` offline boot path

- [ ] `from-local-file` kernel boot mode: ObjectOS reads `dist/objectstack.json` (or in-memory TS definition) and runs without a control-plane connection.
- [ ] Wire as a distinct boot mode; does not pollute the production `from-artifact-api` path.
- [ ] `objectstack dev` CLI command triggers this mode.

**Open question:** should `dev` consume TS directly (hot reload friendly) or compile-first (production-path parity)?

### M8 - UI auto-generation

- [ ] Artifact schemas -> Amis/React components without hand-wiring.

---

## ⛔ Explicit Non-Goals (Phase 1)

| Item | Reason |
|:---|:---|
| Branch / `sys_branch` / `branch_id` | Deferred. Phase 1 has one current metadata state per project. |
| Branch hostnames, branch diff, branch merge | Deferred with the branch model. |
| Studio metadata editing | Deferred. Studio is read-only for user metadata in Phase 1. |
| Bidirectional CLI ↔ Studio write model | Deferred. Local TS workspace is the only metadata authoring surface in Phase 1. |
| `objectstack pull` JSON -> TS emitter | Deferred until there is a control-plane writer that can change metadata outside local TS. |
| Merge/conflict UX | Deferred. `commitId` identifies revisions and artifacts, not collaborative merge state. |
| Versioning / Release / Tag entity | Deferred. Freezing current metadata into immutable releases comes later. |
| S3 artifact backend | Deferred. Artifact API response shape should allow it later, but backend is control-plane DB now. |

---

## Future Phases

These are intentionally outside Phase 1 but should remain compatible with the Phase 1 model.

### Phase 2 - Studio authoring

- Add visual metadata editors in Studio.
- Route every Studio save through a control-plane metadata write API.
- Introduce optimistic concurrency for CLI ↔ Studio writes.
- Decide whether `objectstack pull` generates canonical TS or attempts source-preserving round trips.

### Phase 3 - Branching and collaboration

- Add `sys_branch` and `branch_id`.
- Migrate the Phase 1 current project metadata state to default branch `main`.
- Evolve partition key from `(organization_id, project_id)` to `(organization_id, project_id, branch_id)`.
- Add branch hostnames, branch diff, branch merge, and conflict UX.

### Phase 4 - Releases and artifact storage

- Add Release / Tag entity.
- Freeze project or branch states into immutable artifacts.
- Add rollback UI.
- Swap Artifact API backend to S3/signed URL where useful.

---

## Dependency Graph (Reading Order for Implementation)

```
M1 Artifact format v0
├── M1.x Runtime Inputs 边界化 (Artifact + Deployment Config 分离)
└── M2 Metadata migration to control plane
    ├── M3 Project Artifact API
    │   └── M4 ObjectOS artifact loader -> resolves D1
    └── M5 Project publish endpoint -> resolves D2
        └── M6 Studio metadata/artifact viewer

M7 objectstack dev offline boot  (parallel after M1)
M8 UI auto-generation            (long tail after artifact schema stabilizes)
D3 remove env_id                 (after M2 ownership columns exist)
D8 split apps/cloud + apps/server(after M3/M4 make ObjectOS standalone)
```

---

## Related Documents

| Document | Role |
|:---|:---|
| [content/docs/concepts/north-star.mdx](content/docs/concepts/north-star.mdx) | Authoritative spec - §1 tenets, §3 surfaces, §5 architecture, §7 ledger, §9 open questions |
| [CLAUDE.md](CLAUDE.md) | Dev conventions - Zod-first, naming, kernel standards |
| [.github/copilot-instructions.md](.github/copilot-instructions.md) | Mirror of CLAUDE.md for Copilot |
| [packages/cli/src/commands/compile.ts](packages/cli/src/commands/compile.ts) | TS -> JSON compile (Built anchor) |
| [packages/cli/src/commands/publish.ts](packages/cli/src/commands/publish.ts) | Publish command (Drift D2 target) |
| [packages/metadata/src/plugin.ts](packages/metadata/src/plugin.ts) | MetadataPlugin (Drift D1 target) |
