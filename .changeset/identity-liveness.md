---
---

chore(spec): extend the spec-liveness gate to the `identity` category. Governs `Role` (the one authorable RBAC type: `name`/`label`/`description` live, `parent` dead — org hierarchy uses `sys_department`, not `sys_role.parent`); the SCIM-protocol DTOs and better-auth runtime tables (User/Session/Account/…) are classified `internal`. Same audit as security; repo-internal tooling, no package version impact.
