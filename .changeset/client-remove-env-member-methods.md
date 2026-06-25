---
"@objectstack/client": patch
---

chore(client): remove dead `projects.*` env-member SDK methods (cloud#533 / ADR-0024 D9)

Removes `projects.listMembers` / `addMember` / `updateMemberRole` / `removeMember`,
which called `GET/POST/PATCH/DELETE /api/v1/cloud/environments/:id/members`. Those
control-plane endpoints were deleted in cloud#533 (retiring `sys_environment_member`),
so the methods returned 404. Org membership/invites now flow through the better-auth
`organization` plugin (`organization.inviteMember` / `listMembers` / …); objectui
already uses `organization.*` and no in-repo callers remained.

The `membership` field on the `projects.get()` response is unchanged — cloud#533 still
returns it on the single-env GET (re-sourced to the caller's org `sys_member` role).
