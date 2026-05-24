# ADR-0011: Actions as AI Tools (Operational Parity)

**Status**: Draft (2026-05-24)
**Authors**: HotCRM (objectstack-ai/hotcrm) — surfacing requirements while planning v1.1
**Consumers**: `@objectstack/service-ai`, `@objectstack/spec` (ui, ai), `@objectstack/runtime` (ActionRegistry), every app that ships actions

---

## TL;DR

Today, AI agents call **Tools** registered with `ToolRegistry`. Apps separately register business operations as **Actions** (`engine.registerAction(...)` / `*.action.ts`) for UI buttons and HTTP endpoints. The two registries don't talk to each other, so giving the Copilot a new capability means writing the same logic twice — once as an Action (for humans), once as a Tool (for the LLM), and keeping them in sync forever.

This ADR proposes that **every Action opts in to being an AI Tool by adding a single `ai:` block to its metadata**. The runtime exposes opted-in Actions to agents through the existing `ToolRegistry` surface — no new bridge contract, no Tool duplicates. Result: **operational parity** — anything an admin can do, the Copilot can do, by virtue of calling the same Action with the same permissions, validation, audit, and transaction guarantees.

---

## Context

### What HotCRM tried

HotCRM v1 shipped 6 hand-authored "skills" under `src/skills/` (lead qualification, case triage, customer 360, email drafting, revenue forecasting, live data). Each skill is a `defineSkill({ tools: [...] })` bundle of inline tools or `ToolRegistry` references.

While planning v1.1, the team asked: *"We're a metadata-driven platform — do we really need bespoke skill code for each business operation?"* The first round of exploration produced a "meta-skill + per-object `ai:` block" design (record_advisor / record_synthesizer / etc.), which still required admins to maintain a side-channel AI DSL.

The breakthrough observation: **Actions are already the metadata vocabulary for "what the system can do"**. They have a name, a label, a description, a typed parameter schema, permissions, audit logging, transactions, and an implementation (sandboxed body, API target, flow trigger, or registered handler). They're the same shape a Tool needs, minus a description aimed at an LLM.

### Why this isn't just "wrap actions in tools"

A naive bridge (auto-generate one Tool per Action) is *almost* right but has three sharp edges that this ADR resolves:

1. **Not every Action should be AI-callable.** Internal actions (`__internal_delete_orphans`), destructive admin actions, and actions intended only for `list_toolbar` UX must not leak to the LLM. Opt-in is required.
2. **Action `params` are UI-oriented, not LLM-oriented.** `ActionParamSchema` carries `widget`, `placeholder`, i18n labels, etc. — useful for forms, noise for tool-calling. The bridge needs a clean translation to JSON Schema.
3. **The LLM-facing description is different from the human-facing label.** "Send Quote" (label) vs. "Send the latest approved quote PDF to the primary contact via email. Only call after the user has confirmed they want to send." (description). Mixing them confuses both audiences.

A small, opt-in `ai:` extension on `ActionSchema` solves all three.

---

## Goals

* **Zero duplication** — one definition (the Action) drives both the UI button and the AI tool.
* **Opt-in exposure** — actions are NOT exposed to the LLM by default; the `ai.exposed: true` flag is required.
* **Strong description for LLMs** — separate `ai.description` from the human `label`, so model prompts can be tuned without changing the UI.
* **Auto-derived JSON Schema** — `parameters` for the AI tool come from the Action's `params[]` and the referenced field types, with admin-supplied overrides for AI-only refinement (e.g. tighter `enum`, longer `description`).
* **Permission parity** — the AI invocation goes through the same permission and audit machinery as the human invocation.
* **Confirmation parity** — actions that require `confirmText` in the UI surface `requiresConfirmation: true` to the agent runtime; the LLM proposes, the user accepts.
* **Backwards compatible** — existing `defineTool(...)` and `defineSkill(...)` continue to work; this ADR adds a third source of tools alongside them.

## Non-Goals

