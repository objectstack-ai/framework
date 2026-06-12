---
"@objectstack/cli": minor
---

New `os package install <id|artifact.json>` command — install a package into a RUNNING runtime via its install-local endpoint. Catalog mode resolves from the runtime's configured catalog; passing a compiled artifact file installs inline (air-gapped, no catalog round-trip). Authenticates against the target runtime with --email/--password (better-auth session; Origin header included for the CSRF check).
