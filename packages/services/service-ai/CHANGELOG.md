# @objectstack/service-ai

## 6.1.1

### Patch Changes

- @objectstack/spec@6.1.1
- @objectstack/core@6.1.1

## 6.1.0

### Minor Changes

- 93c0589: **AI v1: Actions-as-Tools** — every declarative UI `Action` of `type: 'script'`
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

### Patch Changes

- Updated dependencies [93c0589]
  - @objectstack/spec@6.1.0
  - @objectstack/core@6.1.0

## 6.0.0

### Minor Changes

- dbc4f7d: feat(ai): v1 AI capabilities — ModelRegistry, structured output, tracing, schema retrieval, and `query_data` tool

  This release lights up the first concrete capabilities on the slimmed AI protocol. All additions are
  non-breaking — new contract methods are optional and existing callers keep working unchanged.

  ### What's new

  - **ModelRegistry** (`@objectstack/service-ai`): in-memory runtime registry for `AI.ModelConfig`.
    Wire models via `AIServicePluginOptions.models` / `defaultModelId`. Exposes `get`, `getOrThrow`,
    `getDefault`, `list`, and `estimateCost(modelId, usage)` for ex-post token cost computation.

  - **ai_traces object + auto-tracing**: every LLM call from `AIService` (`chat`, `complete`,
    `stream_chat`, `chat_with_tools`, `generate_object`, `embed`) is now instrumented with latency,
    token usage, status, and (when pricing is registered) cost. The default `ObjectQLTraceRecorder`
    is auto-wired when the runtime exposes an `IDataEngine`, persisting rows to the new `ai_traces`
    object. Drop in a custom `TraceRecorder` via `AIServicePluginOptions.traceRecorder`, or pass
    `null` to opt out.

  - **Structured output (`IAIService.generateObject`)**: new optional method on `IAIService` and
    `LLMAdapter` that returns a parsed, schema-validated object instead of free-form text.
    Implemented end-to-end in `VercelLLMAdapter` (uses the AI SDK's `generateObject` — provider
    strict-mode is automatic when supported). `MemoryLLMAdapter` ships a deterministic heuristic
    implementation so tests and demos work without an API key.

  - **SchemaRetriever**: lightweight keyword-based retriever over `IMetadataService.listObjects()`.
    Scores by object name (×3), label/plural (×2), description (×1), field name (×2), and field
    label (×1) with English stop-word filtering. Tokenisation splits snake_case so `todo_task` in
    a query matches `name: 'todo_task'`. `SchemaRetriever.renderSnippet()` produces a Markdown
    block ready to inject into a system prompt — no embeddings, no extra infra.

  - **`query_data` tool**: auto-registered when AI + Metadata + Data engine are all present. Takes
    a natural-language `request`, retrieves relevant schemas, asks the model for a structured
    `QueryPlan` via `generateObject`, validates the plan targets a real object, and executes it
    through `IDataEngine.find`. Returns `{ plan, count, records }`. The composed primitive that
    closes the loop from "ask in English" → "validated SQL-shaped result".

  - **Working demo in `examples/app-todo`**: `pnpm --filter @example/app-todo test:ai` boots the
    full Todo stack, invokes `query_data` against the seeded tasks, and verifies the call lands
    in `ai_traces`. Zero API keys, ~3 seconds end-to-end. Serves as the canonical reference for
    wiring AI into a real app.

  ### Hardening

  - Strict tool schemas: nested `orderBy` and `aggregations` items in `data-tools` now declare
    `additionalProperties: false` + `required`, matching the top-level contract and making them
    safe for provider strict mode.

  ### Breaking-ish

  - `TraceOperation` values are now snake_case (`stream_chat`, `chat_with_tools`, `generate_object`)
    to match the project's data-value convention and so the `ai_traces.operation` select validates.
    Custom `TraceRecorder` implementations that hard-code the old camelCase names need to be
    updated. The values are an internal observability artefact — no public protocol surface
    exposes them.

  ### Notes

  - `zod` is now a direct dependency of `@objectstack/service-ai` (previously transitive via `ai`)
    because contract signatures and the new tool definition use `z.ZodType` types directly.
  - All new methods on `IAIService` / `LLMAdapter` are optional — existing custom adapters and
    callers continue to work without changes.
  - 12 new unit tests cover `ModelRegistry` (cost math, defaults, throwing lookups) and
    `SchemaRetriever` (scoring, snake_case tokenisation, limits, snippet rendering).
    Full suite: 323/323 ✓.

