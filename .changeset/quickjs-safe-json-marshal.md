---
'@objectstack/runtime': patch
---

Sandbox: stop `QuickJSScriptRunner` from crashing when a hook context holds a non-serialisable host object.

`installCtx` marshalled `ctx` into the QuickJS sandbox with a bare `JSON.stringify`. If the context (or anything reachable from it) held a live `setTimeout`/`setInterval` handle, `JSON.stringify` threw `TypeError: Converting circular structure to JSON` (`Timeout._idlePrev -> TimersList._idleNext -> …`) and took the whole hook down (#2674). Marshalling now goes through a shared `safeJsonStringify` that drops circular back-edges via a path `WeakSet` and coerces `BigInt` to a string, so only JSON-safe leaves cross the boundary and the body still runs.
