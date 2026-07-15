---
'@objectstack/plugin-sharing': patch
---

fix(plugin-sharing): reconcile every active sharing rule once at boot (#2926 ③). Rule grants are materialized by write hooks, which deliberately skip `isSystem` writes — so seed-loader records never produced `sys_record_share` rows and demo data shipping with matching sharing rules was broken out of the box until each record was touched at runtime. The boot backfill runs on `kernel:listening` — the phase the kernel fires only after every `kernel:ready` handler has settled, including the AppPlugin seed loader — so the reconcile sees the seeded rows rather than racing them. It is idempotent (diff-based reconcile) and best-effort per rule so one broken rule cannot block startup.
