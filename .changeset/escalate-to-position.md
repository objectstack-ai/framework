---
'@objectstack/spec': patch
'@objectstack/plugin-approvals': minor
'@objectstack/lint': minor
---

SLA escalation `escalateTo` is position-first (ADR-0090 D3 follow-up to the `position` approver type).

- **spec**: `ApprovalEscalationSchema.escalateTo` is documented as a position machine name or a
  specific user id (was "User id, role, or manager level" — the same pre-D3 'role' trap the
  `position` approver type fixed); the Studio xRef picker kind moves `role` → `position`.
- **plugin-approvals**: on escalation, `escalateTo` now expands position holders via
  `sys_user_position` ∪ the `sys_member.role` transition source (ADR-0057 D4) for both the
  `reassign` approver hand-off and the `notify` audience. An empty expansion falls back to
  treating the value as a literal user id, so configs naming a specific user keep working
  unchanged. The audit trail keeps the authored target.
- **lint**: new `approval-escalation-reassign-no-target` warning — `escalation.action: 'reassign'`
  with no `escalateTo` silently degrades to a notify at runtime; the fix-it prescribes a position
  or user id target (or `action: 'notify'`).
