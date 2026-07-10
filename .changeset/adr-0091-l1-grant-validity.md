---
'@objectstack/spec': minor
'@objectstack/core': minor
'@objectstack/plugin-security': minor
'@objectstack/plugin-sharing': minor
'@objectstack/lint': minor
---

ADR-0091 L1 — grant validity windows: effective-dated assignments, resolution-time filtering, explain expired state, authoring lint.

- **plugin-security (objects)**: `sys_user_position` and `sys_user_permission_set` gain the D1 lifecycle columns — `valid_from`, `valid_until` (half-open `[from, until)`, UTC; null = unbounded, existing rows unchanged), `reason`, `delegated_from`, `last_certified_at`, `certified_by`.
- **core**: new shared predicate `isGrantActive` / `isGrantExpired` (`@objectstack/core`), and `resolveAuthzContext` now filters BOTH grant tables through it (D2, fail-closed — an expired unscoped `admin_full_access` grant no longer derives `platform_admin`). Present-but-unparseable bounds fail closed.
- **plugin-security (explain)**: `buildContextForUser` applies the same filter and returns `expiredGrants`; the principal layer reports the dedicated "held until … — expired" contributor state so "why did access disappear" is self-answering. Spec `ExplainLayerSchema` contributors gain an optional `state: 'active' | 'expired'`.
- **plugin-sharing**: `PositionGraphService.expandPositionUsers` filters expired holders — sharing-rule recipients stop including them at resolution time.
- **lint (D7)**: two new error rules over seed data — `security-grant-expired-at-authoring` (a `valid_until` in the past, or unparseable, is a grant that can never resolve) and `security-delegation-missing-reason` (a `delegated_from` row without `reason` breaks the D3 dual audit). Also re-exported the missing `SECURITY_MASTER_DETAIL_UNGRANTED` constant.

No background job is involved anywhere — per ADR-0049, an expired grant simply stops resolving, in every edition.
