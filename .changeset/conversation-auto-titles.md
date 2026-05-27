---
"@objectstack/service-ai": minor
"@objectstack/service-settings": minor
---

Auto-generate concise titles for AI conversations.

`AIService` now exposes `summarizeConversation(id)` and fires it
once per conversation after the first assistant turn lands. The
generated title (≤ 16 chars by default) is PATCHed onto the
`ai_conversations` row so the sidebar shows a meaningful label
instead of "New conversation". Failures are silently swallowed —
title generation is purely cosmetic and never blocks chat.

Plumbing:
- New AI settings (in the `ai` Settings namespace):
  - `title_generation_enabled` (toggle, default on for non-memory providers)
  - `title_max_length` (number, 8–80, default 16)
- `AIService.setTitleGenerationConfig({ enabled, maxLength })` —
  called by `AIServicePlugin.bindSettings()` whenever the `ai`
  namespace changes, so admins can toggle the feature live from
  Setup without a restart.
- `AIService` calls `summarizeConversation()` fire-and-forget at
  the natural end of `chatWithTools` and `streamChatWithTools`.
  Idempotent per service instance — a single titling attempt per
  conversation per process.

Defaults are conservative: memory provider stays untouched
(no LLM call is made), and any per-test `AIService` that doesn't
explicitly call `setTitleGenerationConfig({ enabled: true })`
behaves exactly as before.
