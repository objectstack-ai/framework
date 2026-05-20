# ADR-0006: Environment & Project — v4 (drop dev-workspace Project, unify on Package)

**Status**: Accepted (v4 — supersedes v3)
**Date**: 2026-05-20 (v4)
**Deciders**: ObjectStack Protocol Architects
**Supersedes**: v1 (strict tree), v2 (siblings + sys_deployment join), v3 (siblings + deferred dev-workspace `sys_project`)
**Builds on**: ADR-0002 (Environment-Per-Database Isolation), ADR-0003 (Package as First-Class Citizen)
**Consumers**: `@objectstack/service-tenant`, `@objectstack/service-cloud`, `@objectstack/spec/cloud`, `@objectstack/cli`, the Console `cloud_control` app

> **v4 revision note** — v3 kept `sys_project` reserved as a future
> *dev-workspace* concept (Phase 5 Builder UX). When we started drafting the
> Phase 5 schema we realised that **the responsibilities we were about to
> hand to `sys_project` are already covered by `sys_package` /
> `sys_package_version` / `sys_package_installation`** (ADR-0003).
> Introducing a parallel "Project + Branch + Revision" stack would create
> two competing version-management trees in the control plane, exactly the
> drift this ADR family exists to eliminate.
>
> v4 therefore deletes the dev-workspace Project concept entirely. There is
> no `sys_project*` table. There is no `sys_environment_revision` table in
> the target state — both are subsumed by the existing package three-tier
> (identity / immutable version / per-env installation).
>
> The local dev workspace continues to exist — but as **local files +
> git**, not as a server-side table. A `objectstack publish` from any
> working copy is just "create a new `sys_package_version` for the implicit
> package that represents this code base".

---

## Context

After v3 we attempted to scope the Phase 5 dev-workspace schema and
immediately hit overlap:

| Need | v3 plan (`sys_project*`) | What already exists (`sys_package*`) |
|:---|:---|:---|
| Code identity + namespace | `sys_project` (slug, owner_org) | `sys_package` (manifest_id, owner_org, visibility) |
| Immutable version snapshots | `sys_project_revision` (commit_id, checksum, storage_key) | `sys_package_version` (semver, checksum, storage_key, status) |
| Per-env deployment | (would have needed `sys_deployment`) | `sys_package_installation` (env × package × version) |
| Cross-env promotion | (would have needed a join) | `INSERT INTO sys_package_installation … SELECT … FROM staging-env` |
| Marketplace distribution | n/a | `visibility = 'marketplace'`, `is_starter` |
| Dependency declaration | n/a | `sys_package_version.manifest_json` deps |

Every Project responsibility maps 1:1 onto an existing Package row. The
only "missing" capability — git-style **branches** (parallel main / staging
/ feature heads) — can be expressed today with semver prereleases
(`1.2.3-staging.4`) and elevated to a real `sys_package_channel` mechanism
later when CI demands it.

Meanwhile the CLI publish path currently writes a **third** revision table
(`sys_environment_revision`, introduced transitionally during v3 cleanup).
That table holds nothing `sys_package_version` couldn't hold, but it
locks the runtime to a single-package-per-env assumption and prevents
Marketplace and user code from sharing one mental model.

The platform is still pre-launch; the same one-shot-wipe window v3 used
remains open.

---

## Decision

1. **Drop the dev-workspace `sys_project` concept.** There is no Project
   table, no Project Branch table, no Project Revision table in the
   target state. The local working copy on a developer's machine is the
   "workspace" — versioned by git, not by a control-plane row.

2. **All code distribution flows through Package.** Whether the source is
   a user-authored repo, a starter template, or a third-party marketplace
   submission, it ends up as a `sys_package` (identity), one or more
   `sys_package_version` rows (immutable snapshots), and zero-or-more
   `sys_package_installation` rows (per-env activation).

