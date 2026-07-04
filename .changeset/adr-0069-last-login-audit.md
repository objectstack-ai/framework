---
"@objectstack/platform-objects": minor
"@objectstack/plugin-auth": minor
---

feat(auth): last-login audit fields — sys_user.last_login_at / last_login_ip (ADR-0069 D7)

Completes the ADR-0069 D7 identity-field set: `sys_user.last_login_at` and
`sys_user.last_login_ip` are stamped on every successful `/sign-in/email` by
`AuthManager.stampLastLogin` (a best-effort after-hook, independent of the
lockout-accounting path so it runs even when lockout is disabled). The IP is
taken from the trusted forwarded headers (`x-forwarded-for` →
`cf-connecting-ip` → `x-real-ip`), the same precedence as the D5 IP allow-list
middleware, and capped to the 45-char column width. Both fields are
system-managed, read-only, and land in the Admin group of `sys_user`.

The rest of ADR-0069 P1 (password complexity/history/expiry, HIBP, account
lockout, enforced MFA) was already implemented; this fills the one missing D7
field pair. ADR-0069 status updated Proposed → Accepted (P1/P2 implemented)
with an implementation-status matrix reflecting what is landed vs the remaining
P2 gaps (per-org IP ranges, shared-store rate limiting).
