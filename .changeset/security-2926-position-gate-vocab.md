---
'@objectstack/plugin-security': patch
---

fix(plugin-security): re-arm the sys_position system-row write gate after the A4 managed_by rename (#2926 ①). The gate's provenance map still keyed on the legacy `system`/`config` values while rows are now stamped (and boot-normalized to) `platform`/`package`, so platform/package-managed positions — including the `everyone`/`guest` audience anchors — could be physically deleted through the data API once their bindings were removed. The map now guards both the canonical and legacy vocabularies, and the misleading "no runtime path branches on legacy values" safety notes were corrected.
