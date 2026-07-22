---
"@objectstack/objectql": patch
---

fix(objectql): accept relative and inline URLs on `url` fields

The record-validator's `url`-type check required an absolute `scheme://` URL,
so it rejected the **root-relative** value the platform's own storage service
returns for an uploaded file. The console avatar uploader
(`createObjectStackUploadAdapter`) PUTs the image to storage and then writes
`sys_user.image` (a `Field.url`) = `/api/v1/storage/files/<id>`; that failed
`invalid_url` and — on the better-auth `update-user` path — surfaced as a
failed profile save (the "上传用户头像报错" avatar-upload bug).

`URL_RE` now also accepts root-/protocol-relative refs (`/path`, `//host/path`)
and the `data:` / `blob:` inline forms, in addition to `scheme://…`. A bare
scheme-less string with no leading `/` (e.g. `"notaurl"`) is still rejected.
Verified end-to-end in the running Console: avatar upload → display → replace →
remove all succeed.
