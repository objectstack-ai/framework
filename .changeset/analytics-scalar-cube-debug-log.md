---
"@objectstack/service-analytics": patch
---

fix(analytics): log scalar auto-inferred cubes at debug, not warn

Scalar metric queries (measures only, no `dimensions`/`timeDimensions`) over an
unregistered cube — the first-class `object-metric` "metric over an object" path
— auto-infer a trivial count/sum cube by design. That auto-infer now logs at
`debug` instead of `warn`, so boot/render no longer spams
`No cube registered for "..."` for a non-problem. Grouped queries (explicit
dimension / time bucket) over an unregistered cube keep the `warn`, where a
forgotten cube registration is a real mistake.
