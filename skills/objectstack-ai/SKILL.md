---
name: objectstack-ai
description: >
  Design ObjectStack AI agents, tools, skills, conversations, model registry
  entries, and MCP integrations. Use when the user is adding `*.agent.ts` /
  `*.tool.ts` / `*.skill.ts`, configuring an LLM provider, wiring agent
  tools, or designing an embedding/RAG flow on top of ObjectStack data. Do
  not use for general LLM prompting questions unrelated to ObjectStack
  metadata.
license: Apache-2.0
compatibility: Requires @objectstack/spec Zod schemas (v4+)
metadata:
  author: objectstack-ai
  version: "1.1"
  domain: ai
  tags: agent, tool, skill, conversation, llm, embedding, mcp
---

# AI Agent Design — ObjectStack AI Protocol

Expert instructions for designing AI-powered agents, skills, tools, and RAG
pipelines using the ObjectStack specification. This skill covers the
Agent → Skill → Tool three-tier architecture aligned with Salesforce
Agentforce, Microsoft Copilot Studio, and ServiceNow Now Assist patterns.

> **Edition boundary (cloud ADR-0025 — `service-ai → cloud; open = MCP-only`).**
> The in-UI AI **runtime** — the `ask` / `build` agents, in-product chat, and the
> `/api/v1/ai/*` routes (`@objectstack/service-ai`) — ships in the **cloud /
> Enterprise** distribution, not the open framework. The agent / skill / tool
> **schemas** in `@objectstack/spec/ai` stay open, so you author `*.agent.ts` /
> `*.skill.ts` / `*.tool.ts` as source either way — but they only execute in a
> cloud / EE host. On the **open edition** there is no in-product agent: expose the
> app to your own AI via `@objectstack/mcp` (BYO-AI) for data query, and author
> metadata in **source mode** with an AI coding agent (Claude Code, Cursor).

---

## When to Use This Skill

- You are creating an **AI agent** with a specific role and capabilities.
- You need to define **skills** — bundles of related tools an agent can use.
- You are configuring **tools** for data queries, actions, or integrations.
- You want to set up a **RAG pipeline** for knowledge retrieval.
- You are choosing and configuring **LLM models** for your agent.

---

## Three-Tier Architecture

```
Agent  →  Skill  →  Tool
  │         │         │
  │         │         └─ Atomic operation (query, action, flow, API call)
  │         └─ Capability bundle with instructions & trigger phrases
  └─ Autonomous actor with role, instructions, and guardrails
```

### Why Three Tiers?

| Tier | Analogy | Reuse Level |
|:-----|:--------|:------------|
| **Agent** | Job role (e.g., "Help Desk Agent") | Per use-case |
| **Skill** | Competency (e.g., "Case Management") | Across agents |
| **Tool** | Specific operation (e.g., "create_record") | Across skills |

> **Best practice:** Always model via Skills first. Direct tool assignment to
> agents is supported but considered legacy. Skills provide better
> discoverability, instruction scoping, and reuse.

### Built-in agents: `ask` & `build` (ADR-0063 / ADR-0064)

The runtime ships **exactly two** platform agents, bound by *surface* — the user
never picks from a roster; the surface they are in selects the agent:

- **`ask`** — the **data product** (≈ Claude Chat). Conversational read / query /
  explore over records, plus running the business **actions** the app already
  exposes. End-user audience, RLS-bounded. Canonical id `ask` (`ASK_AGENT_NAME`).
  **Cloud / Enterprise** — the `ask` runtime moved from the open framework into the
  cloud AI runtime (`@objectstack/service-ai` → `cloud/packages/service-ai`, closed)
  per cloud ADR-0025; it is the implicit copilot for any cloud / EE app that does
  not pin `app.defaultAgent`. (Open editions have no in-product `ask`; use MCP.)
- **`build`** — the **authoring product** (≈ Claude Code). Agentic authoring of
  *metadata* (objects, fields, views, flows) through plan → draft → verify →
  publish. Builder audience, governance-gated. Canonical id `build`. Cloud-only ·
  paid — ships in the cloud AI Studio plugin; Studio pins it via `app.defaultAgent`.

