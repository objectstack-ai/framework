---
"@objectstack/service-ai": patch
---

fix(ai): keep platform agents in the runtime catalog regardless of alias-map timing.

`AgentRuntime.listAgents()` filtered the catalog to platform agents by the
in-memory `registerAgentAlias` values, so a missed/late alias registration
(e.g. a cloud package's module-load `registerAgentAlias('metadata_assistant',
'build')` not yet applied) silently dropped a real platform agent like `build`
from `GET /api/v1/ai/agents`. The catalog now recognises a platform agent by
the intrinsic package-protection envelope stamped on built-ins at registration
(`_provenance`/`_lock`/`_packageId`, or a still-public `protection` block),
with the alias-table values kept only as a belt-and-suspenders fallback. Stray
tenant custom agents (ADR-0063 §2, withdrawn) still stay filtered out.
