---
"@objectstack/cloud-connection": patch
---

Unbind keeps an identity residual: the credential is cleared (and revoked cloud-side first) but `runtimeId` survives in the store, so a later re-bind to the same org claims — and revives — the same registration instead of minting a new device per disconnect cycle. `ConnectionCredentialStore.read()` accepts token-less residual records.