There is **no per-turn intent classifier**: a `build`-shaped request arriving at
`ask` is declined and redirected to the Builder, never silently re-routed into
authoring (ADR-0063 §1/§5).

> **Legacy names are aliases only.** `data_chat`→`ask` and
> `metadata_assistant`→`build` resolve through the alias table for old bookmarks
> and persisted `agent_id`s; they are **not** vocabulary — always write `ask` /
> `build`. `*.agent.ts` is closed to third parties (`agent` type is
> `allowRuntimeCreate:false, allowOrgOverride:false`): you extend the platform
> with **skills**, never by authoring an agent (ADR-0063 §2).

#### Skill → agent affinity: the `surface` field (ADR-0063 §3)

Every skill declares which surface it binds to via
`surface: 'ask' | 'build' | 'both'` (defaults to `'ask'`). A skill may bind only
to an agent whose surface it matches; `'both'` binds to either. The runtime
enforces this in `resolveActiveSkills` at load time — an incompatible binding is a
**fast load error**, not a silent mis-scope. An agent's tool set is the **union of
its surface-compatible skills' tools** — there is no global fall-through
(ADR-0064), so `ask` cannot author by construction.

The built-in skills and their affinities:

| Skill | `surface` | Owns | Edition |
|---|---|---|---|
| `schema_reader` | `both` | `list_objects`, `describe_object`, `query_data` | OSS |
| `data_explorer` | `ask` | `query_records`, `get_record`, `aggregate_data`, `visualize_data` | OSS |
| `actions_executor` | `ask` | `action_*` (the business actions an object exposes) | OSS |
| `metadata_authoring` + `solution_design` | `build` | metadata draft / verify / publish + blueprint propose / apply | **cloud only** |

To grant data exploration to your own (platform-internal) agent, add
`data_explorer` / `schema_reader` to its `skills[]`; deactivating a skill
(`active: false`) revokes that capability for every agent that references it.

> **`surface:'build'` skills are inert on OSS — by design, not a bug.** The open
> single-env framework ships only the `ask` agent; `metadata_authoring` /
> `solution_design` (and any third-party `surface:'build'` skill) are supplied by
> the cloud AI Studio plugin and simply do not resolve in OSS. A `build`-intent
> turn on OSS degrades gracefully ("authoring lives in the cloud Build assistant")
> instead of dead-ending — this is intentional tiering. Do not assume authoring
> tools resolve in the open framework.

