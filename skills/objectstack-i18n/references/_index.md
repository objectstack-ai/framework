# objectstack-i18n — Zod Schema Reference

> **Auto-generated** by `build-skill-references.ts`.
> These files are copied from `packages/spec/src/` for AI agent consumption.
> Do not edit — re-run `pnpm --filter @objectstack/spec run gen:skill-refs` to update.

## Core Schemas

- [`system/translation.zod.ts`](./system/translation.zod.ts) — Translation schemas: AppTranslationBundle, ObjectTranslationNode, TranslationConfig, TranslationCoverageResult, TranslationDiffItem
- [`contracts/i18n-service.ts`](./contracts/i18n-service.ts) — II18nService interface contract
- [`ui/i18n.zod.ts`](./ui/i18n.zod.ts) — UI-level i18n object schema

## Dependencies (auto-resolved)

These schemas are included in the references for completeness but are primarily managed by other skills:

- **objectstack-schema** — Object, Field schemas (source for translation extraction)
- **objectstack-ui** — View, App, Dashboard schemas (UI translation sources)
- **objectstack-automation** — Flow, Workflow schemas (automation message translations)
