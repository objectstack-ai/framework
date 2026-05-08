---
name: objectstack-formula
description: >
  Author CEL expressions for ObjectStack formulas, predicates (validation /
  sharing / visibility), conditions, and dynamic seed values.
  ALWAYS use this skill when you see: "formula field", "computed field",
  "validation rule", "sharing rule", "visibleOn", "conditionalRequired",
  "hook condition", "flow decision", "predicate", "criteria", "dynamic seed
  date", "TODAY()", "ISBLANK", "CONCAT", "Salesforce formula", "expression",
  "CEL", "F`...`", "P`...`", "cel`...`".
  Do NOT use for: SQL fragments (driver-native), cron schedules (use cron
  dialect), or L2 hook bodies (use objectstack-hooks).
license: Apache-2.0
compatibility: Requires @objectstack/spec v4+ and @objectstack/formula
metadata:
  author: objectstack-ai
  version: "1.0"
  domain: expression
  tags: cel, formula, predicate, condition, validation, visibility, seed-dynamic
---

# Expressions (CEL) — ObjectStack Formula Protocol

ObjectStack has **one** expression language across every domain that needs
computation or boolean predicates: **CEL** (Google Common Expression
Language). This skill is the canonical reference for AI authors emitting
formula / condition / predicate / dynamic-seed metadata.

> **Strategic context.** The future authors of metadata are AI agents.
> CEL was chosen because it has (a) a formal grammar, (b) a public training
> corpus, (c) AST-first persistence, and (d) sandboxed bounded execution.
> The previous custom Salesforce-flavor engine was **deleted** in M9.5.
> **Do not emit Salesforce-flavor syntax** — it will silently evaluate to
> `null`.

---

## Skill Boundaries

| Need | Use instead |
|:---|:---|
| Define a `type: 'formula'` field | objectstack-schema (and embed CEL via `F\`...\``) |
| Define seed records | objectstack-seed (use `cel\`...\`` for dynamic dates) |
| Author flow / automation step | objectstack-automation (use `P\`...\`` for `condition`) |
| Author L2 hook body (TS code) | objectstack-hooks |
| Cron schedule | objectstack-automation (`schedule.expression` is `cron` dialect) |
| SQL fragment | driver-native; not unified into the expression registry |

---

## Core contract

Every expression in metadata is the same envelope:

```ts
type Expression = {
  dialect: 'cel' | 'js' | 'cron';
  source?: string;
  ast?: unknown;
  meta?: { rationale?: string; generatedBy?: string };
};
```

**Authors emit `dialect: 'cel'`.** A bare string is accepted at input time as
shorthand for `{ dialect: 'cel', source }`; the build artifact persists the
full envelope. Prefer the tagged templates `F`, `P`, or `cel` from
`@objectstack/spec` because they signal intent at the call site.

> **AI authors:** when emitting structured-output JSON for metadata, always
> emit the full envelope `{ dialect: 'cel', source: '...' }` — do not emit
> bare strings. After M9.7 lands, you will emit `ast` directly. Until then,
> emit `source` and let `objectstack compile` parse it.

---

## CEL syntax cheat-sheet

| Concept | CEL |
|:---|:---|
| Current record field | `record.first_name` |
| Previous record (update hooks) | `previous.status` |
| Hook input payload | `input.amount` |
| Identity context | `os.user.id`, `os.org.slug`, `os.env` |
| Equality | `==` / `!=` |
| Logical | `&&` / `\|\|` / `!` |
| Ternary | `cond ? a : b` |
| String literal | `'single quotes'` (always) |
| Membership | `record.region in ['us', 'eu']` |
| Key existence (NOT null-safety) | `has(record.foo)` |
| Null check | `record.foo == null` or `isBlank(record.foo)` |

### `has()` is NOT a null check

`has(record.x)` is **true whenever the key exists**, even when its value is
`null`. To check for "value present and non-blank" use the stdlib helper
`isBlank()` or compare to `null` explicitly.

### Null + string throws

CEL has no implicit `null` coercion. `null + 'foo'` throws
`no such overload: dyn<null> + string`. Wrap every nullable string operand
in `coalesce(..., '')`.

---

## ObjectStack CEL standard library

Registered automatically. Source:
[`packages/formula/src/stdlib.ts`](../../packages/formula/src/stdlib.ts).

| Function | Returns | Notes |
|:---|:---|:---|
| `now()` | timestamp | Pinned per evaluation run; deterministic in build |
| `today()` | timestamp | UTC start-of-day |
| `daysFromNow(n)` | timestamp | `today() + n*24h` |
| `daysAgo(n)` | timestamp | `today() - n*24h` |
| `isBlank(v)` | bool | true for `null`, `undefined`, `''`, `[]` |
| `coalesce(v, fallback)` | dyn | `v` when non-null, else `fallback` |

If you need a helper that doesn't exist, prefer adding it to the stdlib
(small, pure, dependency-free) over inlining a complex CEL expression.