* Replacing `ToolRegistry`. Pure tools (`describe_object`, `query_records`, etc.) remain first-class — they're not business operations and don't belong in a UI's action surface.
* Auto-generating an LLM `description` from the action label. Authors who want AI exposure must write a description aimed at a model.
* Inferring "this action is safe / unsafe" automatically. The author opts in and writes the confirmation copy.
* Touching `SkillRegistry`. Skills (instruction bundles + tool filters) are a separate concept that this ADR clarifies (see "Relationship" below) but does not change.
* Hot-reload semantics. Live-reload of newly added actions into running agent sessions is a separate concern handled by ADR-0008/0009 metadata watchers; this ADR only requires that the next agent turn sees the current registry.

---

## Proposed Design

### 1. Action spec extension — `ai:` block

Add an optional `ai` field to `ActionSchema` in `@objectstack/spec/src/ui/action.zod.ts`:

```ts
const ActionAiSchema = z.object({
  /**
   * Expose this action to AI agents as a callable tool. Default false.
   * Setting this to true REQUIRES `description` (so the LLM knows when to call).
   */
  exposed: z.boolean().default(false),

  /**
   * LLM-facing description. Tells the model when and why to call this action.
   * Distinct from `label` (which is UI-facing and i18n-translated).
   * Should be plain English and ≥ 40 chars for useful tool selection.
   */
  description: z.string().min(40).optional(),

  /**
   * Override tool category. Defaults to 'action' (side-effect).
   * Set to 'data' for read-only actions, 'analytics' for aggregations, etc.
   */
  category: ToolCategorySchema.optional(),

  /**
   * Per-parameter AI hints, keyed by param name. Tightens the JSON Schema
   * the LLM sees (e.g. add `enum`, override `description`) without changing
   * the UI-facing field metadata.
   */
  paramHints: z.record(z.string(), z.object({
    description: z.string().optional(),
    enum: z.array(z.union([z.string(), z.number()])).optional(),
    examples: z.array(z.unknown()).optional(),
  })).optional(),

  /**
   * Output JSON Schema for the action's return value. Enables structured
   * downstream tool chaining (one action's output feeds another's input).
   * Optional — when omitted the LLM treats the return value as freeform.
   */
  outputSchema: z.record(z.string(), z.unknown()).optional(),

  /**
   * Override `requiresConfirmation` for AI calls. Defaults to true when the
   * action has `confirmText` set OR `type` is 'delete'. Set explicitly to
   * false for clearly safe actions like 'send_test_email'.
   */
  requiresConfirmation: z.boolean().optional(),
}).optional();
```

**Validation rules** (added to `ActionSchema.refine(...)`):

* If `ai.exposed === true`, `ai.description` is required.
* If `ai.exposed === true` and any `params[].field` is set, all referenced fields must be readable by the action's caller (enforced at registration, not parse).
* `ai.paramHints` keys must match a `params[].name` (validated at refine).

### 2. Registry bridge — `ActionRegistry → ToolRegistry`

The runtime's `ActionRegistry` (currently exposed via `engine.registerAction(...)` and the dispatcher) gains a single method:

```ts
interface ActionRegistry {
  // existing
  register(action: Action, handler: ActionHandler): void;
  list(filter?: ActionFilter): Action[];

  // NEW — derives AIToolDefinitions from registered actions that opt in.
  toolsForAi(opts: {
    user: User;
    objectName?: string;        // optional scope filter
  }): AIToolDefinition[];
}
```

`toolsForAi` walks `list()`, keeps actions where `ai.exposed === true`, filters by the user's permissions (re-using whatever check the action invoker uses), and translates each one to an `AIToolDefinition`:

| Source on Action | Target on Tool | Notes |
| --- | --- | --- |
| `name` | `name` | `${objectName}__${actionName}` when objectName set, else `name` |
| `ai.description` | `description` | required, validated at action-parse time |
| `ai.category ?? 'action'` | `category` | |
| `params[]` + `ai.paramHints` | `parameters` | JSON Schema generated from field types (already done for HTTP dispatch); paramHints merged last |
| `ai.outputSchema` | `outputSchema` | |
| `objectName` | `objectName` | |
| `ai.requiresConfirmation ?? !!confirmText \|\| type==='delete'` | `requiresConfirmation` | |
| `permissions` | `permissions` | passes through |
| `active` | `active` | inherited |
| (constant) `true` | `builtIn` | false — these are app-defined, not platform tools |

