# ADR-0005: Metadata Customization Overlay (Artifact + sys_metadata Delta)

> **v5.0 update (2026):** Throughout this document, the term *project* has been renamed to *environment* (no aliases; CLI flags, URL paths, schemas, env vars all hard-renamed). See ADR-0006 for the rationale and `.changeset/v5-project-to-environment-rename.md` for the breaking-change list. The body below is preserved verbatim for historical context.


**Status**: Accepted (2026-05-16) · **Amended** (2026-05-22, see "Amendment: post-ADR-0006 v4 scope") · **Amended** (2026-04-13, branch concept removed — see [ADR-0008 §0](./0008-metadata-repository-and-change-log.md#0-2026-04-13-amendment--drop-project-and-branch-from-metaref))
**Deciders**: ObjectStack Protocol Architects
**Builds on**: [ADR-0003](./0003-package-as-first-class-citizen.md) (Package as first-class citizen), [ADR-0004](./0004-cloud-multi-kernel.md) (Cloud + per-project kernels)
**Amended by**: [ADR-0006 v4](./0006-project-environment-split.v4.md) (drops `sys_project` entirely), [ADR-0008](./0008-metadata-repository-and-change-log.md) (re-expresses overlay as `LayeredRepository`; subsequently drops `project`/`branch` from `MetaRef`)
**Consumers**: `@objectstack/objectql`, `@objectstack/runtime`, `@objectstack/rest`, `apps/studio`, all customer-facing tenants

> **2026-04-13 note** — overlays are keyed exclusively by `organization_id`.
> The `sys_metadata` table's legacy `project_id` / `branch` columns are
> ignored by `SysMetadataRepository` and will be dropped in a future major.

---

## Amendment: post-ADR-0006 v4 scope (2026-05-22)

ADR-0006 v4 **dropped the `sys_project` table** and the dev-workspace
Project concept entirely. As a consequence:

- **`project_id` is no longer an overlay scope key.** The remaining
  scope keys are `organization_id` and (when ADR-0008 M1 lands)
  `branch`. The column physically named `project_id` on `sys_metadata`
  is treated as a legacy alias and will be renamed/dropped in the
  ADR-0008 PR-10 migration.
- All references to `this.projectId` in `packages/objectql/src/protocol.ts`
  are deprecated. New code must consult `organization_id` (and, in M1,
  the branch ref) only.
- The `(type, name, project_id)` UNIQUE index is superseded by
  `(type, name, organization_id)` (already in place since the
  2026-05-19 hotfix) and will become `(type, name, organization_id, branch)`
  in ADR-0008 M1.
- "Per-project overlay" is no longer a coherent concept — it was a
  Phase-1 transitional model. The supported scopes are
  **platform-global** (no overlay row) and **per-organization**.

### Tenant-customizable type whitelist (shared-DB tenancy invariant)

In **shared-DB multi-tenant** deployments (one physical database, many
`organization_id`s on the same tables), only the metadata types whose
runtime semantics are **render-time** can be overridden per
organization. Anything that influences the **physical schema, persisted
contract, or automation guarantees** must be platform-global.

The authoritative whitelist lives on `MetadataTypeRegistryEntry.allowOrgOverride`
in [`packages/spec/src/kernel/metadata-plugin.zod.ts`](../../packages/spec/src/kernel/metadata-plugin.zod.ts).
The runtime validator (`OVERLAY_ALLOWED_TYPES` in `objectql/src/protocol.ts`)
derives its set from that flag — there is no parallel allowlist
(Prime Directive #8). Current invariants:

| Domain | Type | Per-org override? | Why |
|:---|:---|:---:|:---|
| data | `object`, `field` | ❌ | A per-org overlay would diverge the table schema; shared DB cannot honour that. |
| data | `validation`, `hook` | ❌ | DB-side contracts. Per-org variants must ship as a separate package, not an overlay. (`trigger` retired as a kind — ADR-0088.) |
| automation | `flow`, `workflow`, `approval` | ❌ | Carry execution side-effects (events, jobs, audit). Per-org variants are a deployment, not an overlay. |
| security | `permission`, `profile`, `role` | ❌ | Authorization correctness; overlays would create silent privilege drift. |
| system | `datasource` | ❌ | Wiring level; changes require code paths, not metadata. (`router`/`function`/`service` retired as kinds — ADR-0088; they are code contributions.) |
| ai | `agent`, `tool`, `skill` | ❌ | Behavioural contracts with model providers; treat like flows. |
| **ui** | **`view`, `dashboard`, `report`** | ✅ | **Pure presentation. Safe per-org override.** |
| ui | `page`, `app`, `action` | ❌ | Conservative default — these bind to routes and side-effects. Promote individually if a concrete need appears. |
| system | `email_template`, `translation` | ✅ / `translation` is global today | Render-time / pure-content. |

Adding a type to the allowlist requires (a) a Zod-validated overlay
schema (`resolveOverlaySchema()` must accept it) and (b) a written
rationale that the overlay is render-only with no DB/automation/security
side-effects. The default for any new metadata type is **`allowOrgOverride: false`**.

Everything below this block reflects the pre-amendment design and is
retained for historical traceability. Where it says `project_id`,
read `organization_id` (or, in built-in metadata contexts, "no scope key").

## Context

Studio ships an in-browser editor for views and dashboards. Customers expect "Save" to persist.
Until today, the runtime did not:

1. `PUT /api/v1/meta/view/<name>` in **project-kernel mode** updated only the in-memory registry and returned `200 { success: true, message: "Saved to memory registry (project kernel — sys_metadata is control-plane only)" }`. The change vanished on restart.
2. `GET /api/v1/meta/view/<name>` skipped `sys_metadata` entirely in project-kernel mode (`packages/objectql/src/protocol.ts:357`, `:369`).
3. `loadMetaFromDb()` returned `{ loaded: 0 }` early in project-kernel mode (`:1230`), so even if rows existed they would never be hydrated.

Worse, a separate detour — Studio's "Duplicate View" calls `POST /api/v1/data/sys_view` — wrote rows to a **physical projection table** (`sys_view`, 21 flat columns) that has nothing to do with the metadata protocol path. The same applies to `sys_flow`, `sys_agent`, `sys_tool`, `sys_object`. Each of these tables duplicates a Zod schema already defined in `@objectstack/spec` (`ui/view.zod.ts`, `automation/flow.zod.ts`, etc.) and goes out of sync the moment the spec evolves.

Three different things were tangled into one place:

| concern | wrong home | right home |
|---|---|---|
| view edit-form contract | hand-written 21 fields in `sys-view.object.ts` | Zod `ViewSchema` in `@objectstack/spec` |
| out-of-box view storage | "supposed to be" `sys_view` (but was only in-memory) | compiled artifact `dist/objectstack.json` → `SchemaRegistry` |
| customer overlay storage | not implemented (silent loss) | `sys_metadata` row, scoped by `project_id` |

## Decision

**Three layers, three sources of truth. No physical projection tables.**

```
 COMPILE TIME
   defineStack(...) ──bundle──► dist/objectstack.json         (immutable; full metadata)

 BOOT
   artifact ──load──► SchemaRegistry / MetadataService        (in-memory; out-of-box defaults)
   sys_metadata customizations ──load via loadMetaFromDb──► overlay (per project)

 RUNTIME READ   getMetaItem(type, name)
   1. sys_metadata WHERE (type, name, project_id, state='active')         ← overlay (wins)
   2. SchemaRegistry / MetadataService                                    ← artifact default

 RUNTIME WRITE  PUT  /api/v1/meta/{type}/{name}                           ← whitelist: view, dashboard
   - upsert sys_metadata (full JSON in `metadata` column, `scope='project'`)
   - update SchemaRegistry + MetadataService for immediate read
   - history snapshot via sys_metadata trackHistory

 RUNTIME RESET  DELETE /api/v1/meta/{type}/{name}
   - delete sys_metadata row     → next read falls through to artifact
   - registry refresh from MetadataService for immediate effect
```

### Design principles (binding)

1. **One Zod schema per metadata type.** Every metadata type (`view`, `dashboard`, `flow`, `agent`, `tool`, `object`, `report`, `skill`, `rag-pipeline`, `action`, ...) has exactly one definition source: the Zod schema in `@objectstack/spec`. **No mirrored `*.object.ts` is permitted in `packages/platform-objects/src/metadata/`.**
2. **Artifact is immutable at runtime.** Out-of-box defaults always come from the compiled artifact, never written back to.
3. **Customizations are full-JSON deltas, not field-level patches.** Phase 1 stores the entire item document. A finer-grained patch model (RFC 7396, 3-way merge) is out of scope — `MetadataOverlaySchema` in `metadata-customization.zod.ts` already specifies it; we keep that model available for future phases but do **not** implement merge yet.
4. **Forms render from Zod, not from physical tables.** Studio's view/dashboard editors generate their forms from `@objectstack/spec` Zod schemas through `z.toJSONSchema()`. Forms never reflect a `*.object.ts` shape.
5. **Whitelist by type.** Only types explicitly enabled for overlay can be saved through `PUT /api/v1/meta/*`. Phase 1 ships with `view` and `dashboard` enabled; other types return `400 customization_not_allowed`.

### Storage shape

`sys_metadata` schema (`packages/platform-objects/src/metadata/sys-metadata.object.ts`) is the storage substrate. No schema changes needed in Phase 1:

| column | role |
|---|---|
| `id` | UUID |
| `type` | metadata type (e.g. `view`, `dashboard`) |
| `name` | item name (snake_case) |
| `project_id` | scope key — `NULL` for platform-global, set for per-project overlays |
| `scope` | label `'project'` or `'platform'` (cosmetic; project_id is authoritative) |
| `metadata` | **full JSON document** (entire view/dashboard payload) |
| `state` | `'active'` (or `'archived'` for soft-delete) |
| `version` | monotonic counter for optimistic concurrency |
| `created_at` / `updated_at` | audit timestamps |

The existing unique index `(type, name, project_id)` already enforces "one customization per item per project". Multi-tenant (per-organization) refinement is **Phase 2** — see Open Questions.

### Read order

`getMetaItem` is rewritten to query in this order:

1. `sys_metadata` overlay row (`project_id = this.projectId ?? null`).
2. In-memory `SchemaRegistry` (control-plane kernels only — project kernels skip because the registry is process-global).
3. `MetadataService` (artifact source on project kernels; runtime-registered items on control plane).

### Whitelist enforcement

Implemented in `saveMetaItem` and `deleteMetaItem`:

```ts
const OVERLAY_ALLOWED_TYPES = new Set(['view', 'views', 'dashboard', 'dashboards']);
if (this.projectId !== undefined && !OVERLAY_ALLOWED_TYPES.has(request.type)) {
  throw new Error('[customization_not_allowed] ...');
}
```

Single-kernel deployments (no `projectId`) keep their existing behaviour (any type writable).

### Deprecation of duplicated metadata `*.object.ts`

Five files in `packages/platform-objects/src/metadata/` duplicate a Zod schema that already exists in `@objectstack/spec` and contributed nothing but drift risk. They are marked `@deprecated` immediately and slated for removal in the next major release:

| deprecated `*.object.ts` | canonical Zod schema |
|---|---|
| `metadata/sys-view.object.ts` | `spec/src/ui/view.zod.ts` |
| `metadata/sys-flow.object.ts` | `spec/src/automation/flow.zod.ts` |
| `metadata/sys-agent.object.ts` | `spec/src/ai/agent.zod.ts` |
| `metadata/sys-tool.object.ts` | `spec/src/ai/tool.zod.ts` |
| `metadata/sys-object.object.ts` | `spec/src/data/object.zod.ts` |

`sys-metadata.object.ts` and `sys-metadata-history.object.ts` are retained — they are the storage substrate, not duplicates of any metadata type.

`MetadataProjector` (`packages/metadata/src/projection/metadata-projector.ts`) becomes dead code under this ADR. It is left in place for one release as a no-op safety net, and removed in the next major along with the deprecated objects.

## Consequences

### Positive

- `PUT /api/v1/meta/view/<name>` and `PUT /api/v1/meta/dashboard/<name>` now **persist** in project-kernel mode. The silent loss is gone.
- Customizations survive restart, because `loadMetaFromDb` no longer short-circuits on project kernels.
- `DELETE /api/v1/meta/{view,dashboard}/<name>` provides a "reset to factory default" semantic without restarting the kernel.
- The duplicated `*.object.ts` files no longer mislead developers into thinking the metadata flows through a physical projection table.
- Zod-first prime directive enforced at the binding layer, not just code review.

### Negative / accepted trade-offs

- **Full-document replacement, not patch.** A customer who changed one column width still ships a full view JSON. Diff/merge tooling is a follow-up phase, gated on the customer scenarios that actually need it.
- **Per-organization isolation deferred to Phase 2.** Phase 1 scopes overlays by `project_id` only. In single-tenant per-project deployments this is identical to "single overlay per environment". A `(project_id, organization_id)` composite scope is planned once the auth context plumbs `organization_id` end-to-end.
- **Package upgrade conflicts not detected.** If a customer overlay references a field the package later removes, the overlay will hide the new value but `getMetaItem` returns the customer JSON unchanged. A `validateCustomizationAgainstArtifact()` boot pass is planned for the phase that introduces in-place package upgrades.
- **Studio data-plane writes (`POST /api/v1/data/sys_view`) still work** during the deprecation window. After Studio is cut over to `PUT /api/v1/meta/view/<name>`, a one-time migration script translates surviving rows into `sys_metadata` overlay rows.

### Open questions

1. **Organization-level overlay** vs project-level: Phase 2 work. Requires (a) auth context propagation, (b) composite unique index, (c) read-order extension `org → project → artifact`.
2. **Artifact source** (`local-file` vs `artifact-api` vs OCI layer): out of scope for this ADR — see `MetadataPluginConfigSchema.bootstrap` in `metadata-plugin.zod.ts`. Cache invalidation when a new artifact ships in production will be a separate ADR.
3. **Studio Zod-to-form pipeline**: Phase 6. Studio currently has bespoke form components per metadata type. Migrating to a shared Zod-driven renderer is independent of this ADR but completes the principle.
4. **Security objects (`sys-role`, `sys-permission-set`)**: candidates for a separate ADR (Phase 5b). They mix "role definition" (metadata-like) and "role assignment" (runtime data) in the same table — the split mirrors the customization/data divide formalised here.

## Verification

- Unit:`saveMetaItem` upserts on `(type, name, project_id)`; `deleteMetaItem` removes the row; whitelist enforced.
- Integration: PUT writes a row; GET returns the overlaid value; restart preserves; DELETE returns to artifact default.
- Browser E2E: Studio dashboard edit + save + reload demonstrates persistence in the [HotCRM reference app](https://github.com/objectstack-ai/hotcrm).
- SQL: `sys_metadata` rows visible with `type='dashboard'`, `scope='project'`, `metadata` containing the full JSON document.

---

## References

- `packages/objectql/src/protocol.ts` — `getMetaItem`, `saveMetaItem`, `deleteMetaItem`, `loadMetaFromDb` (this ADR's primary site)
- `packages/rest/src/rest-server.ts` — `PUT/GET/DELETE /api/v1/meta/:type/:name` routes
- `packages/spec/src/api/protocol.zod.ts` — `ObjectStackProtocol` interface (`deleteMetaItem` added)
- `packages/spec/src/kernel/metadata-plugin.zod.ts` — `MetadataTypeRegistryEntrySchema.supportsOverlay` (future hook for the whitelist)
- `packages/spec/src/kernel/metadata-customization.zod.ts` — pre-existing `MetadataOverlaySchema` (kept; field-level patches are a future phase, not implemented here)
- `packages/platform-objects/src/metadata/sys-{view,flow,agent,tool,object}.object.ts` — files marked `@deprecated` by this ADR
- [HotCRM reference app](https://github.com/objectstack-ai/hotcrm) — primary E2E reference workspace

---

## Addendum — 2026-05-16: Phase 4 list-merge gate fix + overlay id-stripping rule

Two implementation issues were discovered during browser E2E verification with the [HotCRM reference app](https://github.com/objectstack-ai/hotcrm) and fixed:

### 1. List endpoint did not include overlay rows in project kernels

`getMetaItems(type)` in `packages/objectql/src/protocol.ts` was gated by
`if (this.projectId === undefined)` before consulting `sys_metadata`. Project
kernels — which are precisely where overlays live — therefore returned only
artifact entries. `GET /api/v1/meta/view` listed 16 artifact items and zero
overlays even when overlay rows existed.

**Fix:** removed the gate. List responses now merge artifact entries with
overlay rows from `sys_metadata` for the active organization.

### 2. Overlay payload must not inherit the source artifact's `id`

When the Console "Duplicate view" action stored a new overlay, it spread the
source view spec verbatim into the overlay payload. Artifact views include an
internal `id` field, so the duplicate overlay (stored under a new `name` like
`all_leads_copy_xxx`) carried `id='all_leads'` from the source. The Console
tab-bar dedup logic keys on `id`, so the duplicate silently shadowed the
original tab.

**Rule (now binding):** **overlay specs are name-keyed only**. Clients must
strip the `id` field from any source spec before persisting an overlay. The
Console additionally normalises loaded overlays via `id: spec.name || spec.id`
as defence-in-depth.

### Verified operations (browser E2E)

After the fixes, all view-CRUD operations were verified end-to-end in the
[HotCRM reference app](https://github.com/objectstack-ai/hotcrm) against `sys_metadata`:

| Operation | Storage check |
|---|---|
| Duplicate | new row appears with clean `name`-keyed identity |
| Pin | `isPinned=1` persisted |
| Rename | `label` persisted |
| Set as default | `isDefault=1` persisted (other rows cleared) |
| Delete | row removed, tab disappears, URL navigates away |
| Reload | overlay tab survives page refresh |
| GET `/api/v1/meta/view/:name` | returns full merged spec |

---

## Addendum — 2026-05-16 (b): deprecated metadata objects deleted

The five deprecated metadata-projection objects (`sys_object`, `sys_view`,
`sys_flow`, `sys_agent`, `sys_tool`) were **removed entirely** in this cycle:

- Deleted: `packages/platform-objects/src/metadata/sys-{object,view,flow,agent,tool}.object.ts`
- Deleted: `packages/metadata/src/projection/` (`MetadataProjector` class and re-exports)
- Removed from `packages/metadata/src/plugin.ts` `queryableMetadataObjects` array — only `sys_metadata` + `sys_metadata_history` remain (the ADR-0005 storage substrate)
- Removed from Setup app navigation (`packages/platform-objects/src/apps/setup.app.ts` "Platform" group): `Objects / Views / Flows / Agents / AI Tools` entries are gone. The remaining Platform entries are `Apps / Packages / Installations / All Metadata`
- `DatabaseLoader.enableProjection` option and `projector` field deleted; save/delete paths no longer fan out to projection tables
- `service-ai/ai-conversation.object.ts` `agent_id` field switched from `Field.lookup('sys_agent', …)` to `Field.text` since the lookup target no longer exists — AI agents are metadata-only and identified by `name` inside `sys_metadata`
- New idempotent cleanup migration: `dropProjectionTables(driver)` exported from `@objectstack/metadata/migrations`, drops the five stale tables from databases provisioned before this cycle

After the change, `/api/v1/data/sys_view` (and the four siblings) returns **404
object_not_found**. All metadata customisation flows through the overlay
endpoints (`PUT/GET/DELETE /api/v1/meta/{type}/:name`) backed by
`sys_metadata` JSON rows only.

---

## Addendum — 2026-05-16 (c): spec validation on overlay save

`PUT /api/v1/meta/:type/:name` now validates the payload against the
canonical Zod schema before persisting to `sys_metadata`. Prior to this
change, any JSON shape was accepted and stored verbatim, surfacing as
runtime errors only at read time when the merged effective metadata was
fed into the UI engine.

Implementation (`packages/objectql/src/protocol.ts`):

- `resolveOverlaySchema(type, item)` dispatches by metadata type:
  - `view` → `ListViewSchema` or `FormViewSchema` (picked by the `type`
    discriminant: form types `simple / tabbed / wizard / split / drawer / modal`
    → `FormViewSchema`; everything else → `ListViewSchema`).
    A naive `z.union` was rejected because its branch errors collapse to an
    opaque "Invalid input" message — explicit dispatch produces real field
    paths.
  - `dashboard` → `DashboardSchema`.
  - Other types → `null` (validation skipped, preserves legacy control-plane
    writes for `app`/`package`/etc. that pre-date strict schemas).
- `saveMetaItem` runs `safeParse`. On failure, throws an error with
  `code='invalid_metadata'`, `status=422`, and a structured `issues` array
  carrying `path/message/code` for each Zod issue. REST layer
  (`packages/rest/src/rest-server.ts:973-979`) already propagates `status`
  and `code` to the response.
- The persisted document is the **original** `request.item`, NOT
  `parsed.data`. Studio attaches auxiliary fields (`isPinned`,
  `isDefault`, `sortOrder`, `objectName`, …) that aren't in the canonical
  schema; storing `parsed.data` would silently strip them on every save.
  This trades strict-stripping against forward compatibility for Studio
  extensions — the canonical fields are still type-checked.

Sample 422 response:

```json
{
  "error": "[invalid_metadata] view/test_bad_view failed spec validation: columns: Invalid input",
  "code": "invalid_metadata"
}
```

Tests added in `packages/objectql/src/protocol-meta.test.ts`
(`describe('spec validation', …)`): valid view/dashboard accepted, invalid
shapes return 422 with `issues`, unknown extras preserved, unregistered
types fall through, plural type strings normalize correctly.

---

## Addendum — 2026-05-16 (d): registry-driven opt-in + overlay-uniqueness index

### Registry-driven opt-in (was: hard-coded whitelist)

`packages/objectql/src/protocol.ts` previously gated `PUT/DELETE
/api/v1/meta/:type/:name` against a **hard-coded** `Set` of allowed types
(`OVERLAY_ALLOWED_TYPES = new Set(['view', 'dashboard'])`). Any new metadata
type that wanted to participate in the overlay system had to find and edit
that constant — invisible coupling between the spec and the runtime.

That whitelist is now derived from the **metadata type registry** (the
single source of truth defined in
`packages/spec/src/kernel/metadata-plugin.zod.ts`):

- Added a new boolean field `allowOrgOverride: z.boolean().default(false)` to
  `MetadataTypeRegistryEntrySchema`. TSDoc spells out the distinction:
  - `supportsOverlay` is **capability** (the loader can merge overlays).
  - `allowOrgOverride` is **runtime permission** (per-tenant writes via the
    REST overlay endpoint are accepted).
- In `DEFAULT_METADATA_TYPE_REGISTRY`, only `view` and `dashboard` opt in
  (`allowOrgOverride: true`). Every other entry sets it explicitly to `false`
  to keep the table self-documenting.
- `protocol.ts` builds `OVERLAY_ALLOWED_TYPES` at module-load time by walking
  the registry and including each opted-in singular type plus its plural form
  (via `SINGULAR_TO_PLURAL`). A new helper `isOverlayAllowed(type)`
  normalizes plural inputs back to singular for safety, since REST callers
  may use either form.
- Save/delete reject unsupported types with **HTTP 403 `not_overridable`**
  (was `customization_not_allowed` / 400). The new code is more accurate
  semantically — the type is definitionally not overridable, not just
  unsupported in the current build.

To extend the overlay surface to a new type (e.g. `flow`), the only edit
required is in `metadata-plugin.zod.ts`:

```ts
{ type: 'flow', …, allowOrgOverride: true, … }
```

…plus adding the type's Zod schema to `resolveOverlaySchema()` in
`protocol.ts` so the new payloads are validated. No `Set` editing.

### Overlay-uniqueness index (`schema-index`)

The `sys_metadata` schema previously declared a UNIQUE index on
`(type, name, project_id)`. Pre-overlay this was correct; post-overlay it
would forbid two organizations from each having their own customization of
the same `(type, name)` within a project — the central use case ADR-0005
exists to support.

Replaced with a partial UNIQUE index that scopes uniqueness by
organization and lifecycle state:

```text
indexes: [
  {
    name: 'idx_sys_metadata_overlay_active',
    fields: ['type', 'name', 'organization_id', 'project_id', 'scope'],
    unique: true,
    partial: "state = 'active'",
  },
  …
]
```

Drivers ignore `indexes` declarations on synced tables today, so a new
idempotent migration is provided and run automatically by
`DatabaseLoader.ensureSchema()`:

- `addSysMetadataOverlayIndex(driver)` — exported from
  `@objectstack/metadata/migrations`.
- Issues `CREATE UNIQUE INDEX IF NOT EXISTS … WHERE state = 'active'`.
- Falls back to a non-unique composite index on engines that don't support
  partial indexes (MySQL); application code in `saveMetaItem` provides
  upsert semantics so duplicates are still prevented.
- Failures are non-fatal — the migration logs and returns; the app boots.

### Design principle (codified)

> **One Zod source per metadata type.**
>
> For each metadata type (view, dashboard, flow, agent, tool, …):
>
> 1. The **shape** lives in exactly one Zod schema under
>    `@objectstack/spec/{domain}/*.zod.ts`.
> 2. The **opt-in for runtime org customization** lives in exactly one
>    place: the `allowOrgOverride` boolean on its
>    `DEFAULT_METADATA_TYPE_REGISTRY` entry.
> 3. The **overlay validator** lives in exactly one place:
>    `resolveOverlaySchema()` in `packages/objectql/src/protocol.ts`.
>
> Do **not** re-declare the same shape as a `*.object.ts` (the
> projection-table pattern is removed; see Addendum 2026-05-16 (b)).
> Do **not** maintain a parallel whitelist of "types that can be edited at
> runtime" outside the registry.
>
> Forms in Studio that edit metadata should ultimately be derived from the
> Zod schema (Phase 6 — `p6-form-render-from-zod`); until then, hand-rolled
> dialogs MUST be kept in lock-step with the canonical schema (the
> 2026-05-16 (d) view-types fix in §14 of the working plan is what happens
> when they drift).

---

## Addendum — 2026-05-16 (e): artifact source & refresh semantics

ADR-0005 says the **artifact** (`dist/objectstack.json`) is the source of
truth for built-in metadata, while `sys_metadata` carries per-org overlays.
The artifact has multiple plausible delivery channels in production. This
addendum nails down what each implies for overlay validity, cache
invalidation, and upgrade behaviour. The runtime defaults to the local
file source today; the others are forward-compatible plans.

### Artifact source variants

| Source | Typical environment | How runtime fetches | Mutation event |
|---|---|---|---|
| **Local file** (default) | Dev, single-host servers | `fs.readFile(dist/objectstack.json)` at boot | Process restart / SIGHUP |
| **HTTP fetch** | Multi-tenant cloud, control-plane–driven rollouts | Boot-time GET against control plane (`GET /api/v1/control/artifact/:project/:version`); ETag cached on disk | Webhook from control plane → SIGHUP / hot-reload |
| **OCI image layer** | Containerised deploys, GitOps pipelines | Image tag pin → image pull → file mounts at known path → boot reads file | Pod rollout (Kubernetes / Nomad) |

All three converge on the same in-memory shape: the parsed artifact is
loaded into `SchemaRegistry`. The differences are purely about **when** a
new shape becomes visible and **how** the runtime is told to re-load.

### Refresh model (current vs. future)

- **Today (Phase 1–6):** Boot-time only. Re-reading the artifact requires
  process restart. Overlay rows in `sys_metadata` are independent and
  outlive restarts; they are merged on every read.
- **Future (post-ADR-0005):** A `metadataRegistry.reload()` API that:
  1. Re-reads the artifact (file / HTTP / OCI).
  2. Diffs the new artifact against the in-memory baseline.
  3. Drops the metadata cache (and the `DatabaseLoader` LRU) for any
     `(type, name)` whose baseline changed.
  4. Re-validates each affected overlay row against the **new** baseline
     schema (see "Customization validation" below).

### Customization validation against artifact upgrades

When the artifact upgrades (a new package version of the underlying view /
dashboard ships), an existing org overlay may reference fields the new
schema no longer accepts (renamed columns, removed sub-configs, tightened
enums). The runtime cannot silently merge a stale overlay — it must
quarantine it and surface a remediation hook.

**Strategy:**

1. After artifact load, walk all overlay rows for affected `(type, name)`.
2. Run them through the canonical Zod schema (the same
   `resolveOverlaySchema()` used at write time).
3. On failure:
   - Set `state = 'conflict'` (existing column on `sys_metadata`).
   - Append a `sys_metadata_history` entry with `actor='system:upgrade'`,
     reason `artifact_schema_drift`, and the Zod issues array.
   - Exclude the row from the read-time merge → effective metadata falls
     back to the artifact baseline (graceful degradation, no broken UI).
4. Studio surfaces a per-org "Conflicts" inbox listing the quarantined
   rows so an admin can re-edit and re-save (which clears `conflict`).

This bounded validation step is cheap (overlays are typically tens of
rows per org per project) and runs only on artifact upgrade events, not
on every request.

### Cache invalidation contract

| Cache | Owner | Invalidation trigger |
|---|---|---|
| `SchemaRegistry` (artifact data) | Kernel | Boot, explicit `reload()` |
| `DatabaseLoader.LRUCache` (overlay rows) | `@objectstack/metadata` | Per-`(type, name, org)` on save / delete; full clear on `reload()` |
| In-memory merged effective metadata | `protocol.ts` `getMetaItem` (no cache today) | N/A — re-merged on every call (Phase 3 deferred caching) |

The merged-effective layer is intentionally uncached today. When that
becomes a hotspot, the cache key must be `(type, name, organization_id,
artifactVersionHash)` so that an artifact bump naturally invalidates all
entries derived from the prior baseline.

### Open questions (out of scope for this ADR)

- **Atomic artifact swap on running instances** — file source can be
  `mv` and re-read; HTTP/OCI sources need rendezvous semantics (drain
  in-flight requests before swap?). Defer to a deployment-runtime ADR.
- **Per-tenant artifact pinning** — if tenants must upgrade independently,
  the registry needs a tenant-aware artifact resolver. Today's model
  assumes one artifact per ObjectOS instance.
- **Cross-version overlay migration scripts** — when a field is renamed in
  a new artifact, an overlay that referenced the old name should ideally
  be auto-rewritten rather than quarantined. Requires a migration
  contract on the package author side; tracked separately.

---

## Addendum: Two-tier authorization (PR-10d.7, 2026-05)

The original ADR gates writes purely on `allowOrgOverride` (type-level).
This proved too coarse for one category of types: those that ship
executable code (`hook`, `validation`) declare
`allowOrgOverride: false` AND `allowRuntimeCreate: true`. The intent —
documented in `metadata-plugin.zod.ts` — is "users may author brand-new
items of this type, but artifact-shipped items remain immutable".
The original gate forbade both, blocking the documented user flow.

### Two-tier rule

For any `(type, name)` write:

| Item exists at name as… | Required flag |
|---|---|
| Artifact (`registry._packageId` set to a real packageId) | `allowOrgOverride: true` |
| DB-only (no artifact at this name) | `allowOrgOverride OR allowRuntimeCreate` |

The artifact origin is determined server-side from the
`SchemaRegistry._packageId` tag, which is set only by artifact loaders
passing a truthy packageId argument. Request payloads cannot influence
the classification.

### New error code

- `not_overridable` — artifact-backed item, type has `allowOrgOverride: false`.
- `not_creatable` — brand-new item, type has both flags false.
  Distinct so the UI can offer different guidance (the former says
  "edit source", the latter says "this type forbids runtime creation").

### Intent threading

`PutOptions.intent` / `DeleteOptions.intent` carry a
`MetadataWriteIntent = 'override-artifact' | 'runtime-only'` from the
protocol layer down to the repository's `assertAllowed`. The repo
provides defense-in-depth: even when called directly with `runtime-only`,
it still requires the target type to declare `allowRuntimeCreate: true`.

### Read path

Runtime-create types declare `supportsOverlay: false`, but the read
path (`getMetaItem`, `getMetaItems`) consults `sys_metadata`
unconditionally. A DB-only `hook` row authored at runtime is therefore
visible to subsequent reads even though the type is not "overlay-eligible"
in the original ADR sense. Tested explicitly in
`protocol-meta.test.ts > two-tier authorization`.

### Provenance edge case

`loadMetaFromDb` registers DB-rehydrated objects with a synthetic
`_packageId = 'sys_metadata'` (objectql/protocol.ts ≈ line 3092). The
`isArtifactBacked` classifier treats this sentinel as "not an artifact"
so DB-only objects retain runtime-authored semantics.

### Collision warning

When an artifact loader registers an item whose name already exists in
the registry as a DB-only entry (registered without a packageId), the
runtime overlay layer silently shadows the artifact value (correct
ADR-0005 behavior). Since the silent shadowing can surprise operators
on package upgrade, `Registry.registerItem` now emits a single
`[Registry] Collision` console.warn naming both sources so the situation
is discoverable in startup logs.

### Plugin-registered types (runtime-create gate parity)

`DEFAULT_METADATA_TYPE_REGISTRY` is the *static* spec-defined registry
(object, view, hook, …). Plugins register additional metadata types at
runtime — e.g. `theme`, `api`, `connector`, `data`, `mapping`, `policy`,
`sharing_rule`, `webhook`, `analyticsCube`, `package`. These types have
no static registry entry.

**Invariant:** the listing endpoint (`protocol.getMetaTypes()`) and the
write-path gates (`protocol.isRuntimeCreateAllowed`,
`sys-metadata-repository.assertAllowed`) MUST agree on
`allowRuntimeCreate` for every type they describe. `getMetaTypes()`
synthesises descriptors for runtime-registered types with
`allowRuntimeCreate: true`; both write gates mirror this by treating
"type has no entry in the static registry" as runtime-creatable.

Without that parity, the admin UI advertises a type as writable, then
the write endpoint 403s on save — a confusing footgun. Regression
coverage:

- `protocol-meta.test.ts > two-tier authorization > accepts brand-new
  plugin-registered type (no static registry entry)`
- `sys-metadata-repository.test.ts > put accepts plugin-registered type
  with intent=runtime-only (theme|api)`
- `sys-metadata-repository.test.ts > put refuses
  statically-registered type with allowRuntimeCreate:false (function)`
  — guards against the new "unknown ⇒ permissive" branch over-relaxing
  statically-declared opt-outs.

### Admin UX: field-level Code-vs-Effective diff

The Layers tab in the metadata editor (`packages/app-shell/.../LayeredDiff.tsx`
in `objectui`) now defaults to a **Diff** view that compares
`layered.code` (artifact baseline) against `layered.effective` (merged)
field-by-field. Each top-level key renders as a row with a colour-coded
status (modified / added / removed / unchanged) so admins can see at a
glance what their overlay actually changes — instead of eyeballing
three blobs of JSON. Code / Overlay / Effective JSON tabs remain
available for full payload inspection.
