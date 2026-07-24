---
"@objectstack/spec": minor
"@objectstack/runtime": minor
---

feat: enforce declared action-param contract at dispatch — ADR-0104 phase 2 (D2)

An action's declared `params[]` (`type` / `required` / `multiple` / `options` /
`reference`) was a complete value contract that only ever informed the client
dialog — the server passed `reqBody.params` straight to the handler unvalidated
(REST `handleActions` and the MCP `invokeBusinessAction` path), and handlers
read an untyped bag. D2 makes the declaration enforced and typed.

- **`@objectstack/spec/ui`** now exports `validateActionParams` (+
  `ResolvedActionParam`, `ActionParamIssue`, `ACTION_PARAM_BUILTIN_KEYS`): a
  pure check that validates a params bag against resolved param declarations,
  reusing the D1 `valueSchemaFor` so option membership, `multiple` arrays and
  reference-id shape all ride the one value contract. Also exports the typed
  authoring surface `ActionHandler` / `ActionHandlerContext` /
  `ActionEngineFacade` — annotate a handler with `ActionHandler` instead of
  `(ctx: any)`.
- **Dispatch (runtime)**: both the REST and MCP action paths resolve the
  action's declared params (field-backed params resolved through the referenced
  object field) and validate the request bag **before the handler runs** —
  required presence, per-type value shape, and unknown keys (the dispatcher's
  own `recordId` / `objectName` are allowlisted).

**Warn-first rollout (ADR-0104 R3).** A violation is **logged and passes** by
default — params that were silently wrong before keep working while the drift
becomes visible. Set `OS_ACTION_PARAMS_STRICT_ENABLED=1` to reject with a
`400 VALIDATION` (REST) / an error (MCP). Actions that declare no `params` are
untouched (nothing to validate against). The flip to strict-by-default rides a
later minor once telemetry is quiet.

Not included: file/image params becoming `sys_file` references — that depends
on file-as-reference (ADR-0104 D3). Per-name static typing of `ctx.params` from
the literal `params` array is a deferred DX nicety; the runtime guarantee holds
regardless.
