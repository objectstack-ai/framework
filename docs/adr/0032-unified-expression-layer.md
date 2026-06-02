# ADR-0032: Unified expression layer — one language (CEL), typed envelopes, build-time validation, no silent failure

**Status**: Proposed (2026-06-02)
**Deciders**: ObjectStack Protocol Architects
**Builds on**: [ADR-0010](./0010-nl-to-flow-authoring.md) + [ADR-0011](./0011-actions-as-ai-tools.md) (AI authoring of metadata — **the design center**), [ADR-0018](./0018-unified-node-action-registry.md) (open action registry), [ADR-0031](./0031-advanced-flow-node-executors-and-dag.md) (structured, statically-analyzable constructs for AI)
**Consumers**: `@objectstack/formula` (CEL engine + stdlib + template interpolation), `@objectstack/spec` (`automation/flow.zod.ts` `ExpressionInputSchema`, every `condition`/`guard`/`value`/template field across data / automation / ui / security), `@objectstack/services/service-automation` (`engine.ts` `evaluateCondition`, `builtin/template.ts`, builtin node executors), `@objectstack/cli` (compile-time validation in `objectstack build`), `../objectui` (flow designer condition/template builders)

**Premise**: the platform is **pre-launch** — no production artifacts, no external authors, no back-compat debt. This ADR therefore specifies the **target end-state directly**, with no deprecation path. This window closes at launch; an expression layer is effectively unchangeable once metadata is in the wild.

---

## TL;DR

The platform today exposes **three syntaxes** for referencing the same data, each with a different rule, and **fails silently** when they are mixed up:

1. **Bare CEL** — `record.amount > 100000` — for predicates (`condition` / `guard` / validation / sharing).
2. **Single-brace template** — `{record.name}`, `{TODAY() + 90}` — for flow node string fields (`notify.title`, `create_record.fields`, `get_record.filter`).
3. **Double-brace mustache** — `{{record.name}}` — for `Object.titleFormat` and notification templates.

These are easy to confuse and **nothing stops the confusion**: a `condition` is typed `string`, any string is silently coerced to `{dialect:'cel'}`, and a CEL parse/eval error is **swallowed and returned as `false`**. A flow then "fires" with `success:true` and does nothing.

This ADR collapses the three syntaxes into **one expression language (CEL)** with exactly **two field shapes** — a **Predicate** (bare CEL → bool) and a **Template** (a string with `{{ CEL }}` interpolation holes) — makes every expression field a **typed envelope** (never a raw `string`), and **validates every expression at build time against the object schema**, deleting the silent-failure path entirely.

The deciding lens, as in ADR-0010/0011/0031, is **AI/pro-code authoring**. When LLMs and `.ts` are first-class authors, correctness must come from **types that make the wrong thing unrepresentable** and **loud compile-time errors**, not from documentation the author may not read.

## Context — current state (verified 2026-06-02)

This came out of a real incident — issue #1491, *"record-change trigger plugin loads but flows never fire on data writes"* (reported against **7.4.1**, repro app `hotcrm`, flow `lead_assignment`). The reporter observed that `POST /api/v1/data/crm_lead` never stamped `next_followup_date` and **inferred** the flow "never runs" — but they explicitly noted they **could not see any logs** (the CLI forces the kernel logger to `level:'silent'`), so "never runs" was a hypothesis, not a verified fact.

What the incident actually was — established by reproducing it end-to-end against hotcrm's own 7.4.1 packages and artifact:

- **The trigger fires.** With logging restored, the record-change trigger registers and binds all four `record_change` flows, and a write to `crm_lead` calls `automation.execute('lead_assignment')` → `success:true`. The reporter's own evidence corroborates this: object-level L2 hooks (`beforeInsert`) fire on the same REST writes, and the trigger's `afterInsert` hook rides the same `triggerHooks` pipeline. The flow **runs**.
- **But it produces zero effect**, because `lead_assignment`'s `decision`/edge conditions were authored as `'{record.rating} >= 4'`. The single brace makes this **invalid CEL** — CEL reads `{ … }` as a map literal, so it is a parse error (`Expected COLON, got RBRACE`; confirmed against `@objectstack/formula`). `evaluateCondition` returns **`false`** on a non-`ok`/throwing result (verified in 7.4.1 `service-automation/dist`, `evaluateCondition`: `if (!result.ok) return false; … catch { return false }`), so **neither branch is taken**, `update_record` never runs, and the SLA field is never stamped — exactly the reported symptom.

