---
"@objectstack/example-showcase": minor
---

feat(app-showcase): declarative owner-private object (`showcase_private_note`, ADR-0056)

Adds the canonical **declarative `private` OWD** scenario: `showcase_private_note`
declares `sharingModel: 'private'` and an `owner_id` field — and nothing else (no
RLS policy, no owner predicate, no permission-set rule). The engine derives owner
scoping from the OWD baseline + the auto-stamped `owner_id`, so a user sees and
edits only the notes they own. This is the declarative counterpart to the invoice's
hand-written `owner = current_user.email` escape-hatch — for plain "my records are
mine" ownership, an object declares one word and the platform enforces it. Proven
end-to-end (two users, owner isolation on read + by-id read/write) by the new
`showcase-private-owd` dogfood test.
