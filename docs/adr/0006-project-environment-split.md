# ADR-0006: Environment & Project as Independent Siblings — v3

**Status**: Accepted (v3 — supersedes v2)
**Date**: 2026-05-20 (v3)
**Deciders**: ObjectStack Protocol Architects
**Supersedes**: v1 (strict tree), v2 (siblings + sys_deployment join)
**Builds on**: ADR-0002 (Environment-Per-Database Isolation), ADR-0003 (Package as First-Class Citizen)
**Consumers**: `@objectstack/service-tenant`, `@objectstack/service-cloud`, `@objectstack/spec/cloud`, `apps/cloud`, the Console `cloud_control` app

> **v3 revision note** — v2 introduced Project and Environment as siblings
> joined by a `sys_deployment` M:N table. That join was modelled on Vercel's
> git-driven deployment graph, which ObjectStack does not need: every
> Project-to-Environment promotion goes through a published `sys_package_version`,
> which already carries the snapshot. v3 deletes `sys_deployment` and connects
> Project ↔ Environment only via the package version (publish → install). This
> matches Power Platform (Solution → Environment) and Salesforce (Unlocked
> Package → Org) exactly, with one fewer table.
>
> v3 also adopts the **drop-schema-clean** path: the system is pre-launch,
> the user accepted a one-shot wipe of `sys_project*` / `sys_package*` rows.
> No grandfathering code is shipped.

---

## Context

After v2 we hit two practical problems:

1. **Phase 0 was a misleading UI relabel.** `sys_project.label` was changed to
   "Environment", but the schema still conflated authoring and runtime concerns.
   Reviewers correctly observed "this is just a rename — you didn't actually
   split anything." Reverted in commit `0f412a0f`.
2. **`sys_deployment` solves a problem we don't have.** v2 envisioned a M:N
   between Project Revisions and Environments to support per-env version pinning.
   But ADR-0003 already says published package versions ARE the pinnable unit.
   A Project publishes a `sys_package_version`; an Environment installs it via
   `sys_package_installation`. There is no third table needed.

Meanwhile, the platform is pre-launch and all production data can be wiped.
This is a one-time window: structural splits done now cost ~3-5 days; done
post-launch they cost weeks plus a dual-write migration window plus a token-
invalidation event for SSO clients.

---

## Decision

Adopt the **independent-siblings** model with no join table. Project and
Environment are both first-class children of Organization, and they communicate
only through published Package Versions (Marketplace contract).

```
Organization (account root — billing, members, SSO realm)
  ├── Environment (1..N — runtime container)
  │     ├── hostname, database_url, plan, quota, status
  │     └── installed_packages (M:N → sys_package_version)
  │
  └── Project (0..N — optional dev workspace)
        ├── Branch (main / staging / feature/*)
        │     └── Revision (immutable snapshot per publish)
        │           ↓ publish
        │       sys_package_version  ──→  install into any Environment
        │
        └── Member (developer RBAC, separate from env operator RBAC)
```

**No FK between Project and Environment.** The published Package Version is
the only artifact that crosses the boundary.

### Two personas, two paths

| Persona | First action | Default Console nav |
|----|----|----|
| **Consumer** | Register → Create Environment → Install from Marketplace | `Environments`, `Marketplace`, `Members`, `Billing` |
| **Builder** | Either path A or B below | + `Developer` group (Projects, Branches, Revisions, Published Packages) |
|  | A: registers, creates Environment, then clicks **"Customize this Environment"** → auto-creates a Project initialized from the env's current metadata | |
|  | B: registers, creates Project directly, builds metadata, publishes Package Version, installs into one or many Environments | |

Projects are zero-or-many under an Org. Consumer accounts may have **zero**
Projects forever — that is the supported case, not a degenerate edge.

### Schema

**Renamed / repurposed**
- `sys_project` becomes pure **Dev Workspace**: `id`, `organization_id`,
  `slug`, `display_name`, `description`, `repo_url?`, `default_branch_id?`,
  `visibility`, `archived_at?`, `created_at`, `updated_at`, `created_by`.
  **No** hostname / database / quota / plan / kernel state.

**New**
- `sys_environment`: `id`, `organization_id`, `slug`, `display_name`,
  `hostname` (unique global), `database_url` / `database_driver` /
  `database_owner` (per ADR-0002), `plan`, `storage_limit_bytes`,
  `status`, `is_default`, `last_published_at`, `archived_at?`,
  `created_at`, `updated_at`, `created_by`.

**Re-pointed FKs**
- `sys_project_branch.project_id` → `sys_project` (already the case
  conceptually; now actually correct semantically — was misleadingly
  pointing at the runtime row before v3).
- `sys_project_member.project_id` → `sys_project` (dev RBAC).
- `sys_environment_member` is a **new** table (env operator RBAC), peer
  of `sys_project_member`.
