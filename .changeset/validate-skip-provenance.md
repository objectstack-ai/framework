---
"@objectstack/objectql": patch
---

fix(objectql): validate a declared required `organization_id`/`tenant_id` instead of silently skipping it by name (#1592)

`validateRecord` skipped required-checks for any field literally named
`organization_id` / `tenant_id`. That's correct only for the engine-INJECTED
tenant column (already marked `system: true`, skipped via provenance). A
genuinely DECLARED required business field with that name — e.g. `sys_team`'s
`organization_id` lookup, on a `managedBy: 'better-auth'` table where the column
is NOT injected — was silently bypassed and reached the driver as NULL (a DB
constraint error instead of a clean `400 required`). Removed the two names from
the by-name skip set; injected columns remain skipped via `def.system` /
`def.readonly`.
