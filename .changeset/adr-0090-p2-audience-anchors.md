---
'@objectstack/spec': minor
'@objectstack/core': minor
'@objectstack/runtime': minor
'@objectstack/plugin-security': minor
---

ADR-0090 P2 — audience anchors: `everyone`/`guest` builtin positions.

- `EVERYONE_POSITION` / `GUEST_POSITION` constants in `@objectstack/spec`;
  both anchors seeded (system-managed) alongside the builtin identity names.
- Every authenticated principal implicitly holds `everyone` in
  `ctx.positions`, so sets bound to it resolve as ordinary position-bound
  grants — ADDITIVE. The fallback CLIFF is abolished: the configured
  baseline (`fallbackPermissionSet`, default `member_default`) now applies
  in addition to explicit grants instead of only when the user had none,
  and is also seeded as an `everyone` binding (same table/audit/explain
  path as admin-authored defaults).
- Sessionless HTTP principals resolve as `principalKind: 'guest'` holding
  exactly `['guest']`; internal bare contexts are untouched.
- Audience-anchor binding gate: `sys_position_permission_set` writes that
  would bind a high-privilege set (VAMA, delete/purge/transfer, system
  permissions, `'*'` wildcard) to `everyone`/`guest` are rejected at the
  data layer, unconditionally (`describeHighPrivilegeBits` predicate is
  exported and shared with the seed-time validation).
