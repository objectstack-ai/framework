---
"@objectstack/runtime": patch
---

fix(runtime): drive sandbox host calls with deferred promises and a deadline-bounded pump

The QuickJS sandbox exposed `ctx.api.object(x).find/update/...` via `newAsyncifiedFunction`, which unwinds the WASM stack per host call and forbids a second call while the first is unwound. A script awaiting two host calls in sequence (e.g. an action doing `findOne()` then `update()`) drove the second call from a continuation resumed inside `executePendingJobs`, corrupting the wasm heap (`memory access out of bounds` / `p->ref_count == 0`) or exhausting the fixed 1000-iteration pump budget — surfacing as `action '…' did not resolve after 1000 pump iterations`.

Host API methods are now exposed as deferred QuickJS promises (`vm.newPromise()`), so sequential `await`s compose with no stack unwinding, and the pump loop is bounded by the configured `timeoutMs` instead of a fixed iteration cap. Host **method** calls now require `await` (the `.object(name)` proxy getter stays synchronous); a stuck/never-settling host call is cut off with a clear timeout error.