**Not the cause (a related but distinct bug):** the throwing-`__require` stub bug — where an ESM CommonJS `require('@objectstack/formula')` compiled to tsup's throwing stub and made *every* CEL eval throw → `catch → false` → all conditions skip — was a **different** issue (**#1429**, fixed by `a6d4cbb6f`, a static top-level import) and is **already shipped in 7.4.1**. hotcrm's 7.4.1 `service-automation` uses the static `import { ExpressionEngine } from "@objectstack/formula"`, and direct CEL evaluation works there. So #1491 on 7.4.1 is the **brace-in-CEL** failure above, not the stub.

**The shared villain** behind both #1429 and #1491 is the same and is the deeper point: a CEL parse/eval failure is **silently swallowed to `false`**. A malformed predicate and an unreachable engine are indistinguishable from "condition not met," and both surface as "flow silently does nothing." This is what Decision 4 attacks.

Supporting facts (verified in source):

- **Loose contract + coercion.** `ExpressionInputSchema` (`spec/shared/expression.zod.ts:84`) transforms any bare string into `{dialect:'cel', source}`; `flow.zod.ts` only *consumes* it. So a `condition: string` is silently treated as CEL with no opportunity to reject a bad form.
- **The spec teaches the bad form.** `automation/flow.zod.ts:212-214`'s own `FlowSchema` JSDoc example uses `condition: "{amount} < 500"` / `"{amount} >= 500"` — the **exact single-brace-in-CEL pattern that silently fails**. An AI (or human) reading the canonical spec docs learns the antipattern from the platform itself. This is the concrete answer to *"why did the AI write it wrong"*: not a missing skill — an actively wrong authoritative example.
- **Three syntaxes coexist.** `service-automation/builtin/template.ts` interpolates **single** `{…}` (`{var}`, `{record.x}`, `{$User.Id}`, `{NOW()}`, `{TODAY()+N}`) for flow node string fields; `Object.titleFormat` / notification templates use **double** `{{…}}` mustache; predicates are bare CEL. CEL date helpers are **lowercase** `today()` / `daysFromNow(int)`; the template engine uses **uppercase** `TODAY()` / `NOW()`. Same intent, three spellings — and the single-brace template delimiter is the one that collides with CEL.
- **Inconsistent failure policy.** The same evaluation-failure decision is made five different ways across the codebase: `seed-loader` (loud fail), hook-wrappers (warn + false), rule-validator (warn + skip → null), the engine's formula projection (silent null), and flow `evaluateCondition` (silent false). There is no single declared policy.

## The reframing — the problem is the contract, not "CEL vs template"

It is tempting to "just document the difference" or "add a lint." That treats the symptom. The actual defects are:

1. **The contract is too loose.** `condition?: string` lets you serialize a syntactically illegal predicate. The type system *permits the bug*.
2. **Failure is silent and at the wrong time.** Errors vanish at runtime instead of surfacing at authoring/build time — the cardinal sin for a low-code platform.
3. **Three syntaxes** for "reference a field," one of which (`{…}`) is *actively hostile* because it collides with the expression language.
4. **The author is increasingly an LLM.** The serialized format is now an LLM-facing API. It must be **LLM-safe**: one obvious way, types that reject the wrong way, precise errors that enable self-correction.

A low-code expression layer earns its keep by making **illegal states unrepresentable** and **catching errors where they are authored**. Today it does neither.

## Decision

### 1. One expression language: CEL. Templates are not a second language.

There is exactly one expression language — **CEL**. A "template" is **not** a separate language; it is a **string literal with `{{ CEL }}` interpolation holes**, where each hole contains an ordinary CEL expression.

```ts
condition: cel`record.rating >= 4`                       // Predicate — bare CEL → bool
title:     tpl`Hot lead: {{ record.full_name }}`          // Template — string + CEL holes
dueDate:   cel`daysFromNow(3)`                            // Computed value
filter:    { end_date: { $lte: cel`daysFromNow(int(currentContract.renewal_notice_days))` } }
```

Consequences: "reference this field" is always `record.x` / `previous.x` / `<var>.x`. The `TODAY()` vs `today()` split disappears — it is always CEL's `today()`. There is one parser, one stdlib, one type system, one doc.

