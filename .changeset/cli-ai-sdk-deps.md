---
"@objectstack/cli": patch
---

Bundle the `@ai-sdk/openai`, `@ai-sdk/anthropic`, and `@ai-sdk/google` provider
SDKs as direct CLI dependencies. These were previously only declared as optional
peer dependencies on `@objectstack/service-ai`, so a globally-installed CLI could
not resolve them at runtime. Configuring an OpenAI-compatible provider (DeepSeek,
DashScope, SiliconFlow, OpenRouter, Cloudflare) — all of which normalise to
`provider=openai` and dynamically import `@ai-sdk/openai` — failed with
"Could not build adapter for provider=…". The CLI now ships these providers so
they work out of the box.
