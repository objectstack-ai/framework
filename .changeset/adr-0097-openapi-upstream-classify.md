---
'@objectstack/connector-openapi': minor
---

feat(connector-openapi): degrade + retry on an unreachable remote spec URL (#3049 follow-up)

The `openapi` provider fetches `providerConfig.spec` when it is an http(s) URL.
That fetch previously threw plain on any failure, so a momentarily-unreachable
spec endpoint aborted the whole app boot. It now classifies the fault the same
way `connector-mcp` classifies its connect path (ADR-0097):

- **Network error** (DNS / connection refused / timeout) or a **transient HTTP
  status** (`408` / `429` / `5xx`, mirroring the `retryableStatusCodes`
  convention) throws `ConnectorUpstreamUnavailableError` — the materializer
  degrades the instance (`state: 'degraded'` on `GET /connectors`, dispatch
  fails clearly) and retries with backoff plus on every `metadata:reloaded`.
- A **wrong URL** (non-retryable `4xx`) or an **unparseable document** stays a
  plain, fatal configuration fault.

Inline and file-path (`#3016`) specs do no boot I/O and are unaffected.
