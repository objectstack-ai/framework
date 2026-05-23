---
'@objectstack/spec': patch
'@objectstack/runtime': patch
'@objectstack/platform-objects': patch
'@objectstack/plugin-security': patch
'@objectstack/plugin-hono-server': patch
'@objectstack/rest': patch
---

Scope `sys_user` visibility to fellow organization members.

The default RLS policy on `sys_user` was `id = current_user.id`, which meant
@-mention pickers, owner/assignee lookups, reviewer selectors and the user
roster all returned just the current user. The RLS compiler doesn't support
subqueries, so a `id IN (SELECT user_id FROM sys_member ...)` policy isn't
expressible.

This change:

1. Pre-resolves `org_user_ids` (the IDs of all users in the active org) into
   `ExecutionContext` in **all three** REST entry-point resolvers
   (`@objectstack/rest`, `@objectstack/runtime`, `@objectstack/plugin-hono-server`).
2. Adds the field to `ExecutionContextSchema` so it survives Zod parsing.
3. Adds an `org_user_ids` field to the RLS compiler's user context.
4. Adds a new `sys_user_org_members` policy (`id IN (current_user.org_user_ids)`)
   to both `member_default` and `viewer_readonly` permission sets, alongside
   the existing `sys_user_self` policy. The RLS compiler OR-combines them, so
   users see themselves AND their org collaborators.

Capped at 1000 members per request. Large enterprises should plug in a
directory cache or split per workspace.
