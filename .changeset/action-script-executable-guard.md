---
"@objectstack/spec": minor
---

spec(action): a `script` action must declare an executable binding — reject at
author/compile time when it has neither an inline `body` nor a `target`.

A `type: 'script'` action with no `body` and no `target` registers no runtime
handler: `AppPlugin` skips it, and invoking it falls through to the wildcard
lookup and fails with `Action '<name>' on object '*' not found` (the #2169
"Mark Done" bug). The shape was schema-valid and passed coverage tests, so the
break only surfaced when a user clicked the button.

`ActionSchema` now enforces the invariant via `superRefine`: `script` requires
`body || target` (mirroring the existing "non-script types require `target`"
rule). `body`-bound actions are auto-registered by the runtime; `target`-bound
actions name a function wired imperatively (e.g. via `onEnable`). This only
rejects configurations that were already non-functional at runtime — verified
against the full monorepo build (every shipped bundle still compiles).
