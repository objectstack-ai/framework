---
'@objectstack/plugin-security': patch
---

fix(plugin-security): bind the fallback permission set to the `everyone` anchor AFTER the anchor is seeded. The baseline auto-bind (ADR-0090 D5) ran earlier in `runBootstrap` than `bootstrapBuiltinRoles`, which creates the `everyone` position — so the `everyone` lookup returned nothing and the app's `isDefault` set was never bound, leaving a fresh deploy's `everyone` empty (personas silently degraded) and a redundant `sys_audience_binding_suggestion` filed for the same set. The auto-bind now runs after `bootstrapBuiltinRoles` and before `syncAudienceBindingSuggestions`, so the documented app-level auto-bind actually happens and the suggestion sync correctly skips the already-bound set.
