// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

// The `ask` agent PERSONA (`ASK_AGENT`) + its data-explorer/actions-executor
// skills are a commercial feature and moved to the cloud-only
// @objectstack/service-ai-studio package; they attach via the `ai:ready` hook.
// Only the canonical/legacy NAME CONSTANTS and the back-compat alias registry
// stay open here (the mechanism the cloud persona registers against). The cloud
// AI Studio plugin likewise registers its own `metadata_assistant`→`build`
// alias via `registerAgentAlias`.
export {
  ASK_AGENT_NAME,
  LEGACY_DATA_AGENT_NAME,
  registerAgentAlias,
  resolveAgentAlias,
  agentAliasEntries,
  platformAgentNames,
} from './agent-aliases.js';
