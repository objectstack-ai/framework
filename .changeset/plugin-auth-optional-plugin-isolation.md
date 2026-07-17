---
"@objectstack/plugin-auth": patch
---

Contain the blast radius of a failing optional better-auth plugin: core email/password + session auth now stays up when an optional feature plugin throws during initialization.

Previously, one throwing optional plugin (the 15.1.0 incident: `@better-auth/oauth-provider` threw `Cannot set properties of undefined (setting 'modelName')` from a 1.6/1.7 version mix) failed the whole lazily-built better-auth instance, turning EVERY auth endpoint — sign-up, sign-in, get-session — into a 500.

`AuthManager.buildPluginList` now classifies plugins in two tiers. Optional feature plugins (organization, admin, phoneNumber, magicLink, genericOAuth, jwt+oauthProvider as one atomic unit, sso, scim, deviceAuthorization) are constructed through an isolation wrapper: on failure the feature is skipped with a loud actionable `console.error`, recorded in `getDegradedAuthFeatures()`, and its endpoints 404 while core auth keeps working. Security-bearing plugins (bearer, twoFactor, haveIBeenPwned, customSession with its ADR-0069 authGate) still fail hard — better a hard 500 than silently weakened auth (e.g. 2FA-enrolled accounts signing in on password alone).

The OIDC discovery mount (`/.well-known/{oauth-authorization-server,openid-configuration}`) checks the degraded set and skips advertising an IdP whose endpoints did not come up, with a clear error log instead of sending external clients into 404s.
