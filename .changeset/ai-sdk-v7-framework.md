---
'@objectstack/spec': minor
---

chore(ai): align framework with Vercel AI SDK v7 and stop bundling provider SDKs

AI runtime capabilities now live in the cloud package (service-ai removed from the
open edition, ADR-0025 S2). The framework therefore no longer ships any `@ai-sdk/*`
provider SDK:

- `@objectstack/cli` drops the dead `@ai-sdk/anthropic|gateway|google|openai`
  dependencies (zero usages in `cli/src` — they were only bundled so the old
  in-tree `service-ai` could `require()` them at runtime). Apps that boot the
  closed AI now declare the providers themselves (cloud side).
- `examples/app-todo` drops the unused `ai` / `@ai-sdk/gateway` devDeps and the
  dead `test:ai*` / `test:agent` / `test:llm` scripts (their test files were
  migrated to cloud).
- `@objectstack/spec` bumps its `ai` peer/dev dependency from `^6` to `^7`. The
  protocol still re-exports the canonical message/stream types (`ModelMessage`,
  `TextStreamPart`, `ToolSet`, `FinishReason`, …) — all verified present in
  `ai@7`; `ai` stays an OPTIONAL peer so installs are not forced.

First step of the AI SDK v6→v7 / providers v3→v4 upgrade. Cloud (service-ai
adapter migration + apps declaring v4 providers) and objectui (chatbot useChat
v7) follow in their own PRs.
