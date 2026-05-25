---
"@objectstack/plugin-auth": patch
---

Fix WebContainer (StackBlitz) sign-up / sign-in failing with
`INTERNAL_SERVER_ERROR: No request state found. Please make sure you are
calling this function within a `runWithRequestState` callback.`

WebContainer reports itself as Node.js but its `node:async_hooks`
implementation does not propagate `AsyncLocalStorage` context across
`await` boundaries. As a result, better-auth's `runWithRequestState`
wrap installed by `handleRequest` was lost as soon as the inner
`customSession` → `getSession()` call chain awaited anything, and every
endpoint that reads request state (e.g. `should-session-refresh`,
`oauth`) threw "No request state found".

`AuthManager` now detects WebContainer and pre-populates better-auth's
global `requestStateAsyncStorage` slot with a synchronous polyfill
before better-auth instantiates its own. The polyfill correctly
propagates the store through awaited promises within a single
`run()` call, which is sufficient for WebContainer's single-flight
dev server. Production environments (real Node, Bun, edge runtimes)
continue to use the native `AsyncLocalStorage` and are unaffected.
