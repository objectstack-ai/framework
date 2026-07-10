---
'@objectstack/mcp': minor
'@objectstack/platform-objects': patch
---

feat(mcp): plugin-carried "Connect an agent" Setup page (#2714 Phase 1)

The MCP plugin now registers a Setup page (`connect_agent`) plus its
navigation entry under Integrations — the nav lives and dies with the
capability (cloud ADR-0009 principle) and follows the surface's default-on
switch: an opted-out deployment (`OS_MCP_SERVER_ENABLED=false`) gets no page
and no entry. The page body is the `mcp:connect-agent` SDUI widget provided
by objectui (objectui#2372): env MCP URL, per-client connect cards, SKILL.md
download, API-key minting. zh-CN nav label included.
