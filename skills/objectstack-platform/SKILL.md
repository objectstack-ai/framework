---
name: objectstack-platform
description: >
  Bootstrap, configure, and extend ObjectStack runtimes. Covers both
  end-user project setup (defineStack, drivers, adapters, CLI scaffolding)
  and platform extension (plugins, kernel services, hook/event system,
  bootstrap lifecycle). Use when creating a new project, writing
  objectstack.config.ts, picking drivers/adapters, scaffolding apps,
  developing plugins, registering services in DI, wiring kernel hooks
  (kernel:ready, data:*), or debugging plugin loading.
  ALWAYS use this skill when you see: "create a project", "new app", "init",
  "get started", "scaffold", "bootstrap", "project setup", "objectstack.config",
  "defineStack", "driver selection", "adapter", "project structure",
  "create a plugin", "register a service", "kernel config", "plugin lifecycle",
  "ObjectKernel", "LiteKernel", "DI", "dependency injection",
  "service registry", "health check", "graceful shutdown", "extend the platform",
  "write an extension", "kernel:ready", "ctx.hook", "plugin event".
  Do NOT use for data schema design (use objectstack-data) or query patterns
  (use objectstack-query). For data lifecycle hooks (beforeInsert/afterUpdate),
  use objectstack-data — plugin hooks here are kernel/service-level events.
license: Apache-2.0
compatibility: Requires @objectstack/spec v4+, @objectstack/core v4+, Node 18+, pnpm 8+
metadata:
  author: objectstack-ai
  version: "1.0"
  domain: platform
  tags: project, scaffold, init, defineStack, driver, adapter, bootstrap, config, plugin, kernel, service, hook, event, DI, lifecycle, extension
---

# Platform — ObjectStack Bootstrap & Plugin System

Expert instructions for two related concerns:

1. **Project setup** — scaffolding new projects, writing
   `objectstack.config.ts`, picking drivers and adapters, the runtime boot
   sequence (the original "quickstart" skill).
2. **Plugin development** — building plugins, registering services,
   wiring kernel hook / event handlers, working with `ObjectKernel` vs
   `LiteKernel` (the original "plugin" skill).

Both areas share the same `defineStack()` / kernel surface, which is why
they live in one skill.

---

## When to Use This Skill

- Creating a **new ObjectStack project** from scratch.
- Choosing the right **project template** (minimal-api, full-stack, plugin).
- Writing or modifying **`objectstack.config.ts`** (`defineStack()` config).
- Selecting a **database driver** (Memory, SQL, Turso).
- Integrating with a **web framework** (Hono, Express, Fastify, Next.js, etc.).
- Understanding the **runtime boot sequence** and plugin loading order.
- Setting up **multi-app composition** with `composeStacks()`.
- Answering **"how do I get started?"** questions.

---

## Decision Tree: Choosing a Template

```
What are you building?
│
├── A simple REST API or backend service?
│   └── ✅ minimal-api
│       • 1 object, REST endpoints, in-memory driver
│       • Fastest path to a running API
│
├── A full business application with UI?
│   └── ✅ full-stack
│       • Multiple objects, views, apps, auth
│       • Studio UI included
│       • CRM-like starter with relationships
│
└── A reusable extension for other projects?
    └── ✅ plugin
        • Plugin scaffold with onInstall/onEnable/onDisable
        • Exports objects that other apps can import
        • Designed for the marketplace
```

### Scaffolding Command

```bash
# Interactive — prompts for name, template, package manager
npx create-objectstack

# Direct — skip prompts
npx create-objectstack my-app --template full-stack
```

Templates: `minimal-api` | `full-stack` | `plugin`

---

## Project Structure Conventions

Every ObjectStack project follows this directory structure:

```
my-app/
├── objectstack.config.ts    # ← THE entry point — defineStack()
├── package.json
├── tsconfig.json
└── src/
    ├── objects/              # Business object definitions
    │   ├── task.object.ts    # → exports a single object
    │   └── index.ts          # → barrel: export * from './task.object'
    ├── views/                # Optional: UI view definitions
    │   ├── task.view.ts
    │   └── index.ts
    ├── apps/                 # Optional: app definitions (nav, pages)
    │   ├── main.app.ts
    │   └── index.ts
    ├── flows/                # Optional: automation flows
    │   ├── task.flow.ts
    │   └── index.ts
    ├── actions/              # Optional: action definitions
    │   ├── task.action.ts
    │   └── index.ts
    ├── dashboards/           # Optional: dashboards
    ├── reports/              # Optional: reports
    ├── i18n/                 # Optional: translation bundles
    └── handlers/             # Optional: runtime hook handlers
```

