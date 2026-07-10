---
'@objectstack/mcp': minor
'@objectstack/runtime': minor
---

feat(mcp): `GET /api/v1/mcp/skill` — download the environment-customized Agent Skill

`renderSkillMarkdown()` was export-only; nothing served it over HTTP, so the
"one generic skill" distributable (ADR-0036 Amendment C) had no self-serve
outlet. The runtime dispatcher now serves it at `GET /api/v1/mcp/skill` as
`text/markdown` — public like `/discovery` (generic agent instructions plus a
URL the caller already knows; no schema, no tenant data), gated on the same
default-on MCP switch (404 when opted out), 501 when the MCP plugin isn't
loaded. The environment URL comes from the auth service's canonical
`getMcpResourceUrl()` with a request-host fallback. `MCPServerRuntime` gains
`renderSkill()` so hosts reach the renderer via the registered `'mcp'`
service without a package dependency. Feeds the Setup "Connect an agent"
page (objectui#2363) and the distribution shells (#2714).
