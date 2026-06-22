# @objectstack/lint

Static, build-time validation for an ObjectStack metadata graph.

Every rule is a pure `(stack) => Finding[]` function — no I/O, no runtime, no
filesystem. It operates on an in-memory, schema-parsed stack object, so the
same rules run wherever a stack can be assembled: the CLI's `os validate` /
`compile`, and any other consumer (e.g. AI-driven authoring) that wants to hold
generated metadata to the same bar as hand-authored metadata.

Dependency direction is one-way — `lint` → `@objectstack/spec` (the contract).
It never depends on a runtime and is never bundled into a frontend.

## API

- `validateWidgetBindings(stack)` — dashboard widget → dataset → measure/dimension
  reference integrity, chart-config bindings, and measure-aggregation coherence
  (e.g. SUM of a `percent` field is meaningless).
- `validateStackExpressions(stack)` — CEL/predicate validity for field
  conditionals, sharing rules, action `visible`/`disabled`, lifecycle hooks
  (ADR-0032).

```ts
import { validateWidgetBindings, validateStackExpressions } from '@objectstack/lint';

const findings = [
  ...validateWidgetBindings(stack),
  ...validateStackExpressions(stack),
];
const errors = findings.filter((f) => f.severity === 'error');
```
