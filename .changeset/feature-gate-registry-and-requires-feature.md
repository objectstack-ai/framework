---
'@objectstack/spec': patch
'@objectstack/platform-objects': patch
---

**Every feature-gated capability is now UI-gated, guardrailed by a flag registry and a declarative `requiresFeature` annotation (#2874, generalizing the create-user phone fix #2871).**

`@objectstack/spec/kernel` gains `PUBLIC_AUTH_FEATURES` — a classification registry for all 13 boolean flags served at `/api/v1/auth/config`: consumption surface (crud/login/status), default semantics (opt-in `== true` vs default-on `!= false`), and the gated spec inputs or an exemption reason. A plugin-auth drift test pins the served key set to the registry, and a platform-objects completeness guard pins the registry to the actual gates in both directions.

`ActionSchema`/`ActionParamSchema` gain `requiresFeature: '<flag>'` (enum-checked), lowered at parse time into the canonical `visible` CEL predicate per the flag's registered semantics, AND-composed with any explicit `visible`, and stripped from the output — renderers and lint see only `visible`, so objectui needs no changes. All 22 hand-written `features.*` gates migrated (behavior-locked by an exact-string matrix test), and the audit gated 17 previously naked capability-dependent actions: the six `sys_user` platform-admin actions, six 2FA actions, and five `sys_oauth_application` actions now hide when their plugin is off instead of rendering buttons that 404.