### Naming Conventions

| Concept | Convention | Example |
|:--------|:-----------|:--------|
| File names | `{name}.{type}.ts` | `task.object.ts`, `main.app.ts` |
| Machine names | `snake_case` | `project_task`, `first_name` |
| Config keys | `camelCase` | `maxLength`, `defaultValue` |
| Barrel exports | `Object.values(imported)` | `objects: Object.values(objects)` |

---

## CRM Blueprint (Reference Implementation)

When scaffolding a production-style metadata app, align with this
CRM-style layout:

| Blueprint Area | CRM Reference | What to Reuse |
|:--|:--|:--|
| Stack assembly | `objectstack.config.ts` | Single `defineStack()` root aggregating all metadata collections |
| By-type directories | `src/{objects,views,pages,actions,flows,...}` | Domain-per-folder layout with barrel exports |
| Typed aggregates | `src/*/index.ts` | Export `allFlows` / `allAgents` / `allSkills` typed arrays |
| Runtime capabilities | `requires: ['ai','automation','analytics','auth','ui','approvals','sharing']` | Declare opt-in capabilities explicitly |
| Security assembly | `src/profiles/*` + `src/sharing/*` | Compose `permissions`, `sharingRules`, and `roles` in stack root |
| Localization assembly | `src/translations/*` + `i18n` | Keep per-locale files and central bundle registration |

Use this as the default template for “metadata application” requests before
simplifying to minimal-api.

---

## `defineStack()` — The Core Configuration

`objectstack.config.ts` is the single entry point for every project.
It calls `defineStack()` to declare all metadata.

### Minimal Example

```typescript
import { defineStack, Data } from '@objectstack/spec';
const { Field } = Data;

export default defineStack({
  manifest: {
    id: 'com.example.todo',
    version: '1.0.0',
    type: 'app',
    name: 'Todo Manager',
  },
  objects: [
    {
      name: 'task',
      label: 'Task',
      fields: {
        title:    Field.text({ required: true }),
        status:   Field.select({ options: [
          { label: 'Open', value: 'open' },
          { label: 'Done', value: 'done' },
        ], defaultValue: 'open' }),
        due_date: Field.date(),
      },
    },
  ],
});
```

### Full Configuration Reference

`defineStack()` accepts an `ObjectStackDefinitionInput` with these top-level keys:

| Key | Type | Description |
|:----|:-----|:------------|
| `manifest` | `Manifest` | Package identity (id, namespace, version, type, name) |
| `objects` | `Object[]` or Map | Business object definitions |
| `objectExtensions` | `ObjectExtension[]` | Fields to merge into objects from other packages |
| `apps` | `App[]` or Map | Application definitions with navigation |
| `views` | `View[]` or Map | List/form view definitions |
| `pages` | `Page[]` or Map | Custom page definitions |
| `dashboards` | `Dashboard[]` or Map | Dashboard definitions |
| `reports` | `Report[]` or Map | Analytics reports |
| `actions` | `Action[]` or Map | Global and object-scoped actions |
| `themes` | `Theme[]` | UI themes |
| `workflows` | `WorkflowRule[]` | Event-driven workflow rules |
| `approvals` | `ApprovalProcess[]` | Approval process definitions |
| `flows` | `Flow[]` or Map | Screen and autolaunched flows |
| `roles` | `Role[]` | User role hierarchy |
| `permissions` | `PermissionSet[]` | Permission sets / profiles |
| `sharingRules` | `SharingRule[]` | Record sharing rules |
| `policies` | `Policy[]` | Security / compliance policies |
| `apis` | `ApiEndpoint[]` | Custom API endpoints |
| `webhooks` | `Webhook[]` | Outbound webhooks |
| `agents` | `Agent[]` or Map | AI agents and assistants |
| `ragPipelines` | `RAGPipeline[]` | RAG pipeline configurations |
| `hooks` | `Hook[]` | Object lifecycle hooks |
| `mappings` | `Mapping[]` | Data import/export mappings |
| `analyticsCubes` | `Cube[]` | Analytics semantic layer cubes |
| `connectors` | `Connector[]` | External system connectors |
| `data` | `Dataset[]` | Seed data / fixtures |
| `datasources` | `Datasource[]` | External data connections |
| `translations` | `TranslationBundle[]` | I18n translation bundles |
| `i18n` | `TranslationConfig` | Internationalization settings |
| `plugins` | `Plugin[]` | Runtime plugins to load |
| `devPlugins` | `Plugin[]` | Dev-only plugins (equivalent to devDependencies) |