3. **`sys_environment_revision` is transitional.** Today the CLI publish
   path writes this table to keep things compiling. It will be removed
   once the CLI publish path is rewritten to call the package version
   create + installation upsert endpoints (Phase B below).

4. **Persona model collapses to one path.** "Consumer" and "Builder"
   personas in v3 both ultimately install a `sys_package_version` into a
   `sys_environment`. The difference is *which package* they install
   (marketplace vs. their own), not which schema they touch.

```
Organization (account root — billing, members, SSO realm)
  ├── Environment           (1..N — runtime container)
  │     ├── hostname, database_url, plan, quota, status
  │     └── installations    → sys_package_installation
  │                           (env × package × version)
  │
  └── Package               (0..N — code identity, Marketplace or private)
        ├── manifest_id, owner_org, visibility, is_starter
        └── versions         → sys_package_version
                              (immutable artifact snapshots, semver)
```

**No FK between Environment and Package.** They meet only at
`sys_package_installation`.

### Two flows, one schema

| Flow | What the user does | What writes to the DB |
|:---|:---|:---|
| **Install from Marketplace** | Browse → pick package → choose env | `INSERT sys_package_installation (env, package, version)` |
| **`objectstack publish` (CLI)** | Local code → `build` → `publish` | (a) ensure `sys_package` for this code base; (b) `INSERT sys_package_version` with new artifact; (c) upsert `sys_package_installation` pointing the env at the new version |
| **Promote staging → prod** | `objectstack promote --from staging --to prod` | `INSERT sys_package_installation` for prod using staging's `package_version_id` (zero re-upload) |
| **Rollback** | `objectstack rollback --env prod --to <ver>` | `UPDATE sys_package_installation … SET package_version_id = <old>` |

### Implicit `sys_package` for user code

A user's repo is associated with a package the first time `publish` runs
against a given control plane. The package's `manifest_id` defaults to
`local.<org_slug>.<project_slug>` (overridable in `objectstack.config.ts`).
Subsequent publishes from the same repo create new `sys_package_version`
rows under that package.

This means user code, starter templates, and Marketplace apps are
indistinguishable to the runtime — they all resolve to a
`sys_package_installation` row at load time.

### Branching strategy (interim)

Today: encode the channel in the semver prerelease tag.

| Channel | Example version | Resolves on env via |
|:---|:---|:---|
| stable | `1.4.0` | `package_version_id` pin |
| staging | `1.4.0-staging.7` | installation upgrade |
| PR preview | `1.4.0-pr.123.2` | ephemeral env + installation |

Later: introduce `sys_package_channel` (`{package_id, name, head_version_id}`)
plus `sys_package_installation.tracking` (`pinned` | `channel_head`) to
get CI-style "always run staging branch HEAD" without a Project table.

### Hostname routing

Unchanged from v3. The Cloudflare Worker resolves
`<slug>.objectos.app → sys_environment.id`. Runtime loads each
installed package's current version via `sys_package_installation`.

### Console UX

Unchanged surface area, simpler mental model:

```
Environments         ← runtime targets
Packages             ← code you own + Marketplace browser (one tab, filtered)
Members
Billing
```

There is no separate "Projects" tab. A power user inspecting "what's
installed where" goes through Packages → version history → installations.

---

## Consequences

### Positive

1. **One version-management spine.** Marketplace apps, starter templates,
   and user code share the same three tables. Operators learn one model.
2. **Smaller schema.** No `sys_project`, no `sys_project_branch`, no
   `sys_project_revision`, no `sys_environment_revision`, no
   `sys_deployment`. The control plane keeps `sys_environment` +
   `sys_package*` and nothing else for the deploy story.
3. **Promote / rollback are SQL on `sys_package_installation`.** Same
   property v3 advertised, now also true for user code.
4. **CLI publish and Marketplace install converge.** A single set of
   permissions, audit events, and Studio screens covers both paths.
5. **Dev workspace = local files + git.** We don't compete with git for
   branch / revision UX in the control plane.

### Negative / Costs

