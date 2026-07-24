---
"@objectstack/spec": minor
---

feat(spec): declared media value shape — ADR-0104 D3 wave 1 (file/image/avatar/video/audio)

`@objectstack/spec/data` now exports `FileValueSchema` — the declared inline
form the platform stores today for the whole `FILE_REFERENCE_TYPES` class
(`file` / `image` / `avatar` / `video` / `audio`): `{ url, name?, size?,
mimeType?, alt?, duration? }` with `url` required. It replaces D1's loose
transitional union, so `valueSchemaFor(fileField, 'stored')` now catches a
malformed media value (a number, an empty object, a url-less `{ name }`
fragment) that was previously waved through as an opaque payload — while still
admitting the opaque id/url string form for import compatibility.

This is **wave 1** of ADR-0104 D3 (see the 2026-07-24 addendum): the value-shape
contract only. It is single-repo, additive, and carries no migration — the
enforcement rides D1's existing warn-first write-path posture, so deployed
records with a legacy media value are not stranded. `accept` / `maxSize` field
config, the `sys_file` reference storage model, GC, and governed download are
**wave 2** (a protocol-major migration), deliberately not in this change.
