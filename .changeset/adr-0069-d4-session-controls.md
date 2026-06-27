---
'@objectstack/platform-objects': minor
'@objectstack/service-settings': minor
'@objectstack/plugin-auth': minor
---

Auth: session controls — idle timeout, absolute max lifetime, concurrent cap (ADR-0069 D4, P2)

Adds three `auth` session-control settings (all 0 = off):

- `session_idle_timeout_minutes` — sign a user out after inactivity. Enforced in `customSession`: touches `sys_session.last_activity_at` (throttled to once a minute) and, once the idle window is exceeded, revokes the session.
- `session_absolute_max_hours` — cap total session lifetime regardless of refresh; revoked once `created_at` is older than the cap.
- `max_concurrent_sessions_per_user` — on sign-in, keep the newest N live sessions and revoke the rest (oldest first).

Revocation expires the session in place (`expires_at` set to the past + `revoked_at` / `revoke_reason` stamped on new `sys_session` columns), so better-auth returns no session on the next request → the Console's existing 401 → login redirect handles it (no client change). Note: better-auth garbage-collects expired sessions, so the `revoke_reason` audit row is best-effort; the enforcement (session killed) is not.

Default-off / additive (no upgrade behavior change); per ADR-0049 each setting ships with its enforcement.
