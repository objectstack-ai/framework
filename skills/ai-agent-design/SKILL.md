---
name: ai-agent-design
description: >
  Design ObjectStack AI agents, skills, tools, and RAG pipelines.
  Use when configuring autonomous agents, defining agent skills and tool sets,
  setting up retrieval-augmented generation, or integrating LLM models
  in an ObjectStack project.
license: Apache-2.0
compatibility: Requires @objectstack/spec Zod schemas (v4+)
metadata:
  author: objectstack-ai
  version: "1.0"
  domain: ai
  tags: agent, skill, tool, rag, llm
---

# AI Agent Design — ObjectStack AI Protocol

Expert instructions for designing AI-powered agents, skills, tools, and RAG
pipelines using the ObjectStack specification. This skill covers the
Agent → Skill → Tool three-tier architecture aligned with Salesforce
Agentforce, Microsoft Copilot Studio, and ServiceNow Now Assist patterns.

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
    blockedTopics: ['internal_pricing', 'employee_data'],
    maxTurns: 20,
    requireApprovalFor: ['delete_record', 'escalate'],
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

## References

- Zod source: `packages/spec/src/ai/agent.zod.ts`
- Zod source: `packages/spec/src/ai/skill.zod.ts`
- Zod source: `packages/spec/src/ai/tool.zod.ts`
- Zod source: `packages/spec/src/ai/rag-pipeline.zod.ts`
- Zod source: `packages/spec/src/ai/model-registry.zod.ts`
- Documentation: `content/docs/references/ai/`
