# ObjectStack — Road Map

> **Last Updated:** 2026-04-25
> **Authoritative Spec:** [content/docs/concepts/north-star.mdx](content/docs/concepts/north-star.mdx) — §7 Alignment Check is the single source of truth for Built / Drift / Missing.  
> This file is the **actionable checklist** derived from that ledger. When north-star §7 changes, update this file too.

---

## How to Read This File

| Symbol | Meaning |
|:---:|:---|
| ✅ | Shipped — code exists and is integrated |
| 🟡 | Partial / Drift — exists but wrong shape, needs evolution |
| 🔴 | Not started |
| ⛔ | Explicit non-goal — do not implement |

The three sections map 1:1 to north-star §7:

- **Built** — preserve; don't break
- **Drift** — largest architectural risk; fix before adding new surface area
- **Missing** — ordered by dependency (a later item often requires an earlier one)

---

## ✅ Built (Aligned)

Code that exists and matches the intended architecture. Do not regress these.

| What | Code anchor |
|:---|:---|
| Organization CRUD + member/invitation system | [apps/studio/src/hooks/useSession.ts](apps/studio/src/hooks/useSession.ts) |
| Project CRUD + per-project Turso/memory DB provisioning | [packages/services/service-tenant/](packages/services/service-tenant/) |
| Per-project ObjectKernel with LRU cache | [packages/runtime/src/project-kernel-factory.ts](packages/runtime/src/project-kernel-factory.ts) |
| Hostname-based routing: `sys_project.hostname` → kernel resolution | [packages/runtime/src/environment-registry.ts](packages/runtime/src/environment-registry.ts) |
| `ControlPlaneProxyDriver` — org-scoped data isolation | [packages/runtime/src/control-plane-proxy-driver.ts](packages/runtime/src/control-plane-proxy-driver.ts) |
| `AppCatalogService` — per-project app events → org-scoped `sys_app` catalog | [packages/services/service-tenant/src/services/app-catalog.service.ts](packages/services/service-tenant/src/services/app-catalog.service.ts) |
| TS → JSON compile pipeline (`objectstack compile`) | [packages/cli/src/commands/compile.ts:22](packages/cli/src/commands/compile.ts) |
| Zod → JSON Schema publishing (`z.toJSONSchema`) — TS/JSON bridge | [packages/spec/scripts/build-schemas.ts:188](packages/spec/scripts/build-schemas.ts) |
| Scaffolded TS file tree (`create-objectstack` → `defineStack()` + split `src/objects/*.ts`) | [packages/create-objectstack/src/index.ts:27](packages/create-objectstack/src/index.ts) |
| JSON-payload metadata column (`sys_metadata.metadata` textarea) | [packages/metadata/src/objects/sys-metadata.object.ts:91-95](packages/metadata/src/objects/sys-metadata.object.ts) |
| CLI `publish` — local JSON → remote server wire (endpoint shape still wrong, see Drift) | [packages/cli/src/commands/publish.ts](packages/cli/src/commands/publish.ts) |

---

## 🟡 Drift (Needs Cleanup)

Existing code that contradicts the intended architecture. Fix these before building new Missing items that depend on them — otherwise you compound the debt.

### D1 — 🔴 MetadataPlugin reads from project DB (Biggest Drift)

**Priority: P0.** Today [packages/metadata/src/plugin.ts](packages/metadata/src/plugin.ts) reads `sys_metadata` rows from each project's own database. Under the new model, metadata is centralized in the control plane and delivered to the runtime via the Artifact API. The project DB should contain **business rows only**. This is the single largest architectural drift.

**Fix path:**
1. Implement the Artifact API endpoint (see Missing M3).
2. Swap `MetadataPlugin`'s data source from project-DB reads to HTTP fetch against the Artifact API.
3. Remove the `sys_metadata` table from the project DB schema.

### D2 — `env_id` semantics blurred with branch