> **`visualize_data` (#1820/#1821):** the only built-in tool that draws a chart —
> it aggregates an object and emits an inline `data-chart` part. Auto-registered
> **only** when an analytics service (`IAnalyticsService`) is wired; `query_data` /
> `aggregate_data` return numbers, not charts.

> **Ops:** set `AI_DAILY_USER_MESSAGES=<N>` to cap user turns per user per day
> (ADR-0040 §5; backed by the `ai_usage_daily` object, no-op if unset). Adapter
> health is observable at `GET /api/v1/ai/status`; invalid `ai` settings are
> rejected at save time (#1788).

---

## Agent Configuration

### Required Properties

| Property | Type | Description |
|:---------|:-----|:------------|
| `name` | `snake_case` | Unique agent identifier |
| `label` | string | Human-readable name |
| `role` | string | Agent's persona/role description |
| `instructions` | string | System prompt — detailed behavioural guidance |

### Important Optional Properties

| Property | Purpose |
|:---------|:--------|
| `skills` | Array of skill names — **primary capability model** |
| `tools` | Direct tool references — legacy fallback |
| `model` | LLM model configuration |
| `knowledge` | RAG knowledge sources |
| `guardrails` | Safety constraints and topic restrictions |
| `structuredOutput` | Output format (JSON schema, regex, etc.) |
| `temperature` | LLM creativity level (0.0–2.0) |
| `maxTokens` | Response token limit |
| `active` | Enable/disable the agent |

### Agent Example

```typescript
import { defineAgent } from '@objectstack/spec';

export default defineAgent({
  name: 'support_tier_1',
  label: 'First Line Support',
  role: 'Help Desk Assistant for customer support cases',
  instructions: `
    You are a friendly and professional help desk assistant.
    
    RULES:
    - Always greet the customer by name if available.
    - Search the knowledge base before creating a new case.
    - Escalate to a human agent if the issue is critical or security-related.
    - Never share internal system details with customers.
    - Respond in the customer's preferred language.
  `,
  skills: ['case_management', 'knowledge_search'],
  model: {
    provider: 'openai',
    model: 'gpt-4o',
    temperature: 0.3,
  },
  guardrails: {
    blockedTopics: ['internal_pricing', 'employee_data'],   // forbidden topics / action names
    maxTokensPerInvocation: 8000,                            // token budget per invocation
    maxExecutionTimeSec: 60,                                 // wall-clock cap per invocation
  },
});
```

---

## Skill Configuration

A **Skill** is a named bundle of tools with dedicated instructions and
trigger conditions.

### Required Properties

| Property | Type | Description |
|:---------|:-----|:------------|
| `name` | `snake_case` | Unique skill identifier (`/^[a-z_][a-z0-9_]*$/`) |
| `label` | string | Human-readable name |
| `tools` | `string[]` | Tool names this skill grants access to |
| `active` | boolean | Is the skill enabled (default: `true`) |

### Important Optional Properties

| Property | Purpose |
|:---------|:--------|
| `description` | What the skill does — helps the agent decide when to use it |
| `instructions` | LLM prompt guidance specific to this skill's context |
| `triggerPhrases` | Natural language phrases that activate the skill |
| `triggerConditions` | Programmatic activation rules |
| `permissions` | Required permission profiles/roles |

### Skill Example

```typescript
import { defineSkill } from '@objectstack/spec';

export default defineSkill({
  name: 'case_management',
  label: 'Case Management',
  description: 'Create, update, query, and escalate support cases.',
  instructions: `
    When managing cases:
    - Always check for duplicate cases before creating a new one.
    - Set priority based on customer tier: Enterprise → High, Pro → Medium, Free → Low.
    - Escalated cases must include a summary of actions already taken.
  `,
  tools: [
    'query_support_case',
    'create_support_case',
    'update_support_case',
    'escalate_case',
  ],
  triggerPhrases: [
    'I need help with a case',
    'Create a support ticket',
    'What is the status of my case',
    'Escalate this issue',
  ],
  triggerConditions: [
    { field: 'object', operator: 'eq', value: 'support_case' },
  ],
  permissions: ['support_agent', 'support_admin'],
  active: true,
});
```

### Trigger Conditions

| Operator | Meaning |
|:---------|:--------|
| `eq` | Equals |
| `neq` | Not equals |
| `in` | Value is in array |
| `not_in` | Value is not in array |
| `contains` | String contains substring |

---

## Tool Configuration

Tools are the atomic operations that skills expose to agents.

### Tool Types

| Type | Purpose | Example |
|:-----|:--------|:--------|
| `action` | Trigger a server-side action | "Close case", "Send email" |
| `flow` | Launch a flow | "Reset password flow" |
| `query` | Query ObjectStack records | "Get open cases for account" |
| `vector_search` | Semantic search over embeddings | "Find similar articles" |

### Tool Definition

```typescript
{
  name: 'query_support_case',
  type: 'query',
  object: 'support_case',
  description: 'Search support cases by any combination of filters.',
  parameters: {
    status: { type: 'string', description: 'Filter by case status' },
    account_id: { type: 'string', description: 'Filter by account ID' },
    priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'] },
  },
}
```

### Auto-Exposed Actions

You usually **don't author tool definitions by hand** for action invocation. Every `Action` you attach to an object via `defineObject({ actions: [...] })` is auto-exposed as a tool named `action_<actionName>` by `registerActionsAsTools()` (invoked from `AIServicePlugin`).

Three action types dispatch headlessly:

| `action.type` | Dispatch | Wiring |
|:---|:---|:---|
| `script` | `IDataEngine.executeAction(object, target, ctx)` — same as Studio's row toolbar | none |
| `api` | HTTP call to `action.target` (`fetch`-based by default) | `AIServicePlugin({ apiActionBaseUrl, apiActionHeaders })` or custom `apiClient` |
| `flow` | `IAutomationService.execute(target, { triggerData })` | `automation` service registered with the kernel |

**Skipped automatically:**
- UI-only types (`url`, `modal`, `form`).
- Dangerous variants (`confirmText` set, `mode: 'delete'`, `variant: 'danger'`) — **unless** the plugin is started with `enableActionApproval: true`, in which case they route through the HITL approval queue (see below).
- Owner opt-outs (`aiExposed: false`).

**`type:'api'` body assembly** (last wins): user params → `recordIdParam` (using `recordIdField`, default `'id'`) → `bodyExtra`. `bodyShape: { wrap: 'data' }` nests user params under `data` while keeping `recordIdParam` flat.

Use `actionSkipReason(action, ctx)` (exported from `@objectstack/service-ai`) when authoring an action and you want to know *why* it isn't surfacing in chat. Studio's "AI exposure" diagnostics use the same predicate. Pair with `actionRequiresApproval(action)` to know whether a registered action will be routed through HITL.

### Human-In-The-Loop approval

```ts
kernel.use(new AIServicePlugin({
  enableActionApproval: true,   // opt in; default is false
  apiActionBaseUrl: process.env.OS_AI_ACTION_API_BASE_URL,
}));
```

Flow:
1. LLM picks `action_delete_task` → runtime persists an `ai_pending_actions` row and returns `{ status: 'pending_approval', pendingActionId }`.
2. Operator triages via Studio's **AI Pending Actions** inbox (or the REST endpoints: `GET/POST /api/v1/ai/pending-actions/...`).
3. Approve → service re-runs the action via the pre-registered bypass-approval dispatcher; row transitions to `executed` / `failed`.
4. Reject → row transitions to `rejected` with an optional reason.

Programmatic API on `IAIService`: `proposePendingAction`, `approvePendingAction`, `rejectPendingAction`, `listPendingActions`. All are optional (returns clear error when no `IDataEngine` is wired).

---

## RAG Pipeline Configuration

Retrieval-Augmented Generation gives agents access to domain knowledge.

### RAG Pipeline Structure

```typescript
{
  name: 'support_knowledge',
  label: 'Support Knowledge Base',
  sources: [
    {
      type: 'object',
      object: 'knowledge_article',
      fields: ['title', 'content', 'category'],
      filter: [{ field: 'published', operator: 'equals', value: true }],
    },
    {
      type: 'document',
      path: 'docs/support-handbook.md',
    },
  ],
  indexes: [
    {
      name: 'article_embeddings',
      model: 'text-embedding-3-small',
      dimensions: 1536,
      distanceMetric: 'cosine',
    },
  ],
  retrieval: {
    topK: 5,
    scoreThreshold: 0.75,
    reranker: 'cohere-rerank-v3',
  },
}
```

### RAG Best Practices

1. **Chunk documents appropriately.** 500–1000 tokens per chunk with 100-token
   overlap works well for most use cases.
2. **Set a `scoreThreshold`** to filter low-relevance results. Start with `0.7`
   and tune.
3. **Use a reranker** for better precision when the initial retrieval returns
   many candidates.
4. **Filter by published/active status** to avoid surfacing draft or archived
   content.
5. **Index only searchable fields** — do not index system fields or IDs.

---

## Model Configuration

### Supported Providers

| Provider | Models | Use Case |
|:---------|:-------|:---------|
| `openai` | GPT-4o, GPT-4o-mini, o1, o3-mini | General purpose, reasoning |
| `anthropic` | Claude Sonnet 4, Claude Haiku | Long context, safety |
| `azure_openai` | Same as OpenAI, enterprise managed | Compliance, data residency |
| `local` | Ollama, vLLM, llama.cpp | On-premise, air-gapped |

> The inline agent `model.provider` enum is the narrow set above
> (`openai` / `azure_openai` / `anthropic` / `local`). **Model-registry** entries
> (`ModelProviderSchema`) accept a wider set: also `google`, `cohere`,
> `huggingface`, `custom`.

### Model Selection Guidelines

| Scenario | Recommended |
|:---------|:------------|
| Complex reasoning, multi-step planning | GPT-4o / Claude Sonnet 4 |
| High-volume, low-latency | GPT-4o-mini / Claude Haiku |
| Sensitive data, on-premise | Local models via Ollama |
| Structured data extraction | Any model + `structuredOutput` config |

### Temperature Guidelines

| Value | Use Case |
|:------|:---------|
| `0.0–0.3` | Factual Q&A, data extraction, code generation |
| `0.3–0.7` | Conversational agents, customer support |
| `0.7–1.0` | Creative writing, brainstorming |
| `> 1.0` | Experimental / highly creative (use with caution) |

---

## Structured Output

Force the agent to respond in a specific format:

```typescript
structuredOutput: {
  format: 'json_schema',
  schema: {
    type: 'object',
    properties: {
      summary: { type: 'string' },
      priority: { type: 'string', enum: ['low', 'medium', 'high'] },
      action_items: { type: 'array', items: { type: 'string' } },
    },
    required: ['summary', 'priority'],
  },
  retry: { maxAttempts: 3 },
}
```

---

## Common Pitfalls

1. **Overly broad instructions.** Agents with vague instructions hallucinate
   more. Be specific about what the agent should and should not do.
2. **Too many tools per skill.** Keep skills focused (3–8 tools). If a skill
   has 15+ tools, split it.
3. **Missing guardrails.** Always define `blockedTopics` and
   `requireApprovalFor` destructive operations.
4. **Ignoring tool descriptions.** The LLM uses tool `description` to decide
   when to call it. Poor descriptions = wrong tool selection.
5. **Not testing trigger phrases.** Ambiguous trigger phrases cause skill
   conflicts. Test with edge-case inputs.
6. **RAG without score threshold.** Without a threshold, low-relevance
   passages pollute the context window and degrade responses.

---

## CRM AI Blueprint (Agent + Skill + RAG)

Reference implementation shape: `src/{agents,skills,rag}/`

| Layer | CRM File | Pattern |
|:--|:--|:--|
| Persona agent | `agents/sales-copilot.agent.ts` | Keep agent role-focused; compose capabilities via `skills[]` |
| Reusable skill | `skills/lead-qualification.skill.ts` | Encode trigger phrases + trigger conditions + bounded toolset |
| Knowledge pipeline | `rag/sales-knowledge.rag.ts` | Define embedding, vector store, chunking, retrieval, reranking as metadata |
| Central registration | `agents/index.ts`, `skills/index.ts`, `rag/index.ts` | Export typed aggregates and register in `defineStack()` |

Default for metadata apps: keep **few persona agents**, push business capability
logic into **skills**, and wire domain knowledge through **RAG pipelines**.

---

## Verify your work

After authoring a `*.agent.ts` / `*.tool.ts` / `*.skill.ts` or a model-registry
entry, run the author-time gate before reporting done:

```bash
os validate     # Zod schema + CEL predicate validation + bindings (no artifact)
# or: os build  # the same gates, plus emits dist/
```

It confirms the agent/tool/model metadata conforms to the protocol and that any
CEL predicate (e.g. a tool's availability condition) parses and resolves. In a
scaffolded project the gate is `npm run validate`. See objectstack-platform →
**Verify your work**.

---

## References

See [references/_index.md](./references/_index.md) for the full list of Zod
schemas (with one-line descriptions) — pointers into
`node_modules/@objectstack/spec/src/`. Always `Read` the source for exact field
shapes; do not rely on memory of property names.

