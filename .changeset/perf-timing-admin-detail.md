---
"@objectstack/observability": minor
"@objectstack/plugin-hono-server": minor
"@objectstack/driver-sql": minor
---

feat(observability): admin-only richer per-request timing detail via `X-OS-Debug-Timing: json` (#2408)

Completes the optional "richer JSON" diagnostic from #2408. In addition to the
basic `Server-Timing` header, an admin/service caller can now request a
per-query breakdown — the slowest SQL statements and a query count — by sending
`X-OS-Debug-Timing: json`. The detail is returned in a separate
`X-OS-Debug-Timing-Detail` response header (compact JSON) and is **admin-only,
even under global mode**: an ordinary caller never sees SQL shapes.

- **observability**: `PerfTiming` gains opt-in per-event detail capture
  (`enableDetail` / `recordDetail` / `details`) plus the ambient
  `recordServerTimingDetail`. The disclosure gate gains a `privileged` level
  (set by `allowPerfDisclosure`, read via `isPerfDisclosurePrivileged`) so the
  richer detail can be gated independently of the basic header.
- **driver-sql**: when detail capture is on, the query listener additionally
  records each query's **parametrized** statement (knex's `q.sql`, `?`
  placeholders) — never the bindings, so no literal row value ever enters the
  collector. Zero overhead when detail is off.
- **plugin-hono-server**: `X-OS-Debug-Timing: json` enables detail capture; the
  middleware emits `X-OS-Debug-Timing-Detail` (slowest queries, capped and
  sanitized to header-safe ASCII) only when the principal is a proven admin.

Basic and global behavior are unchanged; `json` is purely additive.
