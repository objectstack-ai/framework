// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Back-compat aliases for renamed built-in agents.
 *
 * The platform's built-in agents were renamed (Path A) so the friendly console
 * URL equals the real identifier: the data agent `data_chat`→`ask`. Old clients,
 * bookmarks, and persisted `ai_conversations.agent_id` values still carry the
 * legacy name, so {@link AgentRuntime.loadAgent} normalizes a requested name
 * through this table before loading the record — `/agents/data_chat/chat` keeps
 * resolving to the `ask` agent.
 *
 * The table is a process-wide registry so each package that owns a built-in
 * agent registers ITS OWN rename and the two stay decoupled: the framework
 * seeds `data_chat`→`ask` here, and the cloud AI Studio plugin registers
 * `metadata_assistant`→`build` at init via {@link registerAgentAlias}. That
 * decoupling is what makes the two renames independently safe — neither alias
 * points at an id its owning package hasn't registered yet.
 *
 * Aliases are resolution-only: they are NOT separate metadata records, so the
 * agent list (`GET /api/v1/ai/agents`) still shows each agent exactly once
 * under its canonical name.
 *
 * ── Why the registry is anchored on `globalThis` ────────────────────────────
 * This module ships as BOTH an ESM (`import` → `dist/index.js`) and a CJS
 * (`require` → `dist/index.cjs`) build. A bare module-level `new Map()` gives
 * EACH build its own copy, so an alias registered through one build is invisible
 * to a reader in the other. That is the exact bug this fixes: the cloud AI Studio
 * plugin is bundled as CJS and `require`s the CJS copy to call
 * {@link registerAgentAlias}, while the framework's agent routes are loaded as
 * ESM and read the ESM copy via {@link resolveAgentAlias} — so `metadata_assistant`
 * resolved to nothing and `/agents/metadata_assistant/chat` 404'd even though the
 * Studio had "registered" the alias. Anchoring the Map (and its seed) on a
 * `Symbol.for` key makes the two builds share ONE table.
 */
const ALIAS_REGISTRY_KEY: unique symbol = Symbol.for('@objectstack/service-ai#agentNameAliases');

/** The single process-wide alias table, created (and seeded) on first touch. */
function aliasRegistry(): Map<string, string> {
  const g = globalThis as typeof globalThis & { [ALIAS_REGISTRY_KEY]?: Map<string, string> };
  let map = g[ALIAS_REGISTRY_KEY];
  if (!map) {
    // Seed the framework's own data agent rename on first access.
    map = new Map<string, string>([['data_chat', 'ask']]);
    g[ALIAS_REGISTRY_KEY] = map;
  }
  return map;
}

/**
 * Register a legacy→canonical agent-name alias. Idempotent; a later call for the
 * same legacy name wins. Call at plugin init, BEFORE the canonical agent is
 * looked up, so a legacy request resolves to the registered canonical id.
 */
export function registerAgentAlias(legacy: string, canonical: string): void {
  if (legacy && canonical && legacy !== canonical) {
    aliasRegistry().set(legacy, canonical);
  }
}

/** Resolve a (possibly legacy) agent name to its canonical id, or itself. */
export function resolveAgentAlias(name: string): string {
  return aliasRegistry().get(name) ?? name;
}

/** Test/diagnostics helper: a snapshot of the current alias table. */
export function agentAliasEntries(): Array<[string, string]> {
  return Array.from(aliasRegistry().entries());
}

/**
 * The set of platform-owned, canonical agent ids known to this process.
 *
 * ADR-0063 §2 closes `*.agent.ts` to third parties: the kernel ships exactly
 * the two platform agents (`ask`, and — where the cloud package is loaded —
 * `build`), each of which registers its own legacy→canonical alias. The alias
 * table's *values* are therefore precisely the canonical platform-agent ids,
 * so the runtime catalog can use this set to filter out any stray custom
 * agent record (e.g. one persisted before tenant agents were withdrawn).
 */
export function platformAgentNames(): Set<string> {
  return new Set(aliasRegistry().values());
}
