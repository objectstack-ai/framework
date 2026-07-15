---
'@objectstack/service-storage': minor
'@objectstack/platform-objects': patch
---

feat(attachments): edit-on-parent attach, upload-session lifecycle, trash=false (#2970 items 3-5)

Closes the remaining enforce-or-remove / lifecycle items of #2970:

- **Edit-on-parent for attach (item 3, Salesforce parity).** Creating a
  `sys_attachment` now requires EDIT access to the parent record (via the
  sharing service's `canEdit`), not merely read — public-model parents are
  unchanged (canEdit is true for any member), private/owner-scoped parents
  require the caller to own/edit them. Degrades to read visibility when no
  sharing service is present.
- **`sys_upload_session` lifecycle (item 4).** Abandoned / terminal chunked
  upload sessions are reaped by the platform LifecycleService (`transient`;
  TTL 1d past `expires_at`; retention 7d for terminal statuses). Row reap
  only — a reap guard that aborts backend multipart uploads for partial S3
  sessions is a filed follow-up.
- **`sys_attachment.enable.trash` → `false` (item 5, ADR-0049).** The flag is
  `dead` in the liveness ledger (no engine soft-delete reader) and attachment
  deletes are hard (the reap guard reclaims a file's bytes once its last join
  row is gone, so a restore would dangle) — declare the honest state rather
  than claim a restore capability the runtime does not provide.
