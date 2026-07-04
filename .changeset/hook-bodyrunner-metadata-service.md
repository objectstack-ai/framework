---
'@objectstack/objectql': patch
'@objectstack/metadata-protocol': patch
'@objectstack/runtime': patch
---

Runtime-authored (Studio) hooks now execute their `body` (#2588).

Previously a hook authored at runtime (saved via `protocol.saveMetaItem` /
`publish-drafts`) loaded into the registry but its L1/L2 `body` never ran — the
metadata-service bind path passed no `bodyRunner` and the engine's
`_defaultBodyRunner` fallback was never installed, so the binder silently
skipped the body. Now:

- `AppPlugin` installs the QuickJS-sandboxed hook body runner as the engine
  default at boot (`engine.setDefaultBodyRunner`), so bind paths without an
  explicit runner can execute bodies. Opt out with
  `OS_DISABLE_AUTHORED_HOOKS=1` to keep runtime-authored hook bodies inert.
- `ObjectQLPlugin` re-binds runtime-authored hooks from their `sys_metadata`
  rows at `kernel:ready` (cold boot — env-scoped kernels never surfaced these
  rows before), on `metadata:reloaded`, and on every hook mutation through the
  new `protocol.onMetadataMutation` listener — so saves, publishes, edits, and
  deletes take effect live, without a restart. Package-artifact hooks are
  excluded from this bind path (AppPlugin already binds them with an explicit
  runner) so they no longer risk double execution.
- `@objectstack/metadata-protocol` gains a server-side
  `onMetadataMutation(listener)` API: `saveMetaItem` / `publishMetaItem` /
  `deleteMetaItem` notify subscribers after persistence succeeds.
