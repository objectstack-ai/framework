---
'@objectstack/account': patch
---

Account: fix post-login redirect to `/organizations/new` in single-tenant
mode when the freshly-authenticated user has no organization yet.

The auth-redirect effect in `login.tsx` / `register.tsx` decided where to
send the user as soon as `session` populated, but `features` (from
`GET /api/v1/auth/config`) could still be `null` for a beat. The check
`features?.multiOrgEnabled === false` then evaluated to `false`, so the
"no orgs" branch fell through to `navigate({ to: '/organizations/new' })`
— exactly the page that's gated off in single-tenant deployments. The
wizard then bounced to `/organizations` (empty list), producing a jarring
"create organization is not supported" flash.

Both routes now wait for `features` to resolve before deciding the no-org
redirect target, so single-tenant logins land on `/` (or their original
`redirect=` target) directly.
