# Examples — Agent Instructions

These are reference ObjectStack apps (`app-crm`, `app-todo`, `app-showcase`).
They double as the canonical shape of a user-scaffolded project, so the metadata
here should always be correct.

## Verify after every metadata change

ObjectStack metadata mistakes fail **silently at runtime**, not at edit time:

- a bare field ref in a predicate (`done` instead of `record.done`) evaluates to
  `null` and silently hides the action/validation on every record (#2183/#2185);
- a dangling dashboard widget binding renders an empty chart (ADR-0021).

`objectstack validate` catches both at author time. It runs the same gates as
`objectstack build` — Zod protocol schema, CEL/predicate validation with
`record.<field>` existence checks, and widget-binding integrity — but emits no
`dist/`, so it is the fast inner-loop check. It exits non-zero with a located,
corrective message.

After editing any `*.object.ts` / `*.view.ts` / `*.action.ts` / `*.flow.ts` /
`*.dashboard.ts`, run the gate for that example:

```bash
pnpm --filter @objectstack/example-crm      validate   # + typecheck, test
pnpm --filter @objectstack/example-todo      validate
pnpm --filter @objectstack/example-showcase  verify     # validate + typecheck + test
```

**Do not report a metadata change as done until `validate` passes.** When in
doubt about how to express a predicate or binding, consult the relevant
`objectstack-*` skill (e.g. `objectstack-formula` for CEL, `objectstack-ui` for
views/actions/dashboards).