- `sys_package_installation.environment_id` → `sys_environment` (was
  `project_id` → `sys_project`).
- `sys_oauth_application.environment_id` → `sys_environment` (SSO per env,
  not per project).
- `sys_quota_usage.environment_id`, `sys_billing_period.environment_id`
  (usage accrues at env; billing rolls up by org).
- `sys_package_version.published_from_project_id` — **optional** lookup
  (soft attribution; not a hard FK enforced at install time).

**No deployment / promotion join table.** "Promote staging → prod" is:
```sql
INSERT INTO sys_package_installation (environment_id, package_version_id)
SELECT 'prod-env', package_version_id
FROM sys_package_installation
WHERE environment_id = 'staging-env';
```

### Hostname routing

The Cloudflare Worker resolves `<slug>.objectos.app` → `sys_environment.id`
(was `sys_project.id`). The cache key in `multi-project-plugin.ts` becomes
`hostname → environmentId`. The DO singleton hydrates per Environment.

### Console UX

**Default (Consumer) nav:**
```
Environments
Marketplace
Members
Billing
```

**Developer mode (toggled by clicking "Customize this Environment" or
"Create Project") adds:**
```
Developer
├── Projects
├── Branches
├── Revisions
└── Published Packages
```

The toggle is sticky per user; once on, it stays on across sessions.

---

## Consequences

### Positive

1. **Consumer first-run is unambiguous.** No hidden Project rows, no auto-
   created "default project" with a fake slug. Account → Env → Install.
2. **Schema is small and obvious.** 1 new table (`sys_environment`) +
   field rename on installations. No join table.
3. **Per-env version pinning is trivial.** `sys_package_installation` already
   carries `package_version_id`; different envs can pin different versions
   the same package without any new mechanism.
4. **SSO isolation is automatic.** Each Environment is its own IdP realm
   with its own OAuth client; prod tokens cannot be replayed against staging.
5. **Billing rollup is straightforward.** Usage rows carry `environment_id`;
   `SUM(usage) GROUP BY organization_id` produces the invoice.
6. **Promotion = SQL.** No special "deployment" verb in the API — it's
   `POST /cloud/environments/:prod/installations` with the same
   `package_version_id` the staging env uses.

### Negative / Costs

1. **One-shot data wipe.** Pre-launch is the only time this is free. After
   launch, the same split costs ~3 weeks (dual-write, backfill, token rotation).
2. **`@objectstack/cloud` API surface change.** `POST /cloud/projects` is
   replaced by `POST /cloud/environments`; `POST /cloud/projects` re-emerges
   later (different semantics) when Builder UX ships. SDK consumers
   (none in production yet) must rename calls.
3. **`apps/cloud/server/index.ts` and `worker.ts` change** their hostname
   resolution from `sys_project` to `sys_environment`.

### Neutral

1. `sys_project_branch` keeps its name and semantics — was always a dev
   concept, just had a confused FK target before v3.
2. `sys_package_version.published_from_project_id` is optional, so
   platform-seeded starter packages (no Project owner) work the same way.

---

## Phasing (post v3 acceptance)

| Phase | Scope | Notes |
|----|----|----|
| **1 — Drop & redefine schema** | Wipe prod `sys_project*`, `sys_package*`, `sys_quota_usage`, `sys_billing_period`; rebuild `sys_project` as Dev Workspace; ship new `sys_environment` + member table | One commit; one prod DB wipe |
| **2 — Cloud routes refactor** | `POST /cloud/environments` (provisioning); `POST /cloud/environments/:id/installations`; hostname→env in worker; remove old `/cloud/projects` runtime routes | Same PR as Phase 1 |
| **3 — Console nav refactor** | Default nav = Environments + Marketplace; Developer toggle for Projects; install action targets envs | Same PR or follow-up |
| **4 — Deploy + smoke** | Build → deploy → wipe Neon → register fresh account → create env → install starter | One go-live moment |
| **5 (later) — Builder UX** | Project create, branch list, revision publisher, "Customize this Environment" flow, Publish to Marketplace | Separate epic |

Phases 1-4 are the 3-5 day budget.

---

## Open questions

1. **Multiple Environments per account in free tier?** Recommend: 1 free env
   per Org; paid plans get N. Enforced at provision time.
2. **Default Project on Customize flow?** When a Consumer clicks "Customize
   this Environment", do we create a Project named after the env (`acme-crm`)
   or prompt for a name? Recommend: auto-name from env slug, allow rename.
3. **What about packages installed into an Environment that originate from
   a Project that gets archived?** Installations are immutable references
   to `sys_package_version`; archiving the Project does not break running
   Environments. Republishing requires un-archiving.

---

## References

- ADR-0002 — Environment-Per-Database Isolation
- ADR-0003 — Package as First-Class Citizen
- v2 (archived): `0006-project-environment-split.v2.md`
- Power Platform: Solution → Environment model
- Salesforce: Unlocked Package → Org model
