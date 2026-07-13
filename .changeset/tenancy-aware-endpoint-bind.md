---
"@objectstack/plugin-auth": patch
---

fix(auth): create-user membership bind is tenancy-mode-aware; export the ADR-0093 host API

Multi-org runtime verification (real `@objectstack/organizations` linked into a
live stack) caught a gap in the #2884 endpoint bind: it resolved its target org
via `resolveDefaultOrgId` (slug='default' first), so in a multi-org deployment —
where the bootstrap default org coexists with real tenant orgs — `/admin/create-user`
would have bound the new user into the default org, violating ADR-0093 D3
("the framework never guesses in multi mode"). The bind now consults the
`tenancy` service (`getTenancy` on the endpoint deps): single mode → default org,
multi mode → no bind. Verified live: multi-org create-user and sign-up both leave
the new user member-less (invites / host hooks own membership there); single-org
behavior unchanged.

Also exports `reconcile-membership` and `tenancy-service` from the package index
as the public host API, and adds dogfood integration tests driving the REAL
better-auth pipeline: sign-up membership via the reconciler hook alone, backfill
bind + idempotency, invite-only refusal, and the yield-to-host-membership rule.
