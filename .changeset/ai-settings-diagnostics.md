---
"@objectstack/service-ai": minor
"@objectstack/service-settings": minor
---

AI provider misconfiguration is now visible, rejected at save time, and recoverable from the UI. Background: a half-saved `ai` settings row (provider=cloudflare, empty key) silently overrode env auto-detection and the only symptom was a bare "Bad Request" in chat.

- `GET /api/v1/ai/status` — active adapter provenance: `source` (explicit/env/settings/fallback), provider, model, plus `settingsError` explaining why saved settings were NOT applied. `AIServicePlugin` tracks this through boot detection, settings rebuilds, and resets.
- Save-time validation in `SettingsService.setMany` (fulfilling the spec promise that `required` is enforced server-side): visible+required fields and `pattern` mismatches reject the whole batch with field-level errors (`400 SETTINGS_VALIDATION`). Visibility expressions (`${data.provider === '…'}`) are evaluated server-side by a restricted-grammar parser; unparseable expressions and all-null patches (resets) stay lenient. `gateway_model` / `cloudflare_model` gain `provider/model` patterns.
- Built-in `reset` settings action for every namespace (`SettingsService.resetNamespace`), overridden for `ai` to also re-run env adapter detection immediately; the AI manifest ships a "Reset to environment defaults" button — no more hand-editing `sys_setting`.
- Chat/agent/assistant stream errors are enriched with the active adapter description and actionable hints (400 → model-id format, 401/403 → credential, 404 → unknown model, 429 → rate limit) instead of a bare HTTP status.
