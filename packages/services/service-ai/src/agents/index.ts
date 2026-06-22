// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

export { ASK_AGENT, ASK_AGENT_NAME, LEGACY_DATA_AGENT_NAME } from './ask-agent.js';
export { registerAgentAlias, resolveAgentAlias, agentAliasEntries } from './agent-aliases.js';
// The build (authoring) agent moved to the cloud-only
// @objectstack/service-ai-studio package; it registers its own
// `metadata_assistant`→`build` alias via `registerAgentAlias`.