### Map Format (Key → Name)

All named collections support **map format** where the key becomes the `name` field:

```typescript
export default defineStack({
  // Array format (traditional)
  objects: [
    { name: 'task', fields: { title: Field.text() } },
  ],

  // Map format (key becomes name) — preferred for readability
  objects: {
    task: { fields: { title: Field.text() } },
    project: { fields: { name: Field.text() } },
  },
});
```

### Barrel Import Pattern

Use barrel exports to keep config clean:

```typescript
// src/objects/index.ts
export { default as task } from './task.object';
export { default as project } from './project.object';

// objectstack.config.ts
import * as objects from './src/objects';
import * as apps from './src/apps';
import * as views from './src/views';
import * as flows from './src/flows';

export default defineStack({
  manifest: { id: 'com.example.pm', namespace: 'pm', version: '1.0.0', type: 'app', name: 'PM' },
  objects: Object.values(objects),
  apps: Object.values(apps),
  views: Object.values(views),
  flows: Object.values(flows),
});
```

### Strict Validation

`defineStack()` validates by default (`strict: true`):

1. **Zod schemas** — field names, types, enums
2. **Cross-references** — views/actions/workflows reference defined objects
3. **Seed data** — dataset objects exist in the definition

To disable (advanced — e.g., objects provided by another plugin):

```typescript
export default defineStack({ ... }, { strict: false });
```

### Compile Artifact and Runtime Metadata Boundary

ObjectOS runtime metadata must come from source files during local development or
from a compiled artifact. Do not configure a project runtime to read or write
metadata through its business database.

```bash
objectstack compile
# -> dist/objectstack.json

OS_ARTIFACT_PATH=./dist/objectstack.json objectstack dev
```

Runtime rule of thumb:

| Context | Metadata source | Database role |
|:--------|:----------------|:--------------|
| Local dev | TS files or `dist/objectstack.json` | Business rows only |
| Production ObjectOS | Artifact API response | Business rows only |
| Control plane | Published JSON in metadata storage | Project revisions, history, overlays |

When generating `objectstack.config.ts`, keep object names short and
`snake_case`; never set `tableName`, and do not add `sys_metadata` objects to a
project runtime manifest.

---

## Manifest Reference

Every stack needs a `manifest` to identify itself in the ecosystem:

```typescript
manifest: {
  id: 'com.example.crm',        // Reverse domain unique ID
  version: '1.0.0',             // Semver
  type: 'app',                  // app | plugin | driver | module | ...
  name: 'Acme CRM',             // Human-readable display name
  description: 'CRM system',    // Optional description
}
```

**Object naming:** The object `name` is the canonical identifier and equals the physical table name. If you want a domain prefix, embed it directly in the name (e.g. `name: 'crm_account'`). There is no automatic namespace prefixing.

---

## Driver Selection Guide

Drivers are the storage layer. Pick based on your environment:

| Driver | Package | Best For | Notes |
|:-------|:--------|:---------|:------|
| **Memory** | `@objectstack/driver-memory` | Dev, testing, prototyping | Data lost on restart (unless persistence adapter used) |
| **SQL** | `@objectstack/driver-sql` | Production (PostgreSQL, MySQL, SQLite) | Uses Knex.js under the hood |
| **Turso** | `@objectstack/driver-turso` | Edge, serverless, multi-tenant | LibSQL/Turso cloud, per-tenant databases |

### Usage Pattern

```typescript
import { DriverPlugin } from '@objectstack/runtime';

// Development (in-memory, zero config)
import { InMemoryDriver } from '@objectstack/driver-memory';
new DriverPlugin(new InMemoryDriver())

// Production (SQLite)
import { SqlDriver } from '@objectstack/driver-sql';
new DriverPlugin(new SqlDriver({
  client: 'better-sqlite3',
  connection: { filename: './data/app.db' },
  useNullAsDefault: true,
}))

// Production (PostgreSQL)
new DriverPlugin(new SqlDriver({
  client: 'pg',
  connection: process.env.DATABASE_URL,
}))

// Edge / Serverless (Turso)
import { TursoDriver } from '@objectstack/driver-turso';
new DriverPlugin(new TursoDriver({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
}))
```