The dispatcher already knows how to translate `params[]` into a JSON Schema for the HTTP layer (`ActionParamSchema.field` → resolve field type → emit property). The bridge reuses that machinery.

### 3. Agent-runtime integration

`packages/services/service-ai/src/agent-runtime.ts` currently composes `availableTools` from `ToolRegistry` only. Change:

```ts
// Before
const availableTools = toolRegistry.list();

// After
const availableTools = [
  ...toolRegistry.list(),                          // platform + app-registered tools
  ...actionRegistry.toolsForAi({ user: ctx.user }), // exposed actions
];
```

Agent tool resolution (`agent.tools[]` lookup, skill flattening) stays unchanged — it just sees more candidates in `availableTools`.

**Name collision rule**: if a tool with the same `name` is registered in both `ToolRegistry` and via `ActionRegistry`, the bridge logs a warning and the `ToolRegistry` entry wins. This is so platform tools can never be silently overridden by an app's action.

### 4. Invocation flow

When an LLM decides to call an action-backed tool:

```
LLM emits tool_call { name: 'crm_case__triage', args: { caseId: '00123' } }
  │
  ▼
agent-runtime resolves tool definition → finds it has `objectName: 'crm_case'`,
  is action-backed (set by the bridge as a marker on AIToolDefinition.meta.kind='action')
  │
  ▼
  if requiresConfirmation === true:
    runtime returns a `pending_action` event to the client
    UI renders the action confirmation card (re-uses existing action confirm UI)
    user clicks Accept → client POSTs to /api/v1/.../actions/triage with the same args
  else:
    runtime invokes ActionRegistry.execute(action, args, { user, source: 'ai' })
  │
  ▼
ActionRegistry executes the action body (sandboxed JS / API / flow) inside the
same transaction + audit machinery used for human-invoked actions.
The `source: 'ai'` flag is recorded on the audit log entry.
  │
  ▼
Result returned to the LLM as the tool's return value (shape validated against
`ai.outputSchema` if provided).
```

**Key invariant**: AI-invoked actions never bypass permission checks, validation rules, hooks, or audit. The only differences vs. human invocation are (a) the input args came from an LLM, not a form, and (b) `source: 'ai'` is stamped on the audit entry.

---

## Relationship to ToolRegistry and SkillRegistry

This ADR adds a **third source** of tool definitions; the three sources remain distinct:

| Source | Lives where | Used for | Example |
| --- | --- | --- | --- |
| **`ToolRegistry`** | platform / app code | Pure, generic, schema-discoverable operations that aren't business actions | `describe_object`, `query_records`, `aggregate_data`, `propose_flow` (ADR-0010) |
| **`ActionRegistry` (via this ADR)** | app metadata (`*.action.ts`) | App-specific business operations that humans also invoke from the UI | `crm.lead.qualify`, `crm.case.triage`, `crm.account.send_quote` |
| **`SkillRegistry`** | platform / app code | Bundles of *instructions* + a curated tool subset; activates conditionally | `lead_qualification` skill = "be a BANT expert" + tools `[query_records, crm.lead.qualify]` |

Skills remain useful even after this ADR — they're **how you bias an agent toward calling certain action-tools in certain contexts**. `defineSkill({ tools: ['crm.case.triage'] })` becomes the idiomatic way to surface action-tools.

**HotCRM's planned migration** (informative, not normative for this ADR): delete the 6 hand-authored skills in `src/skills/`, replace each with a `defineAction({ ai: { exposed: true } })`, optionally keep a minimal skill bundle that pre-loads instructions for sales vs. service personas while letting the agent see *all* exposed actions.

---

## Permission & Confirmation Model

### Permissions

Today, action execution permission is checked at two layers:

1. **HTTP dispatcher** — verifies the caller's session has `action.permissions` (or default object-write) before invoking the handler.
2. **ObjectQL** — the handler runs as the caller; sharing rules and FLS apply to any reads/writes inside.

AI invocations reuse **both** layers. The `User` passed to `actionRegistry.toolsForAi({ user })` is the chat session's user; the LLM cannot escalate by asking. The bridge filters `toolsForAi` output to actions the user is permitted to invoke — actions the user can't call are simply not visible to the LLM (avoids the LLM trying and getting a permission-denied error mid-conversation).

### Confirmation

Three states:

