---
'@objectstack/service-settings': patch
---

Make the Settings UI survive crypto key changes and dev restarts.

Two related fixes to stop a single bad encrypted row (e.g. an AI API key
encrypted before a server restart) from 500-ing the entire
`GET /api/settings/:namespace` endpoint with `Unsupported state or
unable to authenticate data`:

- **`InMemoryCryptoProvider`** now honours the `OBJECTSTACK_DEV_CRYPTO_KEY`
  env var (32 bytes, hex or base64) as a stable AES-256-GCM data key.
  When the env var is unset, the provider still generates an ephemeral
  key but now logs the generated key once as base64 so dev operators
  can paste it into `.env` and survive subsequent `pnpm dev` restarts.
  Production behaviour (KMS-backed providers) is unchanged.

- **`SettingsService.materialiseRow`** now catches decrypt failures,
  logs a single warning naming the offending `namespace.key`, and
  returns `null` instead of throwing. The field renders as empty and
  remains editable, so operators can re-enter the secret in place
  rather than being locked out of the settings page entirely.