---

## Adapter Selection Guide

Adapters bridge ObjectStack to web frameworks. All expose the same REST API.

| Adapter | Package | Use When |
|:--------|:--------|:---------|
| **Hono** | `@objectstack/adapter-hono` | Default choice. Lightweight, edge-ready, web-standard. |
| **Express** | `@objectstack/adapter-express` | Existing Express codebase. |
| **Fastify** | `@objectstack/adapter-fastify` | Need Fastify's schema validation / plugin ecosystem. |
| **Next.js** | `@objectstack/adapter-nextjs` | Full-stack React with App Router. |
| **Nuxt** | `@objectstack/adapter-nuxt` | Vue.js / Nuxt projects. |
| **NestJS** | `@objectstack/adapter-nestjs` | Enterprise Angular-style architecture. |
| **SvelteKit** | `@objectstack/adapter-sveltekit` | Svelte projects. |

### Usage Pattern (Hono)

```typescript
import { createHonoApp } from '@objectstack/adapter-hono';

const app = createHonoApp({
  kernel,                    // ObjectKernel instance
  prefix: '/api',            // API route prefix (default: '/api')
});

export default app;          // Deploy to Cloudflare Workers, Deno, Bun, Node
```

### Usage Pattern (Next.js App Router)

```typescript
// app/api/[...objectstack]/route.ts
import { createRouteHandler } from '@objectstack/adapter-nextjs';
import { kernel } from '@/lib/objectstack';

const handler = createRouteHandler({ kernel });

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const DELETE = handler;
```

### Pattern Across All Adapters

Every adapter follows the same architecture:

1. Accept a `kernel` (ObjectKernel) instance
2. Create an `HttpDispatcher` internally
3. Mount explicit routes for auth, GraphQL, storage, discovery
4. Delegate everything else to `dispatcher.dispatch()`

This means **new routes added to HttpDispatcher work automatically in all
adapters** without code changes.

---

## Runtime Boot Sequence

Understanding how ObjectStack starts helps debug and customize:

```
objectstack.config.ts
  └── defineStack({ manifest, objects, views, ... })
        │
        ▼
CLI: `os serve` / `os dev`
  1. Load .env files (NODE_ENV-based)
  2. Dynamic import of config file
  3. Create Runtime + ObjectKernel
  4. Auto-detect and register plugins:
     ├── ObjectQLPlugin (if objects defined)
     ├── DriverPlugin (memory in dev, SQL in prod)
     ├── AppPlugin (loads the defineStack bundle)
     ├── I18nServicePlugin (if translations/i18n defined)
     ├── AuthPlugin
     ├── HonoServerPlugin
     ├── SetupPlugin (first-run wizard)
     ├── RESTPlugin (auto-generated API)
     ├── DispatcherPlugin
     ├── AIServicePlugin (if available)
     └── StudioPlugin (if --ui flag)
  5. Runtime.start() → init + start all plugins
  6. Server listens on configured port
```

### Plugin Loading Order Matters

Plugins initialize in registration order. Key dependencies:

| Plugin | Depends On | Reason |
|:-------|:-----------|:-------|
| ObjectQLPlugin | (none) | Core data engine, should load first |
| DriverPlugin | (none) | Registers driver service |
| AppPlugin | ObjectQLPlugin | Registers objects/metadata with engine |
| AuthPlugin | ObjectQLPlugin | Needs user/session objects |
| RESTPlugin | ObjectQLPlugin, AppPlugin | Generates routes from registered objects |
| AIServicePlugin | ObjectQLPlugin, AppPlugin | Needs metadata for tool generation |

### Programmatic Bootstrap (Without CLI)

```typescript
import { Runtime, DriverPlugin, AppPlugin } from '@objectstack/runtime';
import { ObjectQLPlugin } from '@objectstack/objectql';
import { InMemoryDriver } from '@objectstack/driver-memory';
import appConfig from './objectstack.config';

const runtime = new Runtime();
runtime.use(new ObjectQLPlugin());
runtime.use(new DriverPlugin(new InMemoryDriver()));
runtime.use(new AppPlugin(appConfig));
await runtime.start();

const kernel = runtime.getKernel();
// kernel is now ready — use it with an adapter
```

