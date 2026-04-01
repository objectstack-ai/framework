# AI Agent Design — Skill & Tool Reference

> Auto-derived from `packages/spec/src/ai/agent.zod.ts`, `skill.zod.ts`, and related schemas.
> This file is for quick reference only. The Zod source is the single source of truth.

## Agent Schema Properties

| Property | Required | Description |
|:---------|:---------|:------------|
| `name` | ✅ | Unique identifier (snake_case) |
| `label` | ✅ | Human-readable name |
| `role` | ✅ | Agent persona description |
| `instructions` | ✅ | System prompt |
| `skills` | — | Skill names (primary model) |
| `tools` | — | Direct tool refs (legacy) |
| `model` | — | LLM config (provider, model, temperature) |
| `knowledge` | — | RAG knowledge sources |
| `guardrails` | — | Safety constraints |
| `structuredOutput` | — | Output format config |
| `temperature` | — | Creativity (0.0–2.0) |
| `maxTokens` | — | Response limit |
| `active` | — | Enable/disable |

## Skill Schema Properties

| Property | Required | Description |
|:---------|:---------|:------------|
| `name` | ✅ | Unique identifier (snake_case) |
| `label` | ✅ | Human-readable name |
| `tools` | ✅ | Tool name array |
| `active` | ✅ | Enabled (default: true) |
| `description` | — | What the skill does |
| `instructions` | — | Skill-scoped LLM guidance |
| `triggerPhrases` | — | Natural language activation |
| `triggerConditions` | — | Programmatic activation rules |
| `permissions` | — | Required roles |

## Trigger Condition Operators

| Operator | Meaning |
|:---------|:--------|
| `eq` | Equals |
| `neq` | Not equals |
| `in` | Value in array |
| `not_in` | Value not in array |
| `contains` | String contains |

## Tool Types

| Type | Purpose |
|:-----|:--------|
| `action` | Server-side action |
| `flow` | Launch a flow |
| `query` | Query ObjectStack records |
| `vector_search` | Semantic search |

## LLM Providers

| Provider | Models |
|:---------|:-------|
| `openai` | GPT-4o, GPT-4o-mini, o1, o3-mini |
| `anthropic` | Claude Sonnet 4, Claude Haiku |
| `azure_openai` | Enterprise-managed OpenAI |
| `local` | Ollama, vLLM, llama.cpp |

## Structured Output Formats

| Format | Description |
|:-------|:------------|
| `json_object` | Free-form JSON |
| `json_schema` | JSON validated against a schema |
| `regex` | Output must match a regex |
| `grammar` | Context-free grammar (local models) |
| `xml` | XML format |

## RAG Pipeline Properties

| Property | Description |
|:---------|:------------|
| `sources` | Data sources (objects, documents) |
| `indexes` | Vector embedding config |
| `retrieval.topK` | Number of results to retrieve |
| `retrieval.scoreThreshold` | Minimum relevance score |
| `retrieval.reranker` | Re-ranking model |
