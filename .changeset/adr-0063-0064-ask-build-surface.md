---
"@objectstack/spec": minor
"@objectstack/service-ai": minor
---

feat(ai): split `ask`/`build` agents by surface + tool scoping (ADR-0063/0064).

Two kernel agents bound by surface, not a per-turn classifier. `SkillSchema`
gains `surface: 'ask'|'build'|'both'` and `AgentSchema` gains `surface:
'ask'|'build'` (ADR-0063 §3); an agent's tools are exactly the union of its
surface-compatible skills' tools — incompatible binding is a load error in
`resolveActiveSkills` (ADR-0064 §3). The `ask` agent is now data-only (the
ADR-0040 unified "INTENT FIRST" classifier and the `buildRegisterActive`
degradation shim are removed); a new `schema_reader` (`surface:'both'`) owns
the shared reads `describe_object`/`list_objects`/`query_data` so the build
agent reuses them without dual-listing. `*.agent.ts` is closed to third
parties: the `agent` metadata-type is `allowRuntimeCreate:false,
allowOrgOverride:false` and the runtime catalog lists only platform agents
(ADR-0063 §2). Renames `data-chat-agent.ts`→`ask-agent.ts`,
`DEFAULT_DATA_AGENT_NAME`→`ASK_AGENT_NAME` (the `data_chat`/`metadata_assistant`
aliases stay resolvable).