`env_id` was introduced as a branch-like scoping column on metadata rows in the project DB. Under the new model, branch scoping lives on control-plane metadata tables via a dedicated `branch_id`. `env_id` must be repurposed (e.g. "deployment environment" ≠ branch) or removed — not left ambiguous.

### D3 — `namespace` residue

Deprecated in favor of embedding prefix in object `name`, but leftovers remain. Identity must be single-sourced on `name`.

### D4 — Plugin `scope` enum bloat

Grew to 5 values (`cloud` / `system` / `project` / `platform` / `environment`) with the last two marked as deprecated aliases. Break cleanly; do not carry aliases forward.

### D5 — Half-wired abstractions

`ScopedServiceManager` and `SharedProjectPlugin` were added but their integration into the request path is incomplete. Either finish them or remove them.

### D6 — Plugin-config churn

Commit `a4f5eb51`: large reorganization moving object registration between files without obvious feature value. Should converge on one canonical home.

### D7 — `objectstack publish` uses legacy `/api/v1/packages` endpoint

[packages/cli/src/commands/publish.ts](packages/cli/src/commands/publish.ts) POSTs a "package" payload that is neither project-scoped nor branch-scoped — a residue of the pre-Branch "one project, one package" model.

**Required evolution:**
- Endpoint: `POST /api/v1/apps/:projectId/branches/:branchId/metadata`
- Payload: compiled `dist/objectstack.json` (output of `objectstack compile`)
- Header: `X-Commit-Id: <parent_commit_id>` for optimistic concurrency
- Response: `409 Conflict` if branch has advanced past `parent_commit_id`; writer must pull and retry

---

## 🔴 Missing (Not Started)

Ordered by dependency — items higher in the list unblock those below them.

### M1 — `sys_branch` entity in the control plane

- [ ] `sys_branch` table: `id`, `project_id`, `name`, `commit_id`, `created_at`
- [ ] Auto-create `main` branch when a project is created
- [ ] Branch CRUD REST API
- [ ] `branch_id` foreign key column on every control-plane metadata table

**Prerequisite for:** M2, M3, M4, M5, M7, M8, M10, M11.

### M2 — Metadata migration to control plane

- [ ] Move all user-metadata tables out of the project DB into the control-plane DB, scoped by `project_id` + `branch_id`
- [ ] Data migration script for existing installations

**Prerequisite for:** M3, D1 fix.

### M3 — Artifact API endpoint

- [ ] `GET /api/v1/apps/:projectId/artifact?branch=<name>` — assembles a branch's metadata + inlined function code into a single consumable blob
- [ ] Content hash / ETag for cache validation
- [ ] Specify artifact format: JSON document vs tarball+manifest (Open Question north-star §9.6)

**Prerequisite for:** M4 (ObjectOS artifact loader), D1 fix.

### M4 — ObjectOS artifact loader

- [ ] Swap `MetadataPlugin` data source: project-DB reads → HTTP fetch against Artifact API (resolves D1)
- [ ] Local artifact cache with durability across control-plane outages

### M5 — `commit_id` optimistic concurrency machinery

- [ ] `commit_id` column on `sys_branch` (or a separate `sys_branch_commit` ledger)
- [ ] Server-side check on every metadata write: reject with `409` if branch `commit_id` doesn't match caller's parent
- [ ] CLI flow: carry `commit_id` in `objectstack publish`; on `409`, prompt user to `objectstack pull` then retry
- [ ] Studio flow: carry `commit_id` on every save; on `409`, show re-sync prompt

**Prerequisite for:** safe bidirectional CLI ↔ Studio writes (north-star §3 Conflict model).

### M6 — Per-branch push endpoint (control-plane side)

- [ ] `POST /api/v1/apps/:projectId/branches/:branchId/metadata` — receives compiled JSON, validates with Zod schema, checks `commit_id`, writes to `sys_metadata` scoped by `(project_id, branch_id)`
- [ ] Returns new `commit_id` on success
- [ ] Evolves the CLI `publish` command to call this endpoint (resolves D7)

**Depends on:** M1, M2, M5.

