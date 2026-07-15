---
'@objectstack/service-storage': minor
---

feat(attachments): authenticated, parent-scoped downloads for attachments files (#2970)

Closes item 2 of #2970. The storage download endpoints (`GET /storage/files/:fileId`
and `/files/:fileId/url`) were anonymous capability URLs — anyone holding a
`fileId` could mint a download without a session or any access check.

For `scope === 'attachments'`, non-`public_read` files, both endpoints now gate
on a new `authorizeFileRead` seam: `401 AUTH_REQUIRED` without a session, `403
ATTACHMENT_DOWNLOAD_DENIED` when the caller is neither the file's owner nor able
to READ a record the file is attached to (parent-derived, resolved through the
full caller context via `resolveAuthzContext`), and otherwise a **short-lived**
signed URL (`downloadTtl`, default 300s). Non-attachments files (field files,
avatars, org logos — embedded in `<img src>` which cannot carry a bearer token)
keep the stable anonymous capability URL, and bare kernels/tests without the
seam wired stay open (back-compat).
