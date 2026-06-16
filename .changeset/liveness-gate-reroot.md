---
---

chore(spec): re-root the spec-liveness gate on the metadata-type registry. The gate now reads `BUILTIN_METADATA_TYPE_SCHEMAS` (the authorable types the runtime/Studio use) by walking each Zod schema directly, instead of the generated `json-schema/` directory which omits most top-level types (object/field/flow/action/...). Ledgers are re-keyed by metadata type with one-level drill-down for container properties. Onboards 10 types (object, field, flow, action, hook, permission, role, agent, tool, skill — ~295 properties), superseding the category-keyed security/identity/ai ledgers. Repo-internal tooling; no package version impact.
