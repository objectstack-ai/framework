---
"@objectstack/platform-objects": patch
---

Complete the ADR-0057 `sys_department` → `sys_business_unit` rename in the Setup app and across the object's i18n (en / zh / ja / es).

- Setup nav entry "Departments" → "Business Units" (`nav_departments` → `nav_business_units`).
- `sys_business_unit` / `sys_business_unit_member` field **labels and descriptions** in the object definitions now read "business unit" instead of "department" (the generated `en` labels had been hand-updated ahead of the def; the def was the stale source).
- All four locales' generated object translations aligned to 业务单元 / ビジネスユニット / Unidad de negocio.

Intentionally preserved: the `kind` enum value `department` (a business unit can be *of kind* department) and the multi-concept node descriptions that list kinds.
