---
'@objectstack/mcp': minor
---

feat(mcp): generic ObjectStack Agent Skill generator (ADR-0036 Phase 2b)

Adds `renderSkillMarkdown({ mcpUrl, envName })` — produces a portable
`SKILL.md` (open Agent Skills standard: Claude Code, OpenAI Codex, Gemini CLI,
Copilot, Cursor, …) that teaches any skills-capable agent how to drive an
ObjectStack environment over MCP.

Per ADR-0036 Amendment C, this is ONE generic skill, not a per-app artifact:
- the content never enumerates a tenant's schema — it instructs the agent to
  discover live via `list_objects` / `describe_object`, so one install works for
  every app the caller's key can reach and a new app needs no reinstall;
- only the connection URL is environment-specific, slotted in by the caller;
- it documents the object-CRUD tools, auth via `x-api-key` (Bearer is session
  auth), and the governance model (every call runs under the caller's
  permissions + RLS — fewer rows / write rejections are expected, not bugs).

Exported: `renderSkillMarkdown`, `OBJECTSTACK_SKILL_NAME`,
`OBJECTSTACK_SKILL_DESCRIPTION`, `RenderSkillOptions`. The objectui/cloud
surfacing layer calls this to offer a one-click skill download alongside the
env's remote-MCP URL and a show-once key.
