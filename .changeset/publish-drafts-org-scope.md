---
"@objectstack/metadata-protocol": patch
---

Publish/discard package drafts in the draft's own org scope, fixing `no_draft` after saving a draft via Studio.

Studio "Save Draft" (`PUT /meta/:type/:name?mode=draft`) never threads the session's `activeOrganizationId`, so the draft row is written env-wide (`organization_id = NULL`). "Publish" (`POST /packages/:id/publish-drafts`) resolves the active org and passed it to `promoteDraft`, which looked the draft up with a strict `organization_id = <org>` equality — so it 404'd (`[no_draft] No pending draft exists …`) on the env-wide row it could never match, even though `listDrafts` had already surfaced that draft to the publish CTA (PR #1852's `$or`). `discardPackageDrafts` had the same latent gap.

`listDrafts` now projects each draft's own `organizationId`, and `publishPackageDrafts` / `discardPackageDrafts` promote / delete each draft in that scope (env-wide stays env-wide, per-org stays per-org). Seed-body capture and the ADR-0067 revert-plan pre-state read are scoped the same way.

Fixes #3115.
