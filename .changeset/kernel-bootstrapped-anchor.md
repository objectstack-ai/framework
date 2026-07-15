---
'@objectstack/spec': minor
'@objectstack/core': minor
'@objectstack/plugin-sharing': patch
---

feat(kernel): add `kernel:bootstrapped` lifecycle anchor — the phase that fires after every `kernel:ready` handler has settled but before `kernel:listening` (HTTP socket open). `kernel:ready` handlers run sequentially in plugin-registration order, so a handler that consumes data produced by a later-starting plugin (e.g. the security bootstrap seeds `sys_position`; the app plugin's seed loader inserts records) would race the very rows it needs. `kernel:bootstrapped` is the correct anchor for reconcile/backfill work: every producer's ready handler has finished by the time it fires. Both `ObjectKernel` and `LiteKernel` trigger it. The sharing-rule boot backfill moves from `kernel:listening` to `kernel:bootstrapped` (semantics-only; behaviour unchanged).
