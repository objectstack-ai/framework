---
'@objectstack/spec': minor
'@objectstack/core': minor
'@objectstack/runtime': minor
'@objectstack/objectql': minor
'@objectstack/formula': minor
'@objectstack/rest': minor
'@objectstack/cli': minor
'@objectstack/plugin-security': minor
'@objectstack/plugin-sharing': minor
'@objectstack/plugin-auth': minor
'@objectstack/service-automation': minor
'@objectstack/trigger-record-change': minor
'@objectstack/platform-objects': minor
'@objectstack/metadata': minor
---

ADR-0090 P1 breaking wave — permission model v2 concept convergence.

Pre-launch one-step renames and secure defaults (no compatibility aliases, per
ADR-0090 D3/D4 superseding ADR-0057 D5/D7's alias discipline):

- `sys_role` → `sys_position`, `sys_user_role` → `sys_user_position` (field
  `role` → `position`), `sys_role_permission_set` → `sys_position_permission_set`
  (field `role_id` → `position_id`); `RoleSchema`/`defineRole` →
  `PositionSchema`/`definePosition` with **no `parent`** (positions are flat;
  hierarchy lives on the business-unit tree).
- `ExecutionContext.roles[]` → `positions[]`; the EvalUser/CEL contract
  `current_user.roles` → `current_user.positions` (formula validators updated);
  stack property `roles:` → `positions:`; metadata kinds `role`/`profile` →
  `position` (profile kind removed).
- `isProfile` removed from `PermissionSetSchema` (ADR-0090 D2); `isDefault`
  narrows to an install-time suggestion; `appDefaultProfileName` →
  `appDefaultPermissionSetName` (isDefault-only).
- OWD enum drops legacy aliases `read`/`read_write`/`full`; new optional
  `externalSharingModel` (external dial, `private` default) lands as P1 spec
  shape (ADR-0090 D11).
- **Secure default (D1)**: a custom object with an owner field and NO
  `sharingModel` now resolves `private` (was: fully public). System objects
  keep their explicit posture. Unrecognised stored values fail closed.
- ExecutionContext gains the P1 principal-taxonomy shape (D10):
  `principalKind` / `audience` / `onBehalfOf` (optional, semantics phase in
  later).
- Sharing recipients: `role` → `position` (expanded via `sys_user_position`
  ∪ the better-auth membership transition source); `role_and_subordinates`
  removed — `unit_and_subordinates` now expands the business-unit subtree
  (finishes ADR-0057 D5's re-homing).
