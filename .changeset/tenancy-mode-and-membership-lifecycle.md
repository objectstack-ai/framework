---
"@objectstack/types": minor
"@objectstack/plugin-auth": minor
"@objectstack/plugin-security": patch
"@objectstack/cli": minor
---

Tenancy mode as a first-class capability + a single owner for the user→membership
lifecycle (ADR-0093, Phases 1–3).

**Tenancy service (`@objectstack/types`, `@objectstack/plugin-auth`).** plugin-auth
registers a `tenancy` service — the single source of truth for tenancy mode
(`mode`, `isolationActive`, `requested`, `degraded`, `defaultOrgId()`). It derives
`isolationActive` from the presence of the `org-scoping` service, so the
enterprise `@objectstack/organizations` package lights it up with no change.
SecurityPlugin's RLS-strip gate and `/auth/config` (`features.multiOrgEnabled`,
new `features.degradedTenancy`) now consume it instead of re-deriving the fact.

**Fail-fast on degraded tenancy (`@objectstack/cli`, ADR-0093 D5).**
`OS_MULTI_ORG_ENABLED=true` without a working `@objectstack/organizations` now
**refuses to boot** — a deployment that requested tenant isolation must not serve
traffic without it (tenant RLS would be silently stripped). Escape hatch:
`OS_ALLOW_DEGRADED_TENANCY=1` boots in an explicitly branded degraded state
(`features.degradedTenancy`). **This may halt upgrades for deployments that were
silently degraded — intentionally; install the enterprise package or set the
escape hatch.**

**Membership reconciler (`@objectstack/plugin-auth`, ADR-0093 D1–D3, D6).** A
single reconciler composed into better-auth's `user.create.after` hook owns the
"every new user gets a membership" invariant across all creation paths (signup,
admin create-user, import, SSO JIT). It yields to any existing membership (host
hooks win), honors a new `membershipPolicy: 'auto' | 'invite-only'` auth option
(default `auto`), and binds only to an unambiguous target org (single-org default;
multi-org binds nothing). A bounded, idempotent `kernel:ready` backfill covers
pre-existing member-less users in single-org/auto deployments
(`OS_SKIP_MEMBERSHIP_BACKFILL=1` to opt out). The endpoint-level create-user bind
from #2882 now delegates to this shared reconciler.

New env vars: `OS_ALLOW_DEGRADED_TENANCY`, `OS_SKIP_MEMBERSHIP_BACKFILL`. New docs:
Deployment → Tenancy Modes & Membership.
