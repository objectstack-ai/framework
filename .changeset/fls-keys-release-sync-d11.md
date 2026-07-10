---
"@objectstack/lint": minor
"@objectstack/example-showcase": patch
"@objectstack/spec": patch
---

Permission-zoo audit follow-ups:

**FLS keys must be object-qualified (`security-fls-unqualified-key`, error).**
The runtime evaluator matches field-permission keys by `<object>.<field>`
prefix — a bare `budget` key matches NOTHING and the declared masking
silently never enforces. The showcase itself shipped exactly that bug: its
contributor FLS block (bare `budget`/`spent`/`budget_remaining`) was a
runtime no-op, and the "FLS proof" in earlier verification was actually a
validation-rule rejection. Fixed: keys qualified
(`showcase_project.budget` …), a new D7 lint rule rejects bare keys at
compile time with a fix-it, and the permission-zoo dogfood now proves the
served pipeline denies a contributor's budget write while allowing ordinary
field edits.

**Release pipeline: PROTOCOL_VERSION auto-sync.** `changeset version` now
runs `scripts/sync-protocol-version.mjs`, regenerating the handshake
constant from the spec package major. Release PRs opened by
changesets/action with the default GITHUB_TOKEN never trigger CI (GitHub's
anti-recursion rule), so the lockstep guard could only fire AFTER a release
merged — the drift class that broke main at 14.0.0 (#2769) is now fixed at
version time, the one spot that cannot be skipped.

**D11 `externalSharingModel` honestly marked.** The dial has no runtime
consumer yet (authoring lint + Studio badges only); its liveness entry
moves from a bespoke `authorable` status to the documented `planned` +
`authorWarn`, and the sharing docs / design doc / showcase comments now say
explicitly that evaluation of external principals lands with the
principal-taxonomy phase (#2696).