### M7 — `objectstack dev` offline boot path

- [ ] `from-local-file` kernel boot mode: ObjectOS reads `dist/objectstack.json` (or in-memory TS definition) and runs without a control-plane connection
- [ ] Wire as a distinct boot mode; does not pollute the production `from-artifact-api` path
- [ ] `objectstack dev` CLI command triggers this mode

**Note:** Open Question north-star §9.11 — should `dev` consume TS directly (hot reload friendly) or compile-first (production-path parity)?

### M8 — Studio branch management UI

- [ ] Branch list, create, switch in the Studio dashboard
- [ ] Branch diff view (compare two branches' metadata)
- [ ] Merge flow (depends on conflict resolution strategy — north-star §9.7/§9.9)

**Depends on:** M1, M5.

### M9 — `objectstack pull`

- [ ] `GET /api/v1/apps/:projectId/branches/:branchId/metadata` — returns JSON snapshot of branch state
- [ ] JSON → TS codegen: reverse-hydrate branch state back into a local TS file tree (`defineStack()` + split objects/views files)
- [ ] Round-trip fidelity constraints (Open Question north-star §9.10): features that cannot survive serialization (computed expressions, helper imports, generics) must be documented/disallowed at Zod layer

### M10 — Compile-to-App pipeline specification

- [ ] Exact artifact format spec: JSON document structure, function-code packaging, driver/plugin requirement declaration
- [ ] Zod schema for the artifact envelope itself (so runtimes can validate before loading)

**Prerequisite for:** M3 (Artifact API implementation).

### M11 — Studio Publish UI

- [ ] Publish button → triggers artifact build + sets branch `commit_id` as "serving"
- [ ] Artifact browser (view past publish states)
- [ ] Rollback flow

**Depends on:** M1, M3, M5. Blocked on Versioning / Release entity (see ⛔ below).

### M12 — UI auto-generation

- [ ] Artifact schemas → Amis/React components without hand-wiring

---

## ⛔ Explicit Non-Goals (This Round)

| Item | Reason |
|:---|:---|
| Versioning / Release / Tag entity | Deferred. "Publish" currently means "mark branch state as serving"; freeze/tag semantics come with the Release entity in a future round. |
| JSON → TS codegen for `objectstack pull` emitter | Non-trivial. Listed in M9 but design blocked on round-trip fidelity Open Question. |
| CLI ↔ Studio merge conflict algorithm | `commit_id` gets the 409 detection in place; merge strategy deferred (north-star §9.9). |

---

## Dependency Graph (reading order for implementation)

```
M1 sys_branch
├── M2 Metadata migration to control plane
│   └── M3 Artifact API endpoint
│       └── M4 ObjectOS artifact loader → resolves D1
├── M5 commit_id concurrency
│   ├── M6 Per-branch push endpoint → resolves D7
│   └── M8 Studio branch management UI
├── M9 objectstack pull (parallel, depends on M3 for server side)
└── M10 Artifact format spec → feeds M3

M7 objectstack dev offline boot  (independent, can start now)
M12 UI auto-generation           (independent, long tail)
```

---

## Related Documents

| Document | Role |
|:---|:---|
| [content/docs/concepts/north-star.mdx](content/docs/concepts/north-star.mdx) | Authoritative spec — §1 tenets, §3 surfaces, §5 architecture, §7 ledger, §9 open questions |
| [CLAUDE.md](CLAUDE.md) | Dev conventions — Zod-first, naming, kernel standards |
| [.github/copilot-instructions.md](.github/copilot-instructions.md) | Mirror of CLAUDE.md for Copilot |
| [packages/cli/src/commands/compile.ts](packages/cli/src/commands/compile.ts) | TS → JSON compile (Built M-anchor) |
| [packages/cli/src/commands/publish.ts](packages/cli/src/commands/publish.ts) | Publish command (Drift D7 target) |
| [packages/metadata/src/plugin.ts](packages/metadata/src/plugin.ts) | MetadataPlugin (Drift D1 target) |
