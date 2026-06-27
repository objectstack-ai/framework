# @objectstack/plugin-org-scoping

> Row-level **Organization** isolation for ObjectStack — the LOGICAL multi-tenant building block.

`@objectstack/plugin-org-scoping` makes `sys_organization` a first-class row-level scope:

- **Insert auto-stamp** — fills `organization_id` from `ExecutionContext.tenantId` on every authenticated insert (when the target object declares the column).
- **Per-org seed replay** — every `sys_organization` insert triggers a copy of the app's demo dataset into the new org (via `seed-replayer`, or fallback `claimOrphanOrgRows` / `cloneOrgSeedData`).
- **Default-org bootstrap** — the first platform admin gets a `Default Organization` (slug `default`) bound as `owner` on `kernel:ready`, so the dashboard isn't empty after first sign-up.

Pair with [`@objectstack/plugin-security`](../plugin-security/README.md) for full multi-tenant RBAC + RLS + Field-Level Security. Standalone install gives a single-tenant deployment.

## Naming

The word "tenant" in ObjectStack means **physical** isolation (one Environment = one database, per ADR-0002 and `@objectstack/driver-turso`'s multi-tenant router). This plugin is about **logical** row-level scoping inside a single database — orthogonal to physical tenancy. Hence "org-scoping", not "multi-tenant".

## Install

```bash
pnpm add @objectstack/plugin-org-scoping @objectstack/plugin-security
```

## Usage

```ts
import { OrgScopingPlugin } from '@objectstack/plugin-org-scoping';
import { SecurityPlugin } from '@objectstack/plugin-security';

// OrgScopingPlugin MUST be registered BEFORE SecurityPlugin — the
// latter probes `getService('org-scoping')` at start time to decide
// whether to keep wildcard `current_user.organization_id` RLS policies.
await kernel.use(new OrgScopingPlugin());
await kernel.use(new SecurityPlugin());
```

Or via the `OS_MULTI_ORG_ENABLED` env switch when using `@objectstack/runtime` / `@objectstack/plugin-dev`:

```bash
OS_MULTI_ORG_ENABLED=true objectstack serve
```

## Options

```ts
new OrgScopingPlugin({
  ensureDefaultOrganization: true, // default — auto-create slug="default" for first admin
});
```

Set `ensureDefaultOrganization: false` to fully self-manage onboarding via invitations / a custom UI.

## See also

- ADR-0002 — Physical multi-tenancy & driver-turso router
- `@objectstack/plugin-security` — RBAC, RLS, Field-Level Security
