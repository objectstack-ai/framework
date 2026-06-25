---
"@objectstack/plugin-auth": patch
---

feat(auth): surface `features.sso` in the public `/auth/config` response

`getPublicConfig()` reported every other auth capability flag (`oidcProvider`,
`twoFactor`, `multiOrgEnabled`, …) but omitted enterprise SSO, even though the
manager already computes whether the domain-routed `@better-auth/sso` plugin is
wired (`OS_SSO_ENABLED` / `plugins.sso`). Without it the login UI had no signal
to gate on, so it rendered a "Sign in with SSO" button unconditionally — and on
a self-hosted / local deployment where SSO isn't wired, clicking it only then
surfaced "No SSO provider is configured for this email domain."

The config now includes `features.sso`, resolved with the EXACT logic that
decides whether the plugin is mounted in `buildPlugins()`, so the advertised
capability can never disagree with the actual `/sign-in/sso` route. The console
login form consumes this to hide the button when SSO is off (objectui side).