---

## Multi-App Composition

Use `composeStacks()` to merge multiple apps into one runtime:

```typescript
import { composeStacks, defineStack } from '@objectstack/spec';
import CrmApp from './apps/crm/objectstack.config';
import TodoApp from './apps/todo/objectstack.config';

const combined = composeStacks([CrmApp, TodoApp], {
  objectConflict: 'error',   // Throw on duplicate object names
  manifest: 'last',          // Use last stack's manifest
});

export default combined;
```

### Conflict Strategies

| Strategy | Behavior |
|:---------|:---------|
| `'error'` (default) | Throw if two stacks define the same object name |
| `'override'` | Last stack wins — later definition replaces earlier |
| `'merge'` | Shallow-merge objects with same name (later fields win) |

### Host Pattern (Plugins as AppPlugin)

For a hosting environment where each app runs isolated:

```typescript
import { Runtime, DriverPlugin, AppPlugin } from '@objectstack/runtime';
import { ObjectQLPlugin } from '@objectstack/objectql';
import { AuthPlugin } from '@objectstack/plugin-auth';

export default defineStack({
  manifest: { id: 'platform-host', type: 'app', version: '1.0.0', name: 'Platform' },
  plugins: [
    new ObjectQLPlugin(),
    new DriverPlugin(new SqlDriver({ ... })),
    new AuthPlugin({ secret: process.env.AUTH_SECRET }),
    new AppPlugin(CrmApp),     // contributes objects: crm_account, crm_lead, ...
    new AppPlugin(TodoApp),    // contributes objects: task, ...
  ],
});
```

Each app registers its objects by their canonical `name`. Object names are globally unique and equal the physical table name — use them directly in queries, hooks, formulas, and REST URLs.

---

## Seed Data

Declarative data loading for bootstrapping, demos, and testing:

```typescript
export default defineStack({
  // ... objects, apps, etc.
  data: [
    {
      object: 'task',
      mode: 'upsert',              // 'upsert' | 'insert' | 'ignore' | 'replace'
      externalId: 'subject',       // Idempotency key for upsert matching
      records: [
        { subject: 'Learn ObjectStack', status: 'open', priority: 'high' },
        { subject: 'Build first app', status: 'open', priority: 'medium' },
      ],
    },
  ],
});
```

| Mode | Behavior |
|:-----|:---------|
| `upsert` (default) | Insert or update based on `externalId` match |
| `insert` | Always insert (fails on duplicate) |
| `ignore` | Insert if not exists, skip otherwise |
| `replace` | Drop and re-insert all records |

---

## CLI Commands

| Command | Alias | Description |
|:--------|:------|:------------|
| `os init` | | Initialize a new project in current directory |
| `os dev` | | Start dev server with hot reload |
| `os serve` | | Start production server |
| `os studio` | | Open Studio UI in browser |
| `os compile` | | Compile metadata for production |
| `os validate` | | Validate all metadata schemas and cross-references |
| `os info` | | Display project metadata summary |
| `os generate` | `os g` | Scaffold new objects, views, flows, etc. |
| `os test` | | Run project tests (vitest) |
| `os doctor` | | Diagnose common project issues |
| `os plugin list` | | List installed plugins |
| `os plugin add` | | Install a plugin from registry |
| `os plugin remove` | | Uninstall a plugin |

### Typical Development Workflow

```bash
# 1. Create project
npx create-objectstack my-app --template full-stack
cd my-app

# 2. Install dependencies
pnpm install

# 3. Start development with Studio UI
os dev --ui

# 4. Validate metadata
os validate

# 5. Compile for production
os compile

# 6. Serve in production
os serve --port 3000
```

---

## Complete Working Example

A minimal but complete project from scratch:

**`package.json`**:
```json
{
  "name": "my-todo-app",
  "type": "module",
  "dependencies": {
    "@objectstack/spec": "^4.0.0",
    "@objectstack/runtime": "^4.0.0",
    "@objectstack/objectql": "^4.0.0",
    "@objectstack/driver-memory": "^4.0.0",
    "@objectstack/adapter-hono": "^4.0.0",
    "@objectstack/cli": "^4.0.0"
  }
}
```

