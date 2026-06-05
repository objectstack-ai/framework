---
'@objectstack/spec': minor
'@objectstack/connector-rest': patch
'@objectstack/connector-slack': patch
'@objectstack/embedder-openai': patch
'@objectstack/connector-mcp': patch
---

feat(spec): resilientFetch — timeout + backoff for outbound HTTP (P1-1)

Outbound calls in the connectors/embedder were naked `fetch` with no timeout or
retry, so a slow or rate-limited external API could hang an agent turn with no
recovery.

New shared `resilientFetch` (`@objectstack/spec/shared`):
- per-attempt timeout via `AbortController` (default 30s);
- exponential backoff with jitter, up to 3 attempts, on network errors / 429 / 5xx;
- honours a `Retry-After` header on 429;
- never retries a caller-initiated abort (intentional cancellation).

Wired into `connector-rest`, `connector-slack`, and `embedder-openai`.
`connector-mcp` talks through the MCP SDK transport, so it gets a 30s per-request
`timeout` on `callTool` / `listTools` instead.

A stateful per-host **circuit breaker** is deliberately left as a follow-up:
timeout + backoff already removes the hang/no-recovery risk.
