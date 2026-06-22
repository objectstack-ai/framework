// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { Agent } from '@objectstack/spec/ai';

/**
 * Built-in `ask` agent — the **data product** (≈ Claude Chat).
 *
 * Per ADR-0063 the kernel ships exactly two agents, bound by *surface*:
 *   - `ask`   — conversational read/query/explore over records + run the
 *               business actions the app already exposes. End-user audience,
 *               RLS-bounded, fast turns. Open-source · free (this package).
 *   - `build` — agentic authoring of *metadata* (objects, fields, views,
 *               flows) through plan → draft → verify → publish. Builder
 *               audience, governance-gated. Cloud-only · paid
 *               (`@objectstack/service-ai-studio`).
 *
 * The user never picks an agent — the surface they are in binds it (data
 * console → `ask`, Studio → `build`). There is no per-turn intent classifier:
 * a `build`-shaped request arriving at `ask` is declined and redirected to the
 * builder, never silently re-routed into authoring (ADR-0063 §1/§5).
 *
 * Following the platform's metadata-driven philosophy, this agent does not
 * hardcode the tools it can call. Its tool set is the union of its skills'
 * tools (ADR-0064): `schema_reader` (shared read-only schema/query tools),
 * `data_explorer` (records + aggregation + charts), and `actions_executor`
 * (business actions). Authoring tools are *not* in this set — `ask` cannot
 * author, by construction.
 *
 * @example
 * ```
 * POST /api/v1/ai/agents/ask/chat
 * {
 *   "messages": [{ "role": "user", "content": "Show me all active accounts" }],
 *   "context": { "objectName": "account" }
 * }
 * ```
 */

/**
 * Canonical name of the platform's `ask` (data) agent.
 *
 * This is the implicit default copilot for every application that does not
 * pin its own `app.defaultAgent`. Studio is the only built-in app that
 * overrides it (→ the `build` authoring agent). Keeping the name as an
 * exported constant lets the runtime resolve the fallback deterministically
 * instead of guessing "first active agent".
 *
 * Renamed from `data_chat`→`ask`; the legacy name stays resolvable via the
 * alias table (see `agent-aliases.ts`).
 */
export const ASK_AGENT_NAME = 'ask';

/** Legacy id this agent was renamed from (kept for back-compat / migrations). */
export const LEGACY_DATA_AGENT_NAME = 'data_chat';

export const ASK_AGENT: Agent = {
  name: ASK_AGENT_NAME,
  label: 'Assistant',
  role: 'Business Application Assistant',
  // ADR-0063 — the `ask` data product. This persona ONLY answers questions
  // about the user's data and runs business actions the app exposes. It does
  // NOT build or change the application; app-building lives on the separate
  // `build` agent (cloud Builder/Studio). There is no per-turn intent
  // classifier — the surface bound this agent (ADR-0063 §1).
  surface: 'ask',
  instructions: `You are the assistant for this business application platform. You help the user EXPLORE THEIR DATA — answer questions, list and count records, aggregate, search, and draw charts — and PERFORM business operations the application already exposes (its actions).

You do NOT build or change the application itself (objects, fields, views, dashboards, flows, whole apps), and you have no tools to do so. If the user asks you to build, create, design, or modify the app, do not attempt it and do not outline a system as if you could: briefly say that app-building lives in the Builder (the separate "build" experience), then offer to help explore or report on the existing data instead.

Always answer in the same language the user is using. Detailed tool-usage guidance is supplied by the skills attached to this agent.`,

  model: {
    provider: 'openai',
    model: 'gpt-4',
    // Low temperature: data answers should be deterministic and grounded.
    temperature: 0.2,
    maxTokens: 4096,
  },

  // Capability bundles live on skills; the agent only references them.
  // `schema_reader` (surface:'both') = shared read-only schema/query tools;
  // `data_explorer` + `actions_executor` (surface:'ask') = the data product's
  // exploration and action tools. No authoring skills — those are `build`'s
  // and only exist on the cloud package (ADR-0063 §5 / ADR-0064).
  skills: ['schema_reader', 'data_explorer', 'actions_executor'],

  active: true,
  visibility: 'global',

  guardrails: {
    maxTokensPerInvocation: 8192,
    // Data answers + actions; no long-running authoring loop here.
    maxExecutionTimeSec: 30,
    blockedTopics: ['delete_records', 'drop_database', 'raw_sql', 'system_tables'],
  },

  planning: {
    strategy: 'react',
    maxIterations: 10,
    allowReplan: true,
  },

  // ADR-0063 §2 / ADR-0010 §3.7 — built-in platform agent. Tenants extend the
  // platform with skills + tools, never by editing this persona, so it is fully
  // locked against overlay edits/deletes. (The platform's own boot-time refresh
  // writes through the authoritative register path, which the lock does not gate.)
  // This author-protection envelope is ALSO the intrinsic, persisted signal that
  // `AgentRuntime.listAgents()` keys off to keep `ask` in the catalog regardless
  // of whether the in-memory alias table happened to be populated — a missed
  // alias registration must never hide a real platform agent.
  protection: {
    lock: 'full',
    reason: 'Built-in platform assistant shipped by @objectstack/service-ai.',
  },
};
