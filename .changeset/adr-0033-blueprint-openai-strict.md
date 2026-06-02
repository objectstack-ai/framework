---
"@objectstack/spec": patch
"@objectstack/service-ai": patch
---

fix(ai): make ADR-0033 blueprint authoring work with OpenAI structured outputs

Two bugs surfaced by a live end-to-end run (Studio chat → blueprint → draft → review → publish) against a real model (OpenAI via the Vercel AI Gateway) — both invisible to the existing unit tests:

1. **`propose_blueprint` failed against OpenAI strict structured outputs.** `SolutionBlueprintSchema` uses optional fields and a free-form `seedData` record; OpenAI's strict mode requires every property listed in `required` and rejects open `additionalProperties`, so `generateObject` errored (`'required' … must include every key in properties`) and the agent silently fell back to free-text. Adds `SolutionBlueprintStrictSchema` — a strict-compatible mirror (optional → nullable, no `z.record`) used **only** as the `generateObject` output contract. The lenient `SolutionBlueprintSchema` (and every existing consumer/test) is unchanged; the blueprint tools strip the `null`s the strict contract emits so downstream stays clean.

2. **Tool-only assistant turns failed to persist.** `ai_messages.content` is required, but an assistant turn that only calls a tool has no text, so the insert failed, the turn was dropped, and the next turn lost context (the agent re-proposed instead of applying the confirmed blueprint). `ObjectQLConversationService.addMessage` now synthesizes a readable placeholder from the tool names (`(called propose_blueprint)`) plus a defensive non-empty fallback.

With both fixes the full plan-first loop runs end-to-end on OpenAI models: propose → confirm → batch-draft objects/views/dashboards/app → review/diff → publish.
