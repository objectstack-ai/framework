---
'@objectstack/plugin-auth': patch
---

Auth: org-scope registered SSO/SAML providers so any org admin can manage them (ADR-0024 / cloud#551)

`@better-auth/sso`'s provider-management endpoints (delete / update / domain verification) gate ORG-LESS providers on `provider.userId === caller` — only the original registrar could manage them, so a second org admin couldn't delete or verify an IdP someone else registered. The register bridges now resolve the caller's active organization (best-effort, via a `/get-session` re-dispatch) and scope the provider to it, so management gates on `isOrgAdmin` instead — **any** org owner/admin can manage the environment's IdPs. Falls back to org-less (no behavior change) when no active org is set.

Verified E2E: an OIDC provider registered through the form lands with `organization_id` set to the env's org (was null); register + delete still succeed.
