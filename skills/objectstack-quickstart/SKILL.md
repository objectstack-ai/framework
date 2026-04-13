---
name: objectstack-quickstart
description: >
  Bootstrap and configure ObjectStack projects from scratch.
  Use when creating a new project, choosing a template, writing objectstack.config.ts,
  selecting drivers or adapters, configuring defineStack(), setting up the runtime,
  or answering "how do I get started?" questions. Also use when the user wants to
  scaffold objects, views, apps, or flows for a brand-new application.
  ALWAYS use this skill when you see: "create a project", "new app", "init",
  "get started", "scaffold", "bootstrap", "project setup", "objectstack.config",
  "defineStack", "driver selection", "which adapter", or "project structure".
license: Apache-2.0
compatibility: Requires @objectstack/spec v4+, Node 18+, pnpm 8+
metadata:
  author: objectstack-ai
  version: "1.0"
  domain: quickstart
  tags: project, scaffold, init, defineStack, driver, adapter, bootstrap, config
---

# Quickstart — ObjectStack Project Bootstrap

Expert instructions for creating, configuring, and bootstrapping ObjectStack
projects. Covers project scaffolding, `defineStack()` configuration, driver
selection, adapter integration, and the runtime boot sequence.

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
    namespace: 'todo',
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

---

## Manifest Reference

Every stack needs a `manifest` to identify itself in the ecosystem:

```typescript
manifest: {
  id: 'com.example.crm',        // Reverse domain unique ID
  namespace: 'crm',             // 2-20 chars, lowercase, prefixes objects
  version: '1.0.0',             // Semver
  type: 'app',                  // app | plugin | driver | module | ...
  name: 'Acme CRM',             // Human-readable display name
  description: 'CRM system',    // Optional description
}
```

**Namespace scoping:** Objects become `{namespace}__{name}` (double underscore)
in multi-app environments. Platform-reserved namespaces (`base`, `system`)
skip prefixing.

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
    new AppPlugin(CrmApp),     // → crm__account, crm__lead, ...
    new AppPlugin(TodoApp),    // → todo__task, ...
  ],
});
```

Each app's objects are prefixed by its `namespace` to prevent collisions.

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
    namespace: 'todo',
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

## Zod Schema References

When you need precise type definitions, read these bundled reference files:

| File | What It Contains |
|:-----|:-----------------|
| [`references/kernel/manifest.zod.ts`](./references/kernel/manifest.zod.ts) | Manifest schema (id, namespace, version, type) |
| [`references/data/datasource.zod.ts`](./references/data/datasource.zod.ts) | Datasource connection config |
| [`references/data/dataset.zod.ts`](./references/data/dataset.zod.ts) | Seed data schema (mode, externalId, records) |

For the full `defineStack()` / `composeStacks()` implementation, read
[`packages/spec/src/stack.zod.ts`](../../packages/spec/src/stack.zod.ts) directly.

Read `references/_index.md` for the complete list with descriptions.
