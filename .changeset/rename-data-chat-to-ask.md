---
"@objectstack/service-ai": minor
---

Rename the built-in data agent `data_chat` → `ask` (Path A: friendly console URL == real id). Back-compat preserved via a new process-wide alias registry: `AgentRuntime.loadAgent` normalizes legacy names, so `/agents/data_chat/chat` and persisted `agent_id='data_chat'` keep resolving. `registerAgentAlias()` is exported so other packages register their own renames (cloud AI Studio: `metadata_assistant`→`build`). The plugin prunes the stale legacy agent record on upgrade so the catalog isn't doubled.
