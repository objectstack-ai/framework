# objectstack-api — Schema References

> **Auto-generated** by `packages/spec/scripts/build-skill-references.ts`.
> Do not edit — re-run `pnpm --filter @objectstack/spec run gen:skill-refs` to update.

Schemas live in the published `@objectstack/spec` package. Read them directly
from `node_modules` — there is no local copy in the skill bundle.

## Core schemas

- `node_modules/@objectstack/spec/src/api/auth.zod.ts` — Authentication Service Protocol
- `node_modules/@objectstack/spec/src/api/batch.zod.ts` — Batch Operations API
- `node_modules/@objectstack/spec/src/api/endpoint.zod.ts` — API Mapping Schema
- `node_modules/@objectstack/spec/src/api/errors.zod.ts` — Standardized Error Codes Protocol
- `node_modules/@objectstack/spec/src/api/graphql.zod.ts` — GraphQL Protocol Support
- `node_modules/@objectstack/spec/src/api/realtime.zod.ts` — Transport Protocol Enum
- `node_modules/@objectstack/spec/src/api/rest-server.zod.ts` — REST API Server Protocol
- `node_modules/@objectstack/spec/src/api/versioning.zod.ts` — API Versioning Protocol
- `node_modules/@objectstack/spec/src/api/websocket.zod.ts` — WebSocket Event Protocol

## Transitive dependencies

- `node_modules/@objectstack/spec/src/api/contract.zod.ts` — Standard Create Request
- `node_modules/@objectstack/spec/src/api/realtime-shared.zod.ts` — Realtime Shared Protocol
- `node_modules/@objectstack/spec/src/data/field.zod.ts` — Field Type Enum
- `node_modules/@objectstack/spec/src/data/filter.zod.ts` — Unified Query DSL Specification
- `node_modules/@objectstack/spec/src/data/query.zod.ts` — Sort Node
- `node_modules/@objectstack/spec/src/shared/expression.zod.ts` — Expression Protocol
- `node_modules/@objectstack/spec/src/shared/http.zod.ts` — Shared HTTP Schemas
- `node_modules/@objectstack/spec/src/shared/identifiers.zod.ts` — System Identifier Schema
- `node_modules/@objectstack/spec/src/shared/lazy-schema.ts` — Wrap a Zod schema constructor so its body is only evaluated on first use.
- `node_modules/@objectstack/spec/src/system/encryption.zod.ts` — Field-level encryption protocol
- `node_modules/@objectstack/spec/src/system/masking.zod.ts` — Data masking protocol for PII protection

## How to read these

1. The schemas are runtime Zod definitions. Use `Read` on the absolute
   path under `node_modules/@objectstack/spec/src/` to inspect field shapes,
   `.describe()` text, enums, and refinements.
2. TypeScript types: `import type { … } from '@objectstack/spec'` (or the
   matching subpath export).
3. Runtime values: `import { … } from '@objectstack/spec'` — the package
   re-exports every schema and helper.
