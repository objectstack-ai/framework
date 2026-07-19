---
'@objectstack/runtime': patch
---

perf(runtime): stop the sandbox pump loop from idle-spinning while awaiting a host call (#3233)

The QuickJS hook/action runner drives a script's async continuations with a
pump loop that, on every iteration, yielded via `setImmediate` and then drained
the VM job queue. While the body was only *waiting* on an in-flight host promise
(a slow `ctx.api` read/write, or one call that settles after many event-loop
turns), that queue was empty every iteration, so the loop woke ~200k times/sec
doing nothing — a ~50,000-iteration burn for a 250ms wait.

The yield is now adaptive: it stays on `setImmediate` (near-zero latency) while
the script is making progress, and once a pump executes zero VM jobs it ramps up
to a small capped `setTimeout` (≤8ms). Any executed job — a settled host call, a
resumed continuation — resets it to the fast path, so sequential host calls and
multi-turn work keep their low latency; only a genuinely idle wait backs off.
Deadline enforcement and every existing pump-budget/timeout/transaction
guarantee are unchanged.
