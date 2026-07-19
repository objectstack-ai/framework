---
'@objectstack/runtime': patch
---

fix(runtime): honor a hook body's declared `timeoutMs` so nested cross-object writes aren't clamped to 250ms (#1867)

Hook bodies run in the QuickJS sandbox with a default 250ms timeout. The runner
folded that engine default straight into `Math.min(...)` when resolving the
effective timeout, so it *always* dominated for hooks: a body that declared a
larger `timeoutMs` (the spec permits up to 30_000ms — `ScriptBody.timeoutMs`) to
give a legitimate nested write — "when a child changes, update the parent" —
room to settle was silently clamped back to 250ms and killed mid-flight. The
declared knob was never enforced.

The engine default is now a FALLBACK used only when no explicit timeout is
supplied, not a hard ceiling. An explicit `body.timeoutMs` (and/or an enclosing
hook/action timeout) is honored; when both are present the smaller wins. Bodies
that declare nothing still get the 250ms hook / 5000ms action default, and a
body may still LOWER its own timeout below the default.

This clears the last reliability blocker for nested cross-object writes from
hooks — the sandbox crash itself (`memory access out of bounds`) was already
fixed by the deferred-promise host-call model — so header/rollup fields no
longer need denormalized, hand-maintained workarounds.
