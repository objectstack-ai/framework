---
"@objectstack/spec": patch
"@objectstack/service-ai": patch
---

fix(service-ai): stamp agent_id on auto-created chat conversations

`/api/v1/ai/agents/:agentName/chat` auto-created its conversation with only
`userId` + `metadata`, leaving `ai_conversations.agent_id` NULL — so per-agent
attribution (analytics, and cloud's per-agent AI metering) was impossible. Thread
the agent through: add optional `ToolExecutionContext.agentId` (spec), set it to
the path `agentName` in agent-routes, and forward `ctx.agentId` into
`conversationService.create({ agentId })` in `autoCreateConversation`. Additive
and backward-compatible (`undefined → null`; the general `/ai/chat` route and
system invocations are unchanged).
