---
'@objectstack/plugin-security': patch
---

fix(plugin-security): stop clobbering admin-edited capability `scope` on boot (#2909 T3). `scope` is an admin-editable classification select on sys_capability, but the curated seeder refreshed it on every boot alongside label/description — silently reverting admin reclassifications. It is now seed-once: written on insert, never refreshed (a curated scope change in a new platform version requires a data migration; recorded in the ADR-0094 addendum).