### 2. One interpolation delimiter: `{{ }}`. Single `{ }` is removed.

All template interpolation uses **`{{ … }}`**. Single-brace `{…}` is **deleted** from the template engine. Rationale: `{…}` collides with CEL map-literal syntax (the physical cause of #1491); `{{…}}` does not. A template accidentally pasted into a predicate (`cel\`{{record.x}} ...\``) still fails to parse — and is then caught loudly by Decision 4, not silently swallowed. Three syntaxes collapse to **one language + one delimiter**.

### 3. Expression fields are typed envelopes, never raw `string`.

Every expression-bearing field is a **typed Expression envelope**, constructed only via the SDK tagged templates (or the GUI, see Decision 6) — never a bare `string`:

- Predicate field → `Predicate` (CEL constrained to return `bool`).
- Template/text field → `Template` (string-with-`{{CEL}}`-holes).
- Computed value field → `Expr<T>` (or `T | Expr<T>` where a literal is also valid).

The canonical serialized form remains the existing envelope `{ dialect, source, ast? }`. The change is that the spec **stops accepting bare strings** for these fields: `condition: string` becomes `condition: Predicate`. The #1491 line `condition: '{record.rating} >= 4'` then **fails type-checking** — correctness comes from the type, not from a reader noticing a doc.

### 4. Zero silent failure — two halves, both required.

The two failure modes from Context need two distinct guards:

- **4a. Build-time validation (catches malformed expressions).** `objectstack build` (and `registerFlow` / metadata registration) **parses every expression**, failing with a precise source location on any parse error. This catches the **#1491 class**: `condition: '{record.rating} >= 4'` is invalid CEL, so it fails the build at the offending line instead of silently evaluating to `false` at runtime.
- **4b. No silent runtime fallback (catches runtime faults).** The runtime **"eval error / non-`ok` → return `false`"** branch in `evaluateCondition` (and the four other ad-hoc handlers noted in Context) is **removed**. A runtime evaluation fault — e.g. an unreachable engine like the #1429 stub, which produces *syntactically valid* expressions that throw at eval time and would slip past 4a — must surface as a loud, attributed error, never a swallowed `false`.

One declared `EvalResult` policy replaces today's five (loud-fail / warn+false / warn+skip / silent-null / silent-false). A malformed expression is a **build error**; a runtime fault is a **logged, attributed failure** — neither is ever a silent no-op.

### 5. Schema-aware validation — the greenfield payoff.

The CEL compiler is fed the **object schema as its type environment**, so build-time validation is not merely syntactic:

- `record.raitng` → *"crm_lead has no field `raitng` — did you mean `rating`?"*
- predicate not returning `bool`, or `amount` (number) compared to a string → **type error**.

This is the line between a serious low-code platform (Salesforce / Airtable formula editors type-check live) and a string-eval toy. It is **especially valuable for AI authors**: a precise, located error closes the self-correction loop. Retrofitting schema-aware checking after launch is prohibitively expensive; pre-launch is the only economical moment.

### 6. One canonical IR, three front-ends.

The GUI flow/condition builder, the `.ts` SDK tagged templates, and AI generation all emit the **same canonical Expression IR** and run through the **same validator**. One language, one IR — the GUI and pro-code surfaces cannot drift, and any author (human, dev, LLM) is held to the same contract.

## Representation / contract summary

| Field role | Author writes | Serialized envelope | Validated as |
|---|---|---|---|
| Predicate (`condition`, `guard`, validation, sharing) | `` cel`record.x > 1` `` | `{dialect:'cel', source, ast?}` | parses + returns `bool` + fields exist |
| Template (`notify.title/body`, `create_record.fields`, titleFormat, notification) | `` tpl`...{{ record.x }}...` `` | `{dialect:'template', source, ast?}` | every `{{…}}` hole parses as CEL + fields exist |
| Computed value (`dueDate`, filter values) | `` cel`daysFromNow(3)` `` | `{dialect:'cel', …}` | parses + result type compatible with field |

Reserved for future dialects (`sql`, `cron`) via the same envelope; CEL is the default and overwhelmingly dominant.

## Consequences

**Positive**
- The #1491 brace class becomes **unrepresentable** (type error) or **caught at build** (4a); the #1429 runtime-fault class becomes a **loud attributed error** (4b). Neither is ever a silent no-op again.
- One mental model for every author; the format is LLM-safe and LLM-self-correcting.
- Schema-aware errors raise authoring quality across *all* CEL surfaces (flows, validations, sharing, formula fields), not just flows.

**Costs / risks**
- Tagged-template envelopes are more verbose than raw strings. Mitigation: `` cel`` `` is terse; AI handles it trivially; the trade buys "wrong = compile error."
- **Schema-aware checking is real engineering**: the object schema must be projected into a CEL type environment fed to the compiler. Greenfield is when this is affordable.
- The `{{CEL}}` interpolator replaces the current regex mini-resolver in `template.ts` (modest).
- CEL surfaces are platform-wide; this contract change touches `spec`, `formula`, `service-automation`, CLI build, and the designer together — must be sequenced as one coherent change while pre-launch.

## Sequencing (roadmap)

1. **Contract** — `spec`: expression fields become typed envelopes (`Predicate` / `Template` / `Expr<T>`); remove bare-string acceptance and the string→CEL coercion (`shared/expression.zod.ts:84`). Land `` cel`` `` / `` tpl`` `` builders.
2. **Fix the docs that teach the bug** — replace the single-brace-in-CEL examples in the spec's own JSDoc (`automation/flow.zod.ts:212-214`, `condition: "{amount} < 500"`) and any skill/guide that shows the same, *before* shipping the contract — these are the source the next AI author copies.
3. **One `EvalResult` policy** — replace today's five ad-hoc handlers (seed loud-fail / hook warn+false / rule warn+skip / formula silent-null / flow silent-false) with one declared policy: parse failure → build error (4a); runtime fault → logged attributed failure (4b). Delete the `eval-error→false` fallback in `evaluateCondition`.
4. **Engine** — `formula`: `{{CEL}}` template interpolation; unify date helpers under CEL stdlib (`today()`/`daysFromNow`). `service-automation`: route templates through it.
5. **Build-time validation** — CLI/registration parses every expression; fail with location. (Catches the whole #1491 brace class immediately.)
6. **Schema-aware validation** — project object schema into the CEL type env; field-existence + return-type checks (see Open Question 1 for v1 depth).
7. **Designer** — GUI condition/template builders emit the canonical IR; one validator shared with build.

## Non-goals / deferred

- **Full single-language purity** (CEL-only, no template sugar): rejected — interpolation ergonomics matter; `{{CEL}}` holes keep one language *and* ergonomics.
- **Replacing CEL** with JS/Power Fx: rejected — CEL is sandboxed, statically checkable, non-Turing-complete, and AI-legible; the right base for "safe + checkable + LLM-friendly."
- **Runtime, non-CEL custom DSLs** in conditions: out of scope.

## Open questions (need a decision)

1. **Depth of schema-aware validation in v1.** Minimum viable is *field existence + predicate-returns-bool* (highest ROI). Full type inference (numeric/date/string compatibility, function-overload resolution against field types) could be v2. **Can the build pipeline obtain the complete, resolved object schema at compile time** to feed the type environment? That gates how much of Decision 5 lands in v1.
2. **Reference front-end.** This ADR treats the **IR/SDK as the reference implementation and the GUI as its visual producer** (matching today's AI+`.ts` authoring reality). If the intended end-state is "GUI-drag-first, `.ts` is export-only," validation and ergonomics weight shifts toward the designer, and the strictness of the `` cel`` `` tagged templates should be tuned accordingly.

## Already shipped / observed on this line of work

- **#1429** (`a6d4cbb6f`) fixed the throwing-`__require` stub by switching `service-automation` to a static `import { ExpressionEngine } from '@objectstack/formula'`, and populated `hookContext.previous` for update hooks. **Shipped in 7.4.1.** It removed the *engine-unreachable* runtime fault but left the underlying `catch → false` swallow in place — which is why **#1491** (a malformed predicate on the same swallow) still presents identically. This ADR's Decision 4 closes the swallow itself.
- `@objectstack/formula` envelope routing exists (`{dialect, source, ast}`), CEL stdlib (`now()`/`today()`/`daysFromNow(int)`/`isBlank`/`coalesce`), and the legacy single-brace template resolver (`service-automation/builtin/template.ts`). This ADR **converges** these onto one language + one delimiter and adds the typed contract + build-time/schema validation that the current seam lacks.
