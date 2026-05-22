---
"@objectstack/rest": minor
"@objectstack/objectql": patch
---

PR-10d.4 — REST plumbing for the metadata repository write path.

- `PUT /api/v1/meta/:type/:name` (and the compound `:type/:section/:name` variant)
  now forwards the `If-Match` header to `saveMetaItem` as `parentVersion`, and
  `X-Actor` (or `req.user.id`) as `actor`. ETag-style quotes are stripped.
- A failed optimistic-lock check surfaces as HTTP 409 with body
  `{ "error": "...", "code": "metadata_conflict" }` (no protocol changes —
  `sendError` already honoured `error.status` + `error.code`).
- Added a real-engine integration test for the repository write path
  (`protocol-save-meta-repo-path-real-engine.test.ts`) — addresses the
  PR-10d.3 rubber-duck stub-drift concern by exercising
  `ObjectStackProtocolImplementation.saveMetaItem` through `new ObjectQL()`
  with an inline in-memory driver. Covers insert→update version bump,
  parentVersion conflict, checksum length, and plural→singular normalization.

Default behaviour unchanged: the repository write path remains opt-in via
`options.useRepositoryWritePath` / `OBJECTSTACK_USE_REPOSITORY_WRITE_PATH=1`.
Flag flip and legacy path removal will follow in a separate post-soak PR.
