---
"@objectstack/plugin-approvals": minor
---

feat(approvals): declare file attachments on approve/reject decisions

The declared `approval_approve` / `approval_reject` actions on
`sys_approval_request` gain an optional multi-file `attachments` param
(`type: 'file'`, `multiple`). The console renders `type:'file'` action params
through the shared upload widget (objectui ADR-0059) and POSTs the resolved
`attachments: string[]`, so a reviewer can attach supporting files to a
decision through the generic declared-action dialog — letting the approvals
inbox retire its hand-wired attachment composer (objectui#2698).

Purely additive metadata: the decision route already forwards
`body.attachments` to `ApprovalService.decide`, and the
`sys_approval_action.attachments` column (file, multiple) already persists them
(#3266/#3274). No service or route change.