**`src/objects/task.object.ts`**:
```typescript
import { Data } from '@objectstack/spec';
const { Field } = Data;

export default {
  name: 'task',
  label: 'Task',
  fields: {
    title:       Field.text({ label: 'Title', required: true }),
    description: Field.textarea({ label: 'Description' }),
    status:      Field.select({
      label: 'Status',
      options: [
        { label: 'Open', value: 'open' },
        { label: 'In Progress', value: 'in_progress' },
        { label: 'Done', value: 'done' },
      ],
      defaultValue: 'open',
    }),
    priority: Field.select({
      label: 'Priority',
      options: [
        { label: 'Low', value: 'low' },
        { label: 'Medium', value: 'medium' },
        { label: 'High', value: 'high' },
      ],
      defaultValue: 'medium',
    }),
    due_date: Field.date({ label: 'Due Date' }),
  },
  indexes: [
    { fields: ['status'] },
    { fields: ['due_date'] },
  ],
};
```

**`src/objects/index.ts`**:
```typescript
export { default as task } from './task.object';
```

**`objectstack.config.ts`**:
```typescript
import { defineStack } from '@objectstack/spec';
import * as objects from './src/objects';

export default defineStack({
  manifest: {
    id: 'com.example.todo',
    version: '1.0.0',
    type: 'app',
    name: 'Todo Manager',
  },
  objects: Object.values(objects),
});
```

```bash
# Run it
os dev --ui
# → Server at http://localhost:5174
# → REST API at http://localhost:5174/api
# → Studio UI at http://localhost:5174/studio
```

---
---

# Part 2 — Plugin Development & Kernel Extension


## When to Use This Skill

- You are creating a **new plugin** (driver, server, service, app feature)
- You need to **register or consume services** via the DI container
- You are using the **hook/event system** for inter-plugin communication
- You need to choose between **ObjectKernel** and **LiteKernel**
- You are debugging **plugin loading order** or dependency resolution
- You need to configure **graceful shutdown**, timeouts, or health checks
- You are implementing **service factories** with lifecycle management

---

## Quick Reference — Detailed Rules

For comprehensive documentation with incorrect/correct examples:

- **[Plugin Lifecycle](./rules/plugin-lifecycle.md)** — 3-phase lifecycle (init/start/destroy), execution order, complete examples
- **[Service Registry](./rules/service-registry.md)** — DI container, factories, lifecycles (singleton/transient/scoped), core fallbacks
- **[Hooks & Events](./rules/plugin-hooks-events.md)** — Plugin hooks reference (→ [objectstack-data](../objectstack-data/SKILL.md))

---

## ObjectKernel vs LiteKernel

| Feature | ObjectKernel | LiteKernel |
|:--------|:-------------|:-----------|
| **Use case** | Production servers, full applications | Serverless, edge, unit tests |
| **Package** | `@objectstack/core` | `@objectstack/core` |
| **Plugin loading** | Async with validation & metadata | Synchronous `use()` |
| **Service factories** | Singleton / Transient / Scoped | Direct instances only |
| **Health monitoring** | Built-in per-plugin health checks | Not available |
| **Graceful shutdown** | Timeout + rollback on failure | Basic destroy phase |
| **Dependency resolution** | Topological sort + circular detection | Topological sort |
| **Core fallbacks** | Auto-injects in-memory fallbacks | Not available |
| **Config validation** | Zod schema validation per plugin | Not available |

### Decision Guide

```
What environment are you targeting?
│
├── Production server / full application?
│   └── ✅ ObjectKernel
│       • Full DI with factories and scopes
│       • Health monitoring and auto-recovery
│       • Graceful shutdown with timeout
│       • Startup failure rollback
│
├── Serverless / edge (Cloudflare Workers, Deno Deploy)?
│   └── ✅ LiteKernel
│       • Minimal memory footprint
│       • Fast cold start
│       • No background health checks
│
└── Unit tests (vitest)?
    └── ✅ LiteKernel
        • Simple setup, fast teardown
        • No system requirement validation
        • No shutdown signal handlers
```

### ObjectKernel Configuration

```typescript
import { ObjectKernel } from '@objectstack/core';

const kernel = new ObjectKernel({
  logger: {
    level: 'info',           // 'debug' | 'info' | 'warn' | 'error' | 'fatal'
    format: 'json',          // 'json' | 'text' | 'pretty'
  },
  defaultStartupTimeout: 30000,   // Per plugin (ms)
  gracefulShutdown: true,         // Register SIGINT/SIGTERM handlers
  shutdownTimeout: 60000,         // Total shutdown timeout (ms)
  rollbackOnFailure: true,        // Rollback all plugins if one fails
  skipSystemValidation: false,    // Skip system checks (useful for tests)
});
```

