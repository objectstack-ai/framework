---
'@objectstack/runtime': patch
---

refactor(security): migrate the handleSecurity admin gate to shouldDenyAnonymous (#2567 follow-up)

The dispatcher's `/security/suggested-bindings` admin surface was the last HTTP
seam still hand-rolling the `!userId && !isSystem → 401` check. It now delegates
to the shared `shouldDenyAnonymous` decision like every other seam — with
`requireAuth: true` hardcoded, preserving its UNCONDITIONAL semantics (an admin
surface denies anonymous callers even on a `requireAuth: false` demo deployment).
The 401 body adopts the shared shape (`code: 'unauthenticated'`).

Deliberately NOT migrated: `handleNotification`'s `!userId` check — that is a
"needs a user identity" predicate (the inbox is keyed by userId; a system
context has no inbox), not an anonymous-posture decision; migrating it would
change semantics.
