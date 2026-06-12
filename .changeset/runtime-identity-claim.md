---
"@objectstack/cloud-connection": minor
---

Runtime-identity bind v2 (cloud ADR runtime-identity-binding): a self-hosted runtime binds like a device — no environment id required. `bind/start`/`bind/poll` work environment-less in `singleEnvironment` mode; the bind call carries a registration claim (`hostname`, `runtime_version`, and the stored `runtime_id` on re-bind) and the store persists the cloud-minted `runtime_id` (durable identity, stable across token rotations). `status` reports `runtimeId` and treats "no env id" as unbound rather than 404; `unbind` revokes bearer-first with no environment requirement; `org-packages` forwards bearer-only when no environment is configured (the connection carries the org); `installation`/`installed` degrade gracefully for registration-only runtimes. `StoredConnectionCredential.environmentId` is now optional (`runtimeId` added).
