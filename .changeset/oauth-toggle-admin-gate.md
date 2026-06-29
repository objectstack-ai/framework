---
'@objectstack/plugin-auth': patch
---

fix(auth): restore the admin gate on POST /admin/oauth-application/toggle-disabled after ADR-0068

ADR-0068 stopped `customSession` from synthesizing `user.role = 'admin'`;
canonical roles now arrive in `user.roles[]` with `user.isPlatformAdmin` as a
derived alias. The OAuth-client enable/disable route was missed in that
migration and still gated on `session.user.role !== 'admin'`, which now rejects
even platform admins (the scalar is no longer synthesized). It now mirrors the
sibling /admin/unlock-user gate: `isPlatformAdmin` / `platform_admin` in
`roles[]`, with the legacy `role` scalar as a fallback.

Also corrects the now-stale `customSession()` doc comment in auth-manager that
still described the removed `user.role = 'admin'` overwrite.
