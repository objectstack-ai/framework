---
'@objectstack/runtime': patch
---

perf(runtime): drop asyncify — sandbox runs on the sync QuickJS variant (ADR-0102 D2, #3296)

Phase 2 of #3275. The QuickJS sandbox switches from the asyncify build
(`newAsyncContext`) to the already-installed sync release variant
(`newQuickJSWASMModule().newContext()`), keeping one physically isolated WASM
module per invocation (ADR-0102 D2/D4). Asyncify's only justification — suspending
the WASM stack across a host call — disappeared with the #1867 deferred-promise +
pump redesign, so nothing depended on it. Wins: smaller binary, faster
compile/instantiate, faster per-instruction, and removal of an entire class of
suspended-stack failure modes.

Also fixes a latent resource leak surfaced by the stricter sync teardown: host
`ctx.api` calls hand the VM a `vm.newPromise()` deferred that was never
`dispose()`d (the newPromise contract requires it). The asyncify build tolerated
the leak; the sync build's `JS_FreeRuntime` aborted (`Assertion failed:
list_empty`) when a context was torn down with a pending, never-settled host call
(the timeout path). Deferreds are now tracked and disposed before context
teardown.

Memory: the sync `QuickJSWASMModule` has no `dispose()`; its WebAssembly instance
+ linear memory are GC-reclaimed when the reference is dropped. A new RSS soak
test guards that per-invocation modules don't ratchet RSS.
