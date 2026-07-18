# objectstack-ui — Schema References

> **Auto-generated** by `packages/spec/scripts/build-skill-references.ts`.
> Do not edit — re-run `pnpm --filter @objectstack/spec run gen:skill-refs` to update.

Schemas live in the published `@objectstack/spec` package. Read them directly
from `node_modules` — there is no local copy in the skill bundle.

## Core schemas

- `node_modules/@objectstack/spec/src/ui/action.zod.ts` — Action Parameter Schema
- `node_modules/@objectstack/spec/src/ui/app.zod.ts` — Base Navigation Item Schema
- `node_modules/@objectstack/spec/src/ui/chart.zod.ts` — Unified Chart Type Taxonomy
- `node_modules/@objectstack/spec/src/ui/component.zod.ts` — Empty Properties Schema
- `node_modules/@objectstack/spec/src/ui/dashboard.zod.ts` — Color variant for dashboard widgets (e.g., KPI cards).
- `node_modules/@objectstack/spec/src/ui/page.zod.ts` — Page Region Schema
- `node_modules/@objectstack/spec/src/ui/report.zod.ts` — Report Type Enum
- `node_modules/@objectstack/spec/src/ui/theme.zod.ts` — Color Palette Schema
- `node_modules/@objectstack/spec/src/ui/view.zod.ts` — HTTP Method Enum & HTTP Request Schema
- `node_modules/@objectstack/spec/src/ui/widget.zod.ts` — Widget Lifecycle Hooks Schema

## Transitive dependencies

- `node_modules/@objectstack/spec/src/data/feed.zod.ts` — Activity-timeline UI config enums.
- `node_modules/@objectstack/spec/src/data/field.zod.ts` — Field Type Enum
- `node_modules/@objectstack/spec/src/data/filter.zod.ts` — Unified Query DSL Specification
- `node_modules/@objectstack/spec/src/data/hook-body.zod.ts` — Capability tokens a script body may request.
- `node_modules/@objectstack/spec/src/kernel/metadata-protection.zod.ts` — Metadata Protection Model — Phase 1 (ADR-0010)
- `node_modules/@objectstack/spec/src/kernel/public-auth-features.ts` — Public auth feature-flag registry (#2874)
- `node_modules/@objectstack/spec/src/shared/enums.zod.ts` — Exports: AggregationFunctionEnum, SortDirectionEnum, SortItemSchema, MutationEventEnum, IsolationLevelEnum
- `node_modules/@objectstack/spec/src/shared/expression.zod.ts` — Expression Protocol
- `node_modules/@objectstack/spec/src/shared/http.zod.ts` — Shared HTTP Schemas
- `node_modules/@objectstack/spec/src/shared/identifiers.zod.ts` — System Identifier Schema
- `node_modules/@objectstack/spec/src/shared/lazy-schema.ts` — Wrap a Zod schema constructor so its body is only evaluated on first use.
- `node_modules/@objectstack/spec/src/shared/protection.zod.ts` — Package-level metadata protection (ADR-0010 §3.7 — Phase 4.3)
- `node_modules/@objectstack/spec/src/shared/visibility.ts` — Conditional-visibility predicate normalization (ADR-0089)
- `node_modules/@objectstack/spec/src/ui/i18n.zod.ts` — I18n Object Schema
- `node_modules/@objectstack/spec/src/ui/keyboard.zod.ts` — Focus Trap Configuration Schema
- `node_modules/@objectstack/spec/src/ui/responsive.zod.ts` — Breakpoint Name Enum
- `node_modules/@objectstack/spec/src/ui/sharing.zod.ts` — Sharing & Embedding Protocol
- `node_modules/@objectstack/spec/src/ui/touch.zod.ts` — Touch Target Configuration Schema

## How to read these

1. The schemas are runtime Zod definitions. Use `Read` on the absolute
   path under `node_modules/@objectstack/spec/src/` to inspect field shapes,
   `.describe()` text, enums, and refinements.
2. TypeScript types: `import type { … } from '@objectstack/spec'` (or the
   matching subpath export).
3. Runtime values: `import { … } from '@objectstack/spec'` — the package
   re-exports every schema and helper.
