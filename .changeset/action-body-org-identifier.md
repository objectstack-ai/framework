---
"@objectstack/runtime": patch
---

**Extend the blessed `organizationId` org name to the action-body surface (follow-up to #3280).** Hooks now teach `ctx.user.organizationId` / `ctx.session.organizationId` as the blessed name for the caller's active org; action bodies — the sibling authoring surface that shares the same sandbox runner — were left behind: the REST dispatch path exposed only `ctx.user.tenantId` (the deprecated name) and no `ctx.session` at all, and the MCP `run_action` path exposed neither.

Both action-dispatch sites (`handleActions`, MCP `runAction`) now populate:

- **`ctx.user.organizationId`** — the blessed name (matches the `organization_id` column and `current_user.organizationId` in RLS); `ctx.user.tenantId` is kept as a deprecated alias with the identical value on the REST path.
- **`ctx.session`** (`{ userId, organizationId, tenantId, roles? }`) — mirrors the hook `ctx.session` shape, `undefined` for a context-less / self-invoked call.

Action bodies execute trusted (the `ctx.engine` / `ctx.api` facade bypasses RLS/FLS), so a body that must scope by org has to read it from `ctx` — now under the same name a hook author uses. Additive and behavior-preserving; the objectstack-ui skill documents the action-body `ctx` and the `organizationId` read.