### LiteKernel Configuration

```typescript
import { LiteKernel } from '@objectstack/core';

const kernel = new LiteKernel({
  logger: { level: 'warn' },
});
```

---

## Plugin Interface — Quick Overview

```typescript
import type { Plugin, PluginContext } from '@objectstack/core';

export interface Plugin {
  name: string;               // Unique identifier (reverse domain recommended)
  version?: string;           // Semantic version
  type?: string;              // 'standard' | 'ui' | 'driver' | 'server' | 'app'
  dependencies?: string[];    // Plugins that must init before this one

  // Phase 1: Register services
  init(ctx: PluginContext): Promise<void> | void;

  // Phase 2: Execute business logic (optional)
  start?(ctx: PluginContext): Promise<void> | void;

  // Phase 3: Cleanup (optional)
  destroy?(): Promise<void> | void;
}
```

See [rules/plugin-lifecycle.md](./rules/plugin-lifecycle.md) for complete examples.

---

## PluginContext API

### Service Registry

```typescript
// Register a service (in init phase)
ctx.registerService('my-service', myServiceInstance);

// Get a service (in start phase)
const db = ctx.getService<IDataEngine>('objectql');

// Replace a service
ctx.replaceService('cache', new InstrumentedCache(existingCache));

// Get all services
const allServices: Map<string, any> = ctx.getServices();
```

See [rules/service-registry.md](./rules/service-registry.md) for factories and lifecycles.

### Hook / Event System

```typescript
// Register a hook handler
ctx.hook('kernel:ready', async () => {
  ctx.logger.info('System is ready!');
});

// Register data lifecycle hooks
ctx.hook('data:beforeInsert', async (objectName, record) => {
  if (objectName === 'task') {
    record.created_at = new Date().toISOString();
  }
});

// Trigger a custom hook
await ctx.trigger('my-plugin:initialized', { version: '1.0.0' });
```

See [rules/hooks-events.md](./rules/plugin-hooks-events.md) for all 14 built-in hooks and patterns.

### Logger

```typescript
ctx.logger.debug('Detailed trace info', { key: 'value' });
ctx.logger.info('Plugin initialized');
ctx.logger.warn('Cache miss rate high', { rate: 0.45 });
ctx.logger.error('Connection failed', error);
```

### Kernel Access

```typescript
const kernel = ctx.getKernel();
const isRunning = kernel.isRunning();
const state = kernel.getState(); // 'idle' | 'initializing' | 'running' | 'stopping' | 'stopped'
```

---

## Complete Plugin Example

```typescript
// packages/plugins/plugin-audit/src/plugin.ts
import type { Plugin, PluginContext } from '@objectstack/core';

interface AuditEntry {
  timestamp: string;
  operation: string;
  object: string;
  recordId?: string;
}

class AuditService {
  private log: AuditEntry[] = [];

  record(entry: AuditEntry) {
    this.log.push(entry);
  }

  getLog(): AuditEntry[] {
    return [...this.log];
  }
}

const AuditPlugin: Plugin = {
  name: 'com.example.audit',
  version: '1.0.0',
  type: 'plugin',
  dependencies: ['com.objectstack.engine.objectql'],

  async init(ctx: PluginContext) {
    // Phase 1: Register service and hooks
    const auditService = new AuditService();
    ctx.registerService('audit', auditService);

    ctx.hook('data:afterInsert', async (objectName, _record, result) => {
      auditService.record({
        timestamp: new Date().toISOString(),
        operation: 'insert',
        object: objectName,
        recordId: result?.id,
      });
    });

    ctx.logger.info('Audit plugin initialized');
  },

  async start(ctx: PluginContext) {
    // Phase 2: Log that audit is active
    ctx.logger.info('Audit logging active');
  },

  async destroy() {
    // Phase 3: Cleanup
  },
};

export default AuditPlugin;
```

---

## Using Plugins

```typescript
import { ObjectKernel } from '@objectstack/core';
import { ObjectQLPlugin } from '@objectstack/objectql';
import { DriverPlugin } from '@objectstack/runtime';
import { InMemoryDriver } from '@objectstack/driver-memory';
import AuditPlugin from './plugin';

const kernel = new ObjectKernel();
await kernel.use(new ObjectQLPlugin());
await kernel.use(new DriverPlugin(new InMemoryDriver()));
await kernel.use(AuditPlugin);
await kernel.bootstrap();

// Services are now available
const audit = kernel.getService<AuditService>('audit');
```

