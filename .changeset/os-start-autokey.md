---
"@objectstack/service-settings": patch
"@objectstack/cli": patch
---

fix(cli): let single-node `os start` auto-mint a crypto key

`os start` forces `NODE_ENV=production`, which made `LocalCryptoProvider` refuse
to boot without `OS_SECRET_KEY` — breaking the documented zero-config quickstart
(`npm i -g @objectstack/cli && os start`) on a clean machine.

`LocalCryptoProvider` now honours an `OS_CRYPTO_AUTOKEY` opt-in in production: it
mints AND persists a key to `~/.objectstack/dev-crypto-key`. The ephemeral
fallback stays forbidden, so a non-writable / ephemeral filesystem still fails
loud rather than running under a key that won't survive a restart. `os start`
sets the flag only for single-node deployments (no `OS_CLUSTER_DRIVER`, no
`OS_SECRET_KEY`); multi-node still fails loud until `OS_SECRET_KEY` is provided.
