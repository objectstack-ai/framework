---
"@objectstack/cli": major
"@objectstack/runtime": major
"@objectstack/rest": major
"@objectstack/client": major
"@objectstack/spec": major
"@objectstack/metadata": major
"@objectstack/platform-objects": major
---

# v5.0 — `project` → `environment` hard rename

The runtime concept previously called **"project"** (per-tenant business
workspace; Org → **Project** → Branch hierarchy; per-project ObjectKernel,
per-project DB, per-project artifact) is now uniformly called
**"environment"**.

This is a **hard rename with no aliases, deprecation shims, or compatibility
layer**. Upgrade requires a coordinated update of CLI, runtime, server, and any
clients calling the REST API.

> Note: "project" in the npm / monorepo sense (the framework itself, `package.json`,
> tsconfig project references, vitest `projects` config) is **unchanged**.

## Breaking changes

### CLI

- Flags renamed:
  - `--project` / `-p` → `--environment` / `-e`  (`os publish`, `os rollback`)
  - `--project-id` → `--environment-id`           (`os dev`)
- Default local env id: `proj_local` → `env_local`.
- Env var: `OS_PROJECT_ID` → `OS_ENVIRONMENT_ID`.
- Command group renamed: `os projects ...` → `os environments ...`
  (`bind`, `create`, `list`, `show`, `switch`).
- Persisted auth-config key: `activeProjectId` → `activeEnvironmentId`.

### HTTP / REST

- Scoped routes: `/api/v1/projects/:projectId/...` → `/api/v1/environments/:environmentId/...`.
- Cloud control-plane routes: `/api/v1/cloud/projects/...` → `/api/v1/cloud/environments/...`
  (including `/cloud/environments/:id/artifact`, `/cloud/environments/:id/metadata`,
  `/cloud/environments/:id/credentials/rotate`, etc.).
- Header: `X-Project-Id` (and lowercase `x-project-id`) → `X-Environment-Id`
  (`x-environment-id`).
- Route param name in handlers: `req.params.projectId` → `req.params.environmentId`.
- Hostname-routing and tenant-resolution code-paths use `environmentId` end-to-end.

### Runtime / spec

- Exported symbols (no aliases):
  - `createSystemProjectPlugin` → `createSystemEnvironmentPlugin`
  - `SYSTEM_PROJECT_ID` → `SYSTEM_ENVIRONMENT_ID`
  - `ProjectArtifactSchema` → `EnvironmentArtifactSchema`
  - `PROJECT_ARTIFACT_SCHEMA_VERSION` → `ENVIRONMENT_ARTIFACT_SCHEMA_VERSION`
  - `ObjectOSProjectPlugin` → `ObjectOSEnvironmentPlugin`
  - `createSingleProjectPlugin` → `createSingleEnvironmentPlugin`
- Plugin identifier strings:
  - `com.objectstack.runtime.objectos-project` → `objectos-environment`
  - `com.objectstack.studio.single-project` → `single-environment`
  - `com.objectstack.multi-project` → `multi-environment`
  - `com.objectstack.runtime.system-project` → `system-environment`
- Provisioning hook: `provisionSystemProject` → `provisionSystemEnvironment`.

### Database / schemas

- Column renames on `sys_metadata` and `sys_metadata_history`:
  `project_id` → `environment_id`.
- Column renames on `sys_activity`: `project_id` → `environment_id` (plus index).
- Object renames in platform-objects metadata: `sys_project` → `sys_environment`
  (lookup targets), `sys_project_member` → `sys_environment_member`,
  `sys_project_credential` → `sys_environment_credential`.
- Auth-context field: `active_project_id` → `active_environment_id`.
- JSON schemas under `packages/spec/json-schema/system/`:
  `ProjectArtifact*.json` → `EnvironmentArtifact*.json` (regenerated at build).

### Automatic forward migration

A new migration `migrateProjectIdToEnvironmentId`
(`packages/metadata/src/migrations/migrate-project-id-to-environment-id.ts`)
auto-runs from `DatabaseLoader.ensureSchema()` on bootstrap and rewrites any
existing `project_id` column on `sys_metadata` / `sys_metadata_history` to
`environment_id` (idempotent, best-effort). Existing rows are preserved.

The legacy reverse migration `migrateEnvIdToProjectId` is retained verbatim
for historical / disaster-recovery use; it is **not** auto-run.

## Migration guide

```diff
-os publish --project proj_xyz
+os publish --environment env_xyz

-curl -H "X-Project-Id: env_xyz" https://api.example.com/api/v1/data/customer
+curl -H "X-Environment-Id: env_xyz" https://api.example.com/api/v1/data/customer

-OS_PROJECT_ID=env_xyz os dev
+OS_ENVIRONMENT_ID=env_xyz os dev

-import { createSystemProjectPlugin, SYSTEM_PROJECT_ID } from "@objectstack/runtime";
+import { createSystemEnvironmentPlugin, SYSTEM_ENVIRONMENT_ID } from "@objectstack/runtime";

-import { ProjectArtifactSchema } from "@objectstack/spec";
+import { EnvironmentArtifactSchema } from "@objectstack/spec";
```

If you maintain a Cloud control-plane deployment, the `cloud` repository must
be updated in lockstep to pick up the new plugin identifier strings
(`single-environment`, `multi-environment`, `objectos-environment`).