---

## Testing Plugins

```typescript
import { describe, it, expect } from 'vitest';
import { LiteKernel } from '@objectstack/core';
import AuditPlugin from './plugin';

describe('AuditPlugin', () => {
  it('records insert events', async () => {
    const kernel = new LiteKernel({ logger: { level: 'silent' } });
    kernel.use(AuditPlugin);
    await kernel.bootstrap();

    // Simulate a data event
    await kernel.context.trigger('data:afterInsert', 'task', {}, { id: '123' });

    const audit = kernel.getService('audit');
    const log = audit.getLog();
    expect(log).toHaveLength(1);
    expect(log[0].operation).toBe('insert');
    expect(log[0].object).toBe('task');

    await kernel.shutdown();
  });
});
```

---

## Well-Known Plugin Names & Services

| Plugin Name | Service Key | Package |
|:------------|:------------|:--------|
| `com.objectstack.engine.objectql` | `objectql` | `@objectstack/objectql` |
| `com.objectstack.driver.*` | `driver.{name}` | `@objectstack/driver-*` |
| `com.objectstack.auth` | `auth` | `@objectstack/plugin-auth` |
| `com.objectstack.rest` | `rest` | `@objectstack/rest` |
| `com.objectstack.metadata` | `metadata` | `@objectstack/metadata` |
| `com.objectstack.realtime` | `realtime` | `@objectstack/service-realtime` |
| `com.objectstack.cache` | `cache` | `@objectstack/service-cache` |

---

## MetadataPlugin Runtime Boundary

`MetadataPlugin` is the `IMetadataService` provider for ObjectOS, but runtime
metadata is read-only and artifact/file backed:

- Do **not** register `sys_metadata` or `sys_metadata_history` from an ObjectOS
  runtime plugin. Those persistence tables belong to the control plane.
- Do **not** call `MetadataManager.setDataEngine()` automatically from
  `MetadataPlugin.start()`. Project databases must contain business rows only.
- Use `artifactSource: { mode: 'local-file', path: './dist/objectstack.json' }`
  for local artifact boot; production should use the Artifact API loader once
  wired.
- `DatabaseLoader`, `setDatabaseDriver()`, and `setDataEngine()` remain valid for
  control-plane services that explicitly own metadata revisions, history, or
  overlays.

```typescript
import { MetadataPlugin } from '@objectstack/metadata';

await kernel.use(new MetadataPlugin({
  watch: false,
  artifactSource: { mode: 'local-file', path: './dist/objectstack.json' },
}));
```

---

## Health Monitoring (ObjectKernel Only)

```typescript
const MyPlugin: Plugin & { healthCheck(): Promise<PluginHealthStatus> } = {
  name: 'com.example.db',
  version: '1.0.0',

  async init(ctx) { /* ... */ },

  async healthCheck() {
    try {
      await this.pool.query('SELECT 1');
      return { healthy: true, message: 'Database connected' };
    } catch (err) {
      return { healthy: false, message: 'Database unreachable', details: { error: err.message } };
    }
  },
};

// Check health
const health = await kernel.checkPluginHealth('com.example.db');
const allHealth = await kernel.checkAllPluginsHealth();

// Get startup metrics
const metrics = kernel.getPluginMetrics();
// Map<string, number> — plugin name → startup duration in ms
```

---

## Feature Flags

```typescript
import { defineStack } from '@objectstack/spec';

export default defineStack({
  featureFlags: [
    {
      name: 'experimental_ai_copilot',
      label: 'AI Copilot',
      enabled: true,
      strategy: 'percentage',
      conditions: { percentage: 25 },   // 25% of users
      environment: ['production'],
    },
    {
      name: 'beta_kanban_view',
      label: 'Kanban View',
      enabled: true,
      strategy: 'group',
      conditions: { groups: ['beta_testers'] },
    },
  ],
});
```

Strategies: `boolean` | `percentage` | `user_list` | `group` | `custom`

---

## References

See [references/_index.md](./references/_index.md) for the full list of Zod
schemas (with one-line descriptions) — pointers into
`node_modules/@objectstack/spec/src/`. Always `Read` the source for exact field
shapes; do not rely on memory of property names.

