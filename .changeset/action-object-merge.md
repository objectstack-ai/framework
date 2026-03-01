---
'@objectstack/spec': minor
---

feat: auto-merge actions into object metadata via objectName

- Added optional `objectName` field to `ActionSchema` for associating actions with specific objects
- Added optional `actions` field to `ObjectSchema` to hold object-scoped actions
- `defineStack()` and `composeStacks()` now auto-merge top-level actions with `objectName` into their target object's `actions` array
- Added cross-reference validation for `action.objectName` referencing undefined objects
- Top-level `actions` array is preserved for global access (platform overview, search)
- Updated example apps (CRM, Todo) to use `objectName` on their action definitions
