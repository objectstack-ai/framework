---
"@objectstack/platform-objects": patch
---

fix(setup): drop Advanced nav entries for non-listable objects (sys_verification, sys_device_code)

Dogfooding every Setup menu surfaced two Advanced entries that always render
"无法加载记录 / failed to load": **Verifications** (`sys_verification`) and
**Device Codes** (`sys_device_code`). Both objects deliberately omit `list`
from `apiMethods` (sensitive, ephemeral secrets — verification tokens and OAuth
device-grant codes are not meant to be browsed), so the generic object/list-view
menu can only ever 405. Removed both nav entries (and their orphaned zh labels);
the objects remain reachable by id. Re-adding a browse menu would require
enabling `list` on the object — a security decision, not a nav fix.
