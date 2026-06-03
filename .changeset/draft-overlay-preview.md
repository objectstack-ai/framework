---
'@objectstack/objectql': minor
'@objectstack/runtime': patch
---

feat(metadata): draft-overlay reads so an admin can render the console off pending drafts before publish

ADR-0033's loop is `build (draft) → review → publish`, but "review" was only a JSON diff — the one thing that actually confirms an AI/hand-authored change (the rendered object page / kanban / form / nav) only existed *after* publish. That forces publishing unreviewed metadata just to look at it, defeating the draft gate.

This adds a request-scoped **draft-overlay read mode** to the metadata resolution layer:

- `getMetaItems({ …, previewDrafts })` — after the active overlay, overlays `state='draft'` rows on top (draft WINS on name collision; draft-only items surface too). Drafts are never hydrated into the process-wide SchemaRegistry.
- `getMetaItem({ …, previewDrafts })` — non-strict: prefers a draft row if one exists, else falls back to the active value (unlike the strict `state:'draft'` mode, which 404s `no_draft`).
- Every overlaid item is tagged `_draft: true` so the UI can badge it and show a "preview" banner.
- The runtime HTTP dispatcher threads `?preview=draft` on `GET /metadata/:type` and `GET /metadata/:type/:name` into these reads.

The same overlay also unblocks the AI authoring agent referencing its own just-drafted objects (a follow-up will point `list_metadata` at it). Admin gating of the `?preview=draft` flag is a deliberate follow-up step.

Note: a brand-new draft object has no physical table until publish, so preview renders its *shape* (form/view/kanban/nav) but shows no data; field-additions to existing objects preview fully.