### Patch Changes

- Updated dependencies [629a716]
- Updated dependencies [dbc4f7d]
- Updated dependencies [944f187]
  - @objectstack/spec@6.0.0
  - @objectstack/core@6.0.0

## 5.2.0

### Patch Changes

- Updated dependencies [bab2b20]
- Updated dependencies [fa011d8]
- Updated dependencies [b806f58]
  - @objectstack/spec@5.2.0
  - @objectstack/core@5.2.0

## 5.1.0

### Patch Changes

- Updated dependencies [75f4ee6]
- Updated dependencies [823d559]
  - @objectstack/spec@5.1.0
  - @objectstack/core@5.1.0

## 5.0.0

### Patch Changes

- Updated dependencies [2f9073a]
  - @objectstack/spec@5.0.0
  - @objectstack/core@5.0.0

## 4.2.0

### Patch Changes

- Updated dependencies [2869891]
  - @objectstack/spec@4.2.0
  - @objectstack/core@4.2.0

## 4.1.1

### Patch Changes

- @objectstack/spec@4.1.1
- @objectstack/core@4.1.1

## 4.1.0

### Patch Changes

- Updated dependencies [2108c30]
- Updated dependencies [23db640]
  - @objectstack/spec@4.1.0
  - @objectstack/core@4.1.0

## 4.0.5

### Patch Changes

- 15e0df6: chore: unify all package versions to a single patch release
- Updated dependencies [15e0df6]
  - @objectstack/spec@4.0.5
  - @objectstack/core@4.0.5

## 4.0.4

### Patch Changes

- Updated dependencies [326b66b]
  - @objectstack/spec@4.0.4
  - @objectstack/core@4.0.4

## 4.0.3

### Patch Changes

- ee39bff: fix ai.
  - @objectstack/spec@4.0.3
  - @objectstack/core@4.0.3

## 4.0.2

### Patch Changes

- 5f659e9: fix ai
- Updated dependencies [5f659e9]
  - @objectstack/spec@4.0.2
  - @objectstack/core@4.0.2

## 4.1.0

### Minor Changes

- **Route auth/permissions metadata**: Every route definition (`RouteDefinition`) now declares `auth` and `permissions` fields, enabling HTTP server adapters to enforce authentication and authorization automatically.
- **User context on RouteRequest**: `RouteRequest` now carries an optional `user: RouteUserContext` object populated by the auth middleware, providing `userId`, `displayName`, `roles`, and `permissions`.
- **Conversation ownership enforcement**: Conversation routes (create, list, add message, delete) are scoped to the authenticated user when a user context is present and the conversation has a `userId`. For backward compatibility, requests without user context and conversations created without a `userId` remain accessible under the existing behavior.
- **Enhanced tool-call loop error handling**: `chatWithTools` now tracks tool execution errors across iterations and supports an `onToolError` callback (`'continue'` | `'abort'`) for fine-grained error control.
- **`streamChatWithTools`**: New streaming tool-call loop that yields SSE events while automatically resolving intermediate tool calls.
- **New `RouteUserContext` type**: Exported from the package for use by HTTP adapters and middleware.

## 4.0.0

### Major Changes

- ad4e04b: service ai

### Patch Changes

- Updated dependencies [f08ffc3]
- Updated dependencies [e0b0a78]
  - @objectstack/spec@4.0.0
  - @objectstack/core@4.0.0

## 3.3.1

### Patch Changes

- Initial release of AI Service plugin
  - LLM adapter layer with provider abstraction (memory adapter included)
  - Conversation management service with in-memory persistence
  - Tool registry for metadata/business tool registration
  - REST/SSE route self-registration (`/api/v1/ai/*`)
  - Kernel plugin registering as `'ai'` service conforming to `IAIService` contract
