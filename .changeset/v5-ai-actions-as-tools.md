---
'@objectstack/service-ai': minor
'@objectstack/spec': minor
'@example/app-todo': patch
---

**AI v1: Actions-as-Tools** — every declarative UI `Action` of `type: 'script'`
is now auto-exposed as an AI-callable tool named `action_<name>`. Agents can
perform business operations ("complete the groceries task") via natural
language, routed through the same `dataEngine.executeAction()` dispatcher
Studio uses. This is the write-side counterpart to `query_data`.

**Highlights**

- `registerActionsAsTools(toolRegistry, { metadata, dataEngine })` walks every
  object's `actions[]` and registers script-type ones, auto-injecting a
  `recordId` argument for row-context actions and inheriting JSON-Schema
  parameter types from the owning object's fields.
- Safety filters skip destructive actions by default: `confirmText`,
  `mode: 'delete'`, `variant: 'danger'`, or explicit `aiExposed: false`.
- New `aiExposed?: boolean` flag on `ActionSchema` for fine-grained opt-out.
- New `actions_executor` skill bundle subscribes to `action_*` (wildcard
  tool names now supported in `SkillSchema.tools`).
- The built-in `data_chat` agent now references both `data_explorer` and
  `actions_executor` skills, so users get read + write capabilities out of
  the box.
- `MemoryLLMAdapter` learned a small two-step heuristic — when it sees an
  action verb ("complete", "start", "clone", ...) it routes to the matching
  `action_*` tool, resolving `recordId` from any prior `query_data` result.
- New `examples/app-todo/test/ai-action.test.ts` demo proves the loop:
  user says "please complete the groceries task" → agent finds the task →
  agent calls `action_complete_task` → task status flips → `ai_traces`
  records the run.

**Breaking changes**

None. `aiExposed` is additive; existing actions remain exposed unless
they fail an existing safety filter.

**Phase-1 limitations** (Phase-2 roadmap items)

- Only `type: 'script'` actions; `api`/`flow`/`url`/`modal`/`form` skipped.
- No human-in-the-loop approval flow for destructive actions yet.
- No CEL evaluation of `visible`/`disabled` predicates against agent context.
- No bulk action support (single-record only).
