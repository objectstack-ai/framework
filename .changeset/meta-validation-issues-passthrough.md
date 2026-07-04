---
"@objectstack/metadata-protocol": patch
"@objectstack/runtime": patch
---

fix(runtime): carry spec-validation issues (and the 422 status) through metadata save/publish errors

`protocol.saveMetaItem` already validates a metadata draft against its spec Zod
schema and, on failure, throws a rich error: HTTP `status: 422`, `code:
'invalid_metadata'`, and a structured `issues: [{ path, message, code }]` array
(field-anchored, `superRefine` issues included). But the HTTP dispatcher's catch
blocks collapsed all of that to a single message — the save path even hardcoded
`400` — so a client could only show a generic "failed validation" banner with no
way to point at the offending field. The publish path was worse: the per-draft
catch in `publishPackageDrafts` flattened each failure into `{ type, name, error
}` and **dropped `issues` entirely**.

Now:
- A new `errorFromThrown(e, fallbackStatus)` dispatcher helper preserves the
  error's own `status` (so validation surfaces as **422**, not a downgraded 400)
  and attaches `{ code, issues }` under `error.details` when present. Errors that
  carry neither behave exactly as before. Used by the metadata **save** (`PUT
  /meta/:type/:name`) and **publish** (`POST /packages/:id/publish-drafts`)
  catch sites.
- `publishPackageDrafts` now carries `issues` into each `failed[]` entry, so a
  validation failure during publish is field-anchored too (it previously kept
  only the message).

This is the server half of "surface validation at the save/publish moment, on
the field" — the Studio can now map each issue back to its input instead of
showing a wall-of-text banner. Purely additive to the error payload; the only
behavior change is the more-correct 422 (was 400) for a failed metadata save.