1. **Two paths today don't converge yet.** The CLI still writes
   `sys_environment_revision`; until Phase B lands, "what version is
   running in prod" requires looking at two tables. Transitional.
2. **No server-side branches today.** Teams that want CI-driven
   `staging` ↔ `prod` channels must encode it in semver prereleases
   until `sys_package_channel` ships.
3. **`@objectstack/spec/cloud` API surface change.** `ProjectSchema`,
   `ProjectBranchSchema`, `ProjectRevisionSchema` are removed. No
   downstream consumers in production yet.

### Neutral

1. `sys_package_version.published_from_project_id` (introduced in v3) is
   removed as a field — provenance lives in `sys_package_version.metadata`
   if needed.
2. `ProjectArtifactSchema` (`packages/spec/src/cloud/project-artifact.zod.ts`)
   is the envelope returned by `GET /cloud/projects/:id/artifact`. The
   route name is kept for BC; the response shape continues to wrap the
   compiled `ObjectStackDefinitionSchema`. The "Project" in the schema
   name is historical and will be renamed to `EnvironmentArtifact` in a
   follow-up.

---

## Phasing

| Phase | Scope | Status |
|:---|:---|:---|
| **A — Drop Project from the protocol** | Remove `packages/spec/src/cloud/project.zod.ts`; update `index.ts`; trim Project tests from `environment.test.ts`; mark `sys_environment_revision` as `@deprecated transitional` | ✅ This commit |
| **B — Rewire CLI publish onto Package** | `objectstack publish` resolves implicit `sys_package`; calls `POST /cloud/packages/:id/versions`; upserts `sys_package_installation`. Old `/cloud/projects/:envId/metadata` becomes a thin BC shim that internally walks the new path. | Next |
| **C — Split CLI commands** | `objectstack push` (version only) + `objectstack deploy` (installation upsert) + `objectstack promote` + `objectstack rollback`. `publish` stays as a `push && deploy` alias. | Next+1 |
| **D — Remove transitional revision table** | After Phase B is shipping and verified: drop `sys_environment_revision` schema, delete `_DEPRECATED` route handlers, wipe table from any seeded control planes. | After C |
| **E — `sys_package_channel` (optional)** | Only if real CI need surfaces. Adds named channels + tracking mode to installations. | Deferred |

There is no "Phase 5 Builder UX" anymore — Builder is just "you own
private packages now", and the existing Packages UI covers it.

---

## Migration

Pre-launch: drop tables, rebuild. Same one-shot wipe v3 used.

Post-launch (forward-looking, if v4 lands after launch):
- Read each `sys_environment_revision` row.
- Ensure an implicit `sys_package` exists for the env's owner org.
- For each revision: insert `sys_package_version` (semver = `0.<idx>.0`,
  storage_key copied verbatim, checksum copied verbatim).
- Insert `sys_package_installation` for the env's *current* revision.
- Drop `sys_environment_revision`.

The script lives in `@objectstack/service-tenant`'s migration folder
when needed.

---

## Open questions

1. **`manifest_id` default for local code.** `local.<org_slug>.<project_slug>`
   collides if two projects share a slug. Resolution: include a 6-hex
   suffix on first publish, persist it in `objectstack.config.ts`.
2. **Visibility default for CLI-created packages.** `private` (owner org
   only) — consistent with `sys_package.visibility` default. Explicit
   `objectstack package publish --marketplace` flow to escalate.
3. **Multi-package envs in Studio.** The current "Environment detail" page
   assumes one artifact. Phase B+ updates it to list installations and
   show per-package versions.

---

## References

- ADR-0002 — Environment-Per-Database Isolation
- ADR-0003 — Package as First-Class Citizen
- v3 (archived as the immediate predecessor): `0006-project-environment-split.md` (this file's prior version, retained in git history)
- Power Platform: Solution → Environment model (same shape, different names)
- Salesforce: Unlocked Package → Org model (no "Project" table either)
- npm + lockfile: identity + immutable version + installation pointer
