# objectstack-ai — Schema References

> **Auto-generated** by `packages/spec/scripts/build-skill-references.ts`.
> Do not edit — re-run `pnpm --filter @objectstack/spec run gen:skill-refs` to update.

Schemas live in the published `@objectstack/spec` package. Read them directly
from `node_modules` — there is no local copy in the skill bundle.

## Core schemas

- `node_modules/@objectstack/spec/src/ai/agent.zod.ts` — AI Model Configuration
- `node_modules/@objectstack/spec/src/ai/conversation.zod.ts` — AI Conversation Memory Protocol
- `node_modules/@objectstack/spec/src/ai/embedding.zod.ts` — Embedding & Vector Store Primitives
- `node_modules/@objectstack/spec/src/ai/mcp.zod.ts` — Model Context Protocol (MCP) — Reference & Binding Primitives
- `node_modules/@objectstack/spec/src/ai/model-registry.zod.ts` — AI Model Registry Protocol
- `node_modules/@objectstack/spec/src/ai/skill.zod.ts` — Skill Trigger Condition Schema
- `node_modules/@objectstack/spec/src/ai/tool.zod.ts` — Tool Category
- `node_modules/@objectstack/spec/src/ai/usage.zod.ts` — AI Usage Primitives

## Transitive dependencies

- `node_modules/@objectstack/spec/src/automation/state-machine.zod.ts` — XState-inspired State Machine Protocol
- `node_modules/@objectstack/spec/src/kernel/metadata-protection.zod.ts` — Metadata Protection Model — Phase 1 (ADR-0010)
- `node_modules/@objectstack/spec/src/shared/expression.zod.ts` — Expression Protocol
- `node_modules/@objectstack/spec/src/shared/identifiers.zod.ts` — System Identifier Schema
- `node_modules/@objectstack/spec/src/shared/lazy-schema.ts` — Wrap a Zod schema constructor so its body is only evaluated on first use.
- `node_modules/@objectstack/spec/src/shared/protection.zod.ts` — Package-level metadata protection (ADR-0010 §3.7 — Phase 4.3)

## How to read these

1. The schemas are runtime Zod definitions. Use `Read` on the absolute
   path under `node_modules/@objectstack/spec/src/` to inspect field shapes,
   `.describe()` text, enums, and refinements.
2. TypeScript types: `import type { … } from '@objectstack/spec'` (or the
   matching subpath export).
3. Runtime values: `import { … } from '@objectstack/spec'` — the package
   re-exports every schema and helper.
