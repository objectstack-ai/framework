---
'@objectstack/spec': patch
---

docs(spec): rewrite the `isDefault` permission-set docs to describe the actual dual-track behavior (#2926 ②): app-level `isDefault` sets are resolved as the SecurityPlugin's fallback and idempotently auto-bound to the `everyone` anchor at boot (guarded by the high-privilege-bits check), while package-level sets are never auto-bound and instead materialize a `sys_audience_binding_suggestion` an admin confirms. The previous "never auto-bound" wording contradicted the shipped app-level track.