---

## Mandatory patterns for AI emission

### 1. Computed text formula — always coalesce nullable operands

✅ **Correct**

```ts
F`coalesce(record.salutation, '') + ' '
  + coalesce(record.first_name, '') + ' '
  + coalesce(record.last_name, '')`
```

❌ **Wrong** (CEL throws on null + string)

```ts
F`record.salutation + ' ' + record.first_name + ' ' + record.last_name`
```

### 2. Conditional numeric formula — guard divisor

✅

```ts
F`coalesce(record.cost, 0) > 0
  ? ((coalesce(record.revenue, 0) - record.cost) * 100.0) / record.cost
  : 0.0`
```

### 3. Predicate (visibility / required / validation)

✅

```ts
P`record.status == 'qualified'`
P`record.amount > 10000 && record.region in ['us', 'eu']`
P`!isBlank(record.po_number)`
```

❌ Salesforce-flavor — will compile but evaluate to `null`:

```ts
"status = 'qualified'"
"amount > 10000 AND region IN ('us', 'eu')"
"NOT(ISBLANK(po_number))"
```

### 4. Dynamic seed value — use `cel\`\`` not `new Date()`

✅

```ts
{ close_date: cel`daysFromNow(45)`, created_at: cel`now()` }
```

❌ Compile-time evaluation — every customer gets the package author's clock:

```ts
{ close_date: new Date(Date.now() + 45 * 86400000), created_at: new Date() }
```

This is the determinism gate: `objectstack build` runs twice produce
byte-identical `dist/objectstack.json` only when seed dates use CEL.

### 5. Update hook condition — `previous` vs `record`

✅

```ts
P`previous.status != 'escalated' && record.status == 'escalated'`
```

ISCHANGED-style logic does not exist as a function; use explicit `previous`
comparison.

---

## Mechanical translation table (legacy → CEL)

When migrating Salesforce-flavor metadata, apply these rules in order:

| Legacy | CEL |
|:---|:---|
| `bare_field` | `record.bare_field` |
| `OLD.x` | `previous.x` |
| `NEW.x` | `record.x` |
| `=` (comparison) | `==` |
| `<>` | `!=` |
| `AND` | `&&` |
| `OR` | `\|\|` |
| `NOT(x)` | `!x` |
| `"abc"` | `'abc'` |
| `IF(c, a, b)` | `c ? a : b` |
| `ISBLANK(x)` | `isBlank(record.x)` |
| `CONCAT(a, b)` | `coalesce(a, '') + coalesce(b, '')` |
| `TODAY()` / `NOW()` | `today()` / `now()` |
| `IN (a, b, c)` | `in [a, b, c]` |
| `ISCHANGED(x)` | `previous.x != record.x` |
| `MONTH_DIFF`, `MID`, `LEFT`, `RIGHT`, `SUBSTITUTE` | _not in stdlib — propose addition_ |

---

## Surfaces that take an Expression

All of these spec fields accept `string | Expression`. The build normalizes
to the envelope.

| Surface | Field | Dialect |
|:---|:---|:---|
| `Field` | `formula` (when `type: 'formula'`) | cel |
| `Field` | `conditionalRequired` | cel |
| `Field` | `visibleOn` | cel |
| `ConditionalValidation` | `when` | cel |
| `ObjectFieldGroup` | `visibleOn` | cel |
| `View` | `visibleOn` | cel |
| `View.criteria` | filter expression | cel |
| `Action` | `disabled` | cel (or boolean) |
| `Hook` | `condition` | cel |
| `SharingRule` | `condition` | cel |
| `Flow.decision` | `expression` | cel |
| `Dataset.records[*]` | any value | cel (via `cel\`\``) |
| `Job.schedule` | `expression` | **cron** |
| `Hook` body / Mapping `transform` | TS source | **js** |

---

## Determinism contract

Builds are deterministic only if:

1. All seed dynamic values use `cel\`...\`` (no `new Date()`, no `Date.now()`).
2. CEL stdlib helpers honor the pinned `now` from `EvalContext`.
3. No expression source contains random / non-pure data.

CI runs `objectstack build` twice and asserts SHA-1 match.

---

## Open questions (track in ROADMAP M9.7+)

- Authors will emit `ast` directly once `CelExprSchema` is published as JSON
  Schema for AI constrained decoding (M9.7).
- A visual node-graph editor backed by `CelExprSchema` is M9.8 (Studio).

---

## See also

- [`content/docs/guides/formula.mdx`](../../content/docs/guides/formula.mdx) — human-facing guide
- [`packages/formula/`](../../packages/formula/) — engine + stdlib
- [`packages/spec/src/shared/expression.zod.ts`](../../packages/spec/src/shared/expression.zod.ts) — `Expression`, `ExpressionInput`, `cel` / `F` / `P`
- ROADMAP M9 — Expression Unification milestone
- north-star §8 — "No private expression DSL"
