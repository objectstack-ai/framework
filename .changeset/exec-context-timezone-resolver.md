---
"@objectstack/runtime": minor
"@objectstack/spec": minor
---

feat(runtime): resolve a reference timezone onto ExecutionContext (ADR-0053 Phase 2 foundation)

Adds `ExecutionContext.timezone` (optional IANA zone) and resolves it once per request in `resolveExecutionContext`, with precedence **user preference → org default → `UTC`**:

- User override: `sys_user_preference` row `(user_id, key='timezone')`.
- Org default: the tenant-scoped `sys_setting` `(namespace='localization', key='timezone', scope='tenant')` — one org per physical tenant (ADR-0002), so no tenant_id filter is needed.
- An invalid IANA zone is ignored and resolution falls through; every read is defensive and never blocks auth.

This is **pure plumbing with no behavior change**: nothing reads `ctx.timezone` yet, and an absent value resolves to `UTC` (today's behavior). It is the foundation the rest of ADR-0053 Phase 2 consumes — tz-aware `today()`/`daysFromNow()` (#1980), datetime rendering (#1981), and analytics bucketing (#1982). A discoverable `localization` settings manifest for the org default is a follow-up; the resolver already reads the row if present.

Part of #1978.
