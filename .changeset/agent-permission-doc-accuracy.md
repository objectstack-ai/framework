---
'@objectstack/mcp': patch
---

Docs accuracy: correct how the MCP SKILL.md describes an agent's authority to match the shipped ADR-0090 D10 model. An OAuth-connected client is an **agent acting on behalf of** the signing-in user — every call is bounded by the **intersection** of the consent scopes and that user's own permissions/RLS (a `data:read` token can never write, even where the user could), not simply "runs as you". (Companion doc-only edits to `content/docs/ai/agents.mdx` and `docs/design/permission-model.md` correct the same framing and honestly mark the still-planned agent guardrails — the grant-ceiling lint, destructive-action co-sign, and double-signature audit provenance.)
