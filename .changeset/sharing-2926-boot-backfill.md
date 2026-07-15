---
'@objectstack/plugin-sharing': patch
---

fix(plugin-sharing): reconcile every active sharing rule once at boot (#2926 ③). Rule grants are materialized by write hooks, which deliberately skip `isSystem` writes — so seed-loader records never produced `sys_record_share` rows and demo data shipping with matching sharing rules was broken out of the box until each record was touched at runtime. The new boot backfill runs after the rule hooks bind, is idempotent (diff-based reconcile), and is best-effort per rule so one broken rule cannot block startup.
