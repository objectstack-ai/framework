---
'@objectstack/core': patch
'@objectstack/rest': patch
---

perf(core): authenticated requests issued ~16 sequential queries — duplicate authz + repeated localization — now request-scoped memoized

An authenticated REST request resolves its execution context (identity +
RBAC/RLS + localization) many times in a single handler — the data operation
itself, app-nav RBAC filtering, dashboard widget gating, the ADR-0069 auth gate.
Each `resolveExecCtx` pass is the full `resolveAuthzContext` aggregation plus the
localization read (~16 sequential queries), and nothing memoized it, so a request
that resolves twice paid for duplicate authz and repeated localization.

- **`@objectstack/rest`** — `resolveExecCtx` is now memoized per request, keyed by
  the request object (a `WeakMap`, so the entry is collected with the request — no
  TTL, no cross-request leak) and the input `environmentId`. The in-flight Promise
  is cached so concurrent callers share one resolution. The heavy path moved to
  `computeExecCtx`. Anonymous (`undefined`) resolutions are cached too.
- **`@objectstack/core`** — within a single `resolveAuthzContext` pass, `sys_user`
  is now read at most once (the email fallback and the `ai_seat` synthesis shared a
  duplicate query on the API-key path); `resolveLocalizationContext`'s direct-read
  fallback batches `timezone`/`locale`/`currency` into one `sys_setting` query
  (`$in` on `key`) instead of three sequential reads.

No authorization-behavior change — the same roles/permissions/RLS context is
resolved, just without the redundant reads. The `sys_member` reads (per-user roles
vs. all-org-members) are intentionally left distinct (different filters/limits).

Tests: query-counting regressions assert `sys_user` reads once and localization
reads once; new rest-server tests pin the per-request/per-environment memo contract.
