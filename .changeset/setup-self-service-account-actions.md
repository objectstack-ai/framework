---
'@objectstack/platform-objects': patch
---

Add self-service account & invitation actions on `sys_*` objects so the
Setup App can host the day-to-day "account settings" affordances the
standalone Account SPA used to own — no per-page React code needed.

**New actions:**

- `sys_user`
  - `update_my_profile` — wraps `POST /api/v1/auth/update-user` (name + image)
  - `change_my_password` — wraps `POST /api/v1/auth/change-password`
    (current + new + optional revoke-other-sessions)
  - `change_my_email` — wraps `POST /api/v1/auth/change-email`
    (verification email is sent to the new address)
  - `delete_my_account` — wraps `POST /api/v1/auth/delete-user`
    (requires current password)
- `sys_invitation`
  - `accept_invitation` — wraps `POST /api/v1/auth/organization/accept-invitation`
  - `reject_invitation` — wraps `POST /api/v1/auth/organization/reject-invitation`
- `sys_member`
  - `transfer_ownership` — wraps `POST /api/v1/auth/organization/update-member-role`
    with `role: 'owner'` (better-auth auto-demotes the previous owner to admin)

All four `sys_user` self-service actions are gated by
`visible: 'record.id == ctx.user.id'` so they only render on the signed-in
user's own row — they never leak into the admin Users list. The two
`sys_invitation` recipient actions use
`record.email == ctx.user.email && record.status == 'pending'` so they
only appear on the user's incoming invitations.
