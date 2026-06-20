---
"@objectstack/example-showcase": minor
---

feat(app-showcase): declarative OWD scenarios — owner-private + public-read (ADR-0056)

Adds the two canonical Org-Wide-Default scenarios, each declaring its access policy
in ONE word with no authored RLS:

- `showcase_private_note` — `sharingModel: 'private'`: a user sees and edits only
  the notes they own (owner-only read + write).
- `showcase_announcement` — `sharingModel: 'read'`: every member reads every
  announcement, but only the owner may edit/delete it (public-read).

Both derive scoping from the OWD baseline + the auto-stamped `owner_id` — the
declarative counterpart to the invoice's hand-written `owner = current_user.email`
escape-hatch. Proven end-to-end (two users, real HTTP) by the new
`showcase-private-owd` and `showcase-public-read-owd` dogfood tests, which together
demonstrate the OWD read-visibility axis (`private` hides others' rows; `read`
shows them but still protects writes).
