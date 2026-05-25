---
'@objectstack/service-settings': minor
---

`InMemoryCryptoProvider` now auto-detects WebContainer (StackBlitz) and swaps `node:crypto`'s AES-256-GCM for a pure-JS implementation from `@noble/ciphers/aes.js`.

**Why:** WebContainer's `node:crypto` ships `createCipheriv`/`createDecipheriv` stubs that throw `TypeError: y.run is not a function` when called with `'aes-256-gcm'`. Any code path that persists an encrypted setting through `sys_secret` would crash on StackBlitz.

**How it works:**
- Detection: `process.versions.webcontainer` / `SHELL=jsh` / `STACKBLITZ` env.
- The ciphertext layout `iv(12) || tag(16) || cipher` is preserved, so handles written on one runtime decrypt cleanly on the other.
- AAD binding (`namespace|key`) and `digest()` are unchanged.
- In non-WebContainer runtimes the code path is identical to before.

If `@noble/ciphers` cannot be loaded for any reason, the provider falls back to `node:crypto` and lets it throw, surfacing the misconfiguration clearly.
