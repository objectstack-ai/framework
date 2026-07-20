---
"@objectstack/spec": minor
"@objectstack/plugin-approvals": minor
---

feat(approvals): server-computed `viewer` capability for precise decision-action gating

`getRequest` / `listRequests` now attach a per-viewer block —
`viewer: { can_act, is_submitter }` — computed from the caller's context
(`ApprovalRequestRow.viewer`):

- `can_act` — the caller is a *current pending approver* (their user id is in the
  request's resolved `pending_approvers` while it is still `pending`). This is
  the same check the decision methods authorize with, so it already reflects
  position/team/manager resolution — strictly more accurate than a client-side
  identity guess.
- `is_submitter` — the caller submitted the request.

The declared decision actions on `sys_approval_request` now gate on it: approver
actions (approve/reject/reassign/send-back/request-info) use
`record.viewer.can_act`; submitter levers (remind/recall/resubmit) use
`record.viewer.is_submitter`. Previously approver actions only trimmed the
non-pending case, so a submitter viewing their own pending request saw buttons
they couldn't use (the backend 403'd); a position-addressed approver could be
wrongly hidden by the old client heuristic. Where `viewer` is absent (a row
surfaced outside a service read with a user context), the predicate fails closed.
