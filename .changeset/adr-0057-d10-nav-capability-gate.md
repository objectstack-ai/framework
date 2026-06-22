---
"@objectstack/rest": minor
"@objectstack/platform-objects": minor
---

Setup nav: gate Organizations/Invitations on multi-org; enforce `requiresService` server-side (ADR-0057 addendum D10).

`rest-server`'s `filterAppForUser` now honours `NavigationItem.requiresService` — entries
whose named kernel service isn't registered are dropped from the served app metadata
(fail-open when the kernel can't be probed; previously the field was a frontend-only hint).
Applies `requiresService: 'org-scoping'` to the Setup app's Organizations and Invitations
entries, so they surface only in multi-org (multi-tenant) deployments and disappear in
single-tenant. Business Units is intentionally left ungated — it is open per the open/paid
seam + D12 ("pick people by BU"); only the hierarchy rollup capability is enterprise.