| Action config | LLM tool sees | Behavior |
| --- | --- | --- |
| `confirmText` set OR `type: 'delete'` | `requiresConfirmation: true` | LLM proposes; runtime emits `pending_action`; user clicks Accept in UI |
| `ai.requiresConfirmation: true` (override) | `requiresConfirmation: true` | same |
| Neither, no destructive type | `requiresConfirmation: false` | LLM calls directly; result returned to LLM for next step |
| `ai.requiresConfirmation: false` on a destructive action | (override applies) | proceeds without confirmation — **author asserts this is safe** |

For HotCRM specifically: anything that writes to `status`, `stage`, `amount`, or fires an email should keep `requiresConfirmation: true`. Customer 360 / forecast / triage *suggestions* (which don't write until accepted) can run without confirmation because their effect is "show the user this draft."

---

## Migration Path

### Phase 1 — framework (this ADR)

1. Add `ai` block to `ActionSchema` (spec change, no runtime impact yet).
2. Implement `ActionRegistry.toolsForAi(...)` and the param→JSON-Schema translator.
3. Wire `agent-runtime` to merge `actionRegistry.toolsForAi(...)` into `availableTools`.
4. Add `meta.kind = 'action'` marker on AIToolDefinitions originating from the bridge, plus a runtime-side dispatcher: when the LLM calls an `kind === 'action'` tool, execute through `ActionRegistry`, not the inline handler.
5. Audit log enhancement: stamp `source: 'ai' | 'human' | 'system'` on every action invocation entry.
6. Tests: action exposes correctly; permission filter respected; confirmation flow surfaces `pending_action`; output schema validation.

### Phase 2 — first consumer (HotCRM v1.1)

1. Convert `src/skills/case-triage.skill.ts` → `src/actions/crm_case_triage.action.ts` with `ai: { exposed: true, description: '...' }`. Verify the Copilot calls it.
2. Convert the remaining 5 business skills the same way.
3. Delete `src/skills/` (or trim it to a sales/service persona instruction bundle).
4. Update `content/docs/ai-copilot/skills.mdx` → rename to `actions.mdx`, restructure around the action catalog.

### Phase 3 — ecosystem

1. Document the pattern in `docs/guides/ai-actions.md` with a 5-minute "write an AI-callable action" tutorial.
2. Add a Stack Lint rule: `actions with type: 'delete' must explicitly set ai.exposed` (force authors to make a deliberate choice).
3. Optional: a `defineAiAction(...)` factory that defaults `ai.exposed: true` for authors who want a shorter idiom.

---

## Schema Changes

### `@objectstack/spec` — additive only

* `packages/spec/src/ui/action.zod.ts` — add `ai` field (see Design §1).
* `packages/spec/src/ai/tool.zod.ts` — no change required; `'action'` category already exists.
* `packages/spec/src/ai/agent.zod.ts` — no change. `agent.tools[]` references work as-is; agents that want to allow-list action-tools just include their names there.

### Type exports

```ts
// new exports
export type ActionAi = z.infer<typeof ActionAiSchema>;
export type ActionWithAi = Action & { ai: ActionAi & { exposed: true } };
```

### Examples (HotCRM, illustrative)

```ts
// src/actions/crm_case_triage.action.ts
import { defineAction } from '@objectstack/spec';

export default defineAction({
  name: 'crm_case_triage',
  label: { en: 'Triage Case', 'zh-CN': '案例分类' },
  objectName: 'crm_case',
  type: 'script',
  body: { language: 'js', source: '...', capabilities: ['ai', 'objectql'] },
  params: [
    { field: 'id', objectOverride: 'crm_case', required: true },
  ],
  ai: {
    exposed: true,
    description:
      'Classify a support case: suggest priority (P0–P3), category (billing/technical/account), ' +
      'and queue. Reads the case subject, description, account tier, and prior cases. ' +
      'Returns a suggestion — does not write until the user confirms.',
    outputSchema: {
      type: 'object',
      properties: {
        priority: { type: 'string', enum: ['P0', 'P1', 'P2', 'P3'] },
        category: { type: 'string', enum: ['billing', 'technical', 'account'] },
        queue: { type: 'string' },
        confidence: { type: 'number' },
      },
      required: ['priority', 'category'],
    },
    requiresConfirmation: false,  // it returns a draft; user accepts via a downstream action
  },
});
```

```ts
// src/actions/crm_case_resolve.action.ts — destructive, defaults to confirmation
export default defineAction({
  name: 'crm_case_resolve',
  label: { en: 'Resolve Case' },
  objectName: 'crm_case',
  type: 'script',
  confirmText: { en: 'Mark this case resolved and notify the customer?' },
  // confirmText set → ai.requiresConfirmation defaults to true; no override needed
  params: [
    { field: 'id', objectOverride: 'crm_case', required: true },
    { name: 'resolution_summary', type: 'longtext', required: true },
  ],
  ai: {
    exposed: true,
    description:
      'Mark a case resolved with a final resolution summary. Sends a notification email to the ' +
      'primary contact. Only call after the user has agreed the case is solved.',
  },
});
```

---

## Open Questions

1. **Bulk vs single.** An action with `bulkEnabled: true` accepts an array of record IDs from the UI. Should the AI tool expose two signatures (single + bulk) or one (always-array)? **Tentative**: one tool with an array-accepting `parameters`, since LLMs handle this well.

2. **Streaming results.** Long-running actions (a forecast over thousands of opps) might want to stream partial results back to the LLM for early reasoning. Out of scope here; would need a separate ADR on streaming tool returns.

3. **Tool name namespacing.** Proposed: `${objectName}__${actionName}` (double underscore) for object-bound actions, bare `actionName` for global ones. Alternative: a `.` separator. Decided in favor of `__` because tool names are constrained to `^[a-z_][a-z0-9_]*$` today; changing the regex is a larger spec change.

4. **MCP exposure.** Should action-tools also be exposed via the existing MCP server plugin (`@objectstack/plugin-mcp-server`)? Likely yes, but uses the same `toolsForAi(...)` output — covered transparently by reusing the bridge. Confirm in implementation.

5. **Discoverability for the LLM.** With 50+ actions in a mature app, the LLM's context fills up with tool definitions. Mitigations: (a) scope `toolsForAi` by current record's object on detail pages, (b) skills as curators for global chat, (c) lazy tool resolution (let the LLM ask "what actions exist for crm_case?"). Implementation can start without these and add as needed.

6. **Versioning.** When an action's `params` or `outputSchema` changes, ongoing conversations may have already seen the old shape. Strategy: tool definitions are resolved per turn (not per conversation), so the next turn sees the new shape automatically. Mid-turn schema drift is a non-issue because tool resolution and invocation happen in the same turn.

---

## Out of Scope

* **Replacing Tools.** Schema-derived tools (`describe_object` et al.) are not actions and stay in `ToolRegistry`.
* **Action chaining DAGs.** "Run A, then B with A's output" is the LLM's job, not a separate composition layer.
* **Side-effect simulation / dry-run.** Useful for "show me what would happen" but out of scope here; can be added per-action with a `dryRun: true` parameter convention.
* **AI-authored actions.** "The Copilot wrote a new action" is ADR-0010's territory (NL → Flow), with the analogous extension to NL → Action covered separately.
* **Per-conversation tool subsetting based on user history.** Personalized tool catalogs are an optimization, not a correctness concern.

---

## Decision

Adopt the design above for `@objectstack/spec` v6.x. Implementation lives in:

* `@objectstack/spec` — additive `ai` block on `ActionSchema`
* `@objectstack/runtime` — `ActionRegistry.toolsForAi(...)` + dispatcher routing for action-kind tools
* `@objectstack/service-ai` — merge action-tools into `availableTools` in `agent-runtime`

HotCRM v1.1 ships as the first consumer and the validation testbed.

---

## References

* ADR-0003 — Package as first-class citizen (where actions live)
* ADR-0008 — Metadata repository and change log (how registry mutations propagate)
* ADR-0009 — Execution-pinned metadata (which version of an action a tool call uses)
* ADR-0010 — Natural-language → Flow authoring (the AI-authoring counterpart)
* `packages/spec/src/ui/action.zod.ts` — existing `ActionSchema`
* `packages/spec/src/ai/tool.zod.ts` — existing `ToolSchema`
* `packages/services/service-ai/src/agent-runtime.ts` — current tool resolution
