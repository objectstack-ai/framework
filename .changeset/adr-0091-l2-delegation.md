---
'@objectstack/spec': minor
'@objectstack/plugin-security': minor
---

ADR-0091 L2 — delegation of duty (职务代理): self-service, time-boxed position delegation without administration.

- **spec**: `PositionSchema.delegatable` (default false) + the `sys_position.delegatable` field. A position opts in to being self-service delegated.
- **plugin-security (D12 gate)**: a new self-service branch — a non-admin holder of a `delegatable` position may insert a `sys_user_position` row assigning it to a delegate, WITHOUT any `adminScope`, iff the row is a well-formed delegation: `delegated_from` = the writer (you delegate your OWN authority), a mandatory `valid_until` in the future and within the 30-day ceiling, a mandatory `reason`, and the writer holds the position **directly** (validity-filtered — a grant that itself arrived via delegation is not re-delegatable). Insert-only, so a delegation is not self-renewable. A `delegatable` position that distributes an `adminScope`-carrying set is rejected fail-closed — administration is never self-delegated (D12 containment). Dual audit: `granted_by` (writer) + `delegated_from` (authority source).
- **plugin-security (explain)**: `buildContextForUser` surfaces delegation provenance; the principal layer attributes a delegated position "via delegation from X, until Y".
- **liveness / proof (ADR-0054)**: `position.delegatable` is a bound high-risk class with an end-to-end dogfood proof (`delegation-of-duty`) — a gated delegation write over the real HTTP API, then the delegate's grant resolving in-window and dying at `valid_until` via the real resolver.

Break-glass activation and recertification campaigns stay enterprise (D7); their community shapes are the L1 substrate.
