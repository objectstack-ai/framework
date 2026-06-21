---
"@objectstack/platform-objects": minor
---

Add `manager_id` (self-lookup) to `sys_user` — the reporting chain that the ADR-0057 `own_and_reports` hierarchy scope walks.

The `own_and_reports` scope was implemented in the resolver but **unbacked**: nothing on `sys_user` modelled a manager, so it always degraded to owner-only. This adds the field (+ en/zh/ja/es labels) and extends the scope-depth dogfood to prove the scope end-to-end — a user now sees their own records plus everyone down their `manager_id` chain.
