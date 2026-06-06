---
'@objectstack/runtime': minor
---

feat(runtime): API-key generation endpoint — show-once `sys_api_key` (ADR-0036, closes framework#1629)

Adds `POST /api/v1/keys` — the only path that mints a `sys_api_key`. Phase 1a
shipped key *verification* and the `generateApiKey()` primitive; this is the
missing *generation* half that unblocks the self-serve connect flow.

- Requires an authenticated principal; returns the **raw secret exactly once**
  (`{ id, name, prefix, key }`). Only the sha256 **hash** is persisted — the raw
  key is never stored, logged, or re-displayable.
- **Security (zero-tolerance):** `user_id` is pinned to the caller and never read
  from the body (no impersonation); the body is whitelisted to `name` (+ optional
  validated future `expires_at`) — any `key`/`id`/`user_id`/`revoked` in the body
  is ignored, so a caller cannot forge a known-secret or escalate. The row is
  written with an elevated `{ isSystem: true }` context (sys_api_key is
  protection-locked) with server-controlled contents. Anonymous → 401;
  non-POST → 405; past/unparseable `expires_at` → 400.
- `scopes` are intentionally NOT accepted from the body in v1 (the verify path
  adds scopes to permissions, so honouring arbitrary body scopes would be an
  escalation vector); a generated key acts exactly AS the caller via `user_id`
  resolution. Scoped/narrowing keys need subset-enforcement — deferred.

11 security tests (show-once, hash-not-raw persisted, round-trip auth via the
verify path, impersonation blocked, forgery blocked, 401/405/400, expiry
end-to-end). Full runtime suite green (376).
