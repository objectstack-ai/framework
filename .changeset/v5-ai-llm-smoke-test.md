---
"@objectstack/service-ai": patch
"@example/app-todo": patch
---

Real-LLM smoke test for the `data_chat` agent loop, plus two `query_data`
robustness fixes shaken out by running it against `openai/gpt-4.1-mini` via
the Vercel AI Gateway.

**`query_data` tool fixes**

- Removed the LLM-controllable `model` parameter from the public tool
  schema. Frontier models were hallucinating `text-davinci-003` and other
  long-dead model ids, breaking every plan generation.
- Switched the structured-output filter shape from `z.record(...)` (which
  emits `propertyNames` in JSON Schema, rejected by OpenAI Structured
  Outputs) to a `whereJson` string field. The model emits a JSON-encoded
  ObjectQL filter; the tool parses & validates it before execution. This
  also fixes a parallel issue with OpenAI's strict mode requiring every
  property to appear in `required`.
- Switched all optional fields to `.nullable()` so the planner Zod schema
  satisfies OpenAI Structured Outputs' "every property must be required"
  rule.
- Beefed up the planner system prompt with explicit operator hints — most
  importantly: use `$contains` for partial string matches (`"task named
  Foo"` → `{"subject":{"$contains":"Foo"}}`), not equality. Without this
  hint the model defaulted to exact-match equality and never found
  anything.

**New smoke test**

`examples/app-todo/test/ai-llm.test.ts` (gated on `AI_GATEWAY_API_KEY`):
boots the full ObjectStack, registers `query_data` + the six auto-generated
`action_*` tools, sends *"Please mark the 'Build' task as complete."* to a
real LLM, and asserts that

1. the model picked the right tools in the right order
   (`query_data` → `action_complete_task`),
2. a task row actually flipped to `completed`, and
3. an `ai_traces` `chat_with_tools` row landed.

Run with: `pnpm --filter @example/app-todo test:llm`.

Verified end-to-end against `openai/gpt-4.1-mini` (~6.6 s, 2 tool calls,
1 task completed, trace persisted).
