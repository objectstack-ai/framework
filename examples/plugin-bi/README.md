# Plugin BI — Business Intelligence Dashboard

> **Level:** 🟢 Beginner  
> **Protocols:** Data, UI (Dashboards)  
> **Status:** Stub — Placeholder for BI plugin implementation

## Overview

This example demonstrates how to structure an ObjectStack **plugin** that provides analytics objects and dashboard widgets. It shows the plugin manifest pattern using `defineStack()` with `type: 'plugin'`.

## What You'll Learn

- Plugin manifest structure (`type: 'plugin'`, `namespace`, `id`)
- How plugins extend an application with additional objects
- Dashboard widget definitions for analytics

## Directory Structure

```
plugin-bi/
├── objectstack.config.ts  # Plugin manifest (defineStack)
├── package.json           # Package definition
├── tsconfig.json          # TypeScript config (inherits from root)
└── README.md              # This file
```

## Quick Start

```bash
# From monorepo root
corepack enable && pnpm install

# Type-check the plugin
cd examples/plugin-bi
pnpm typecheck
# Expected: No errors — plugin manifest validates against @objectstack/spec

# Build the plugin
pnpm --filter @example/plugin-bi build
# Expected: Build succeeds, generates dist/ output
```

## Plugin Manifest

The `objectstack.config.ts` file defines the plugin:

```typescript
import { defineStack } from '@objectstack/spec';

export default defineStack({
  manifest: {
    id: 'com.example.bi',
    namespace: 'bi',
    version: '1.0.0',
    type: 'plugin',
    name: 'BI Plugin',
    description: 'Business Intelligence dashboards and analytics',
  },
  objects: [],      // Add analytics objects here
  dashboards: [],   // Add dashboard widgets here
});
```

## Next Steps

To build a full BI plugin, add:

1. **Analytics objects** (e.g., `metric`, `kpi`, `data_source`) to the `objects` array
2. **Dashboard widgets** (charts, KPI cards, tables) to the `dashboards` array
3. **Reports** for tabular/summary/matrix analytics

See the [App CRM](../app-crm/) example for comprehensive dashboard and report patterns.

## Related Examples

- [App Todo](../app-todo/) — Dashboard widgets and reports (beginner)
- [App CRM](../app-crm/) — Enterprise dashboards with 10+ widgets (intermediate)
- [Server](../../apps/server/) — Plugin orchestration and loading (advanced)

---

**License:** Apache-2.0
