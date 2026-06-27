---
'@objectstack/plugin-auth': patch
---

Auth: surface "SSO Providers" in the Setup app nav when SSO is enabled (ADR-0024 / cloud#551)

The `sys_sso_provider` admin object (register / list / delete external OIDC IdPs) had no navigation entry, so an admin could only reach it by direct URL. `AuthPlugin` now contributes an **"SSO Providers"** entry into the Setup app's **Access Control** group — but only when the external-IdP RP is wired (`AuthManager.isSsoWired()`, which captures both self-host `OS_SSO_ENABLED` and the cloud per-env `planAllowsSso` arriving via `plugins.sso`). Owning-plugin-contributes pattern (ADR-0029 K2), mirroring `plugin-security`. `isSsoWired()` is made public for this gate.
