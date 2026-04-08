# @objectstack/metadata

> **Metadata Loading, Persistence & Customization Layer for ObjectStack.**

`@objectstack/metadata` is the central service responsible for loading, validating, persisting and watching all metadata definitions (Objects, Views, Flows, Apps, Agents, etc.) in the ObjectStack platform.

It implements the **`IMetadataService`** contract from `@objectstack/spec` and acts as the single source of truth that all other packages depend on.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     IMetadataService                        │
│              (Contract: @objectstack/spec)                   │
├─────────────────────────────────────────────────────────────┤
│                     MetadataManager                         │
│            (Orchestrator: this package)                      │
│                                                             │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │  In-Memory   │  │   Overlay    │  │  Type Registry    │  │
│  │  Registry    │  │   System     │  │  & Dependencies   │  │
│  └─────────────┘  └──────────────┘  └───────────────────┘  │
├─────────────────────────────────────────────────────────────┤
│                      Loader Layer                           │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │ Filesystem   │  │   Remote     │  │   Memory          │  │
│  │ Loader       │  │   Loader     │  │   Loader          │  │
│  │ (files)      │  │   (HTTP)     │  │   (test)          │  │
│  └─────────────┘  └──────────────┘  └───────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ DatabaseLoader (planned — datasource-backed storage) │   │
│  └──────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│                    Serializer Layer                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────────────┐  │
│  │   JSON   │  │   YAML   │  │   TypeScript/JavaScript  │  │
│  └──────────┘  └──────────┘  └──────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Core Concepts

### 1. Metadata Sources (Three-Scope Model)

ObjectStack adopts a three-scope layered model for metadata:

| Scope      | Storage      | Mutability   | Description                                |
|:-----------|:-------------|:-------------|:-------------------------------------------|
| `system`   | Filesystem   | Read-only    | Defined in code, shipped with packages      |
| `platform` | Database     | Admin-editable | Created/modified by admins via UI          |
| `user`     | Database     | User-editable  | Personal customizations per user           |

Resolution order: **system** ← merge(**platform**) ← merge(**user**).

### 2. Loaders

Loaders are pluggable data sources that know how to read/write metadata from different backends. Each loader declares a `MetadataLoaderContract` with name, protocol, and capabilities:

| Loader              | Protocol       | Read | Write | Watch | Status       |
|:--------------------|:---------------|:-----|:------|:------|:-------------|
| `FilesystemLoader`  | `file:`        | ✅   | ✅    | ✅    | Implemented  |
| `MemoryLoader`      | `memory:`      | ✅   | ✅    | ❌    | Implemented  |
| `RemoteLoader`      | `http:`        | ✅   | ✅    | ❌    | Implemented  |
| `DatabaseLoader`    | `datasource:`  | ✅   | ✅    | ❌    | Implemented  |

### 3. Serializers

Serializers convert metadata objects to/from different file formats:

- **JSONSerializer** — `.json` files with optional key sorting
- **YAMLSerializer** — `.yaml`/`.yml` files (JSON_SCHEMA for security)
- **TypeScriptSerializer** — `.ts`/`.js` module exports (for `defineObject()`, `defineView()`, etc.)

### 4. Overlay / Customization System

The overlay system enables non-destructive customizations on top of package-delivered (system) metadata, following a delta-based approach (JSON Merge Patch):

- **getOverlay** / **saveOverlay** / **removeOverlay** — manage customization deltas
- **getEffective** — returns the merged result of base + platform overlay + user overlay
- Overlays never modify the base definition — they are additive patches

### 5. MetadataManager (IMetadataService Implementation)

The `MetadataManager` is the main orchestrator. It provides:

- **Core CRUD**: `register`, `get`, `list`, `unregister`, `exists`, `listNames`
- **Convenience**: `getObject`, `listObjects`
- **Package Management**: `unregisterPackage` — unload all metadata from a package
- **Package Publishing**: `publishPackage`, `revertPackage`, `getPublished` — atomic package-level metadata publishing
- **Query / Search**: `query` with filtering, pagination, sorting by type/scope/state/tags
- **Bulk Operations**: `bulkRegister`, `bulkUnregister` with error handling
- **Import / Export**: `exportMetadata`, `importMetadata` with conflict resolution (skip/overwrite/merge)
- **Validation**: `validate` — structural validation of metadata items
- **Type Registry**: `getRegisteredTypes`, `getTypeInfo` — discover available metadata types
- **Dependency Tracking**: `getDependencies`, `getDependents` — cross-reference analysis
- **Watch / Subscribe**: `watchService` — observe metadata changes in real-time
- **Loader Delegation**: `load`, `loadMany`, `save` — delegate I/O to registered loaders

### 6. NodeMetadataManager

Extends `MetadataManager` with Node.js-specific capabilities:

- Auto-configures `FilesystemLoader` for local development
- File watching via **chokidar** for hot-reload during development
- Detects file add/change/delete events and notifies subscribers

### 7. MetadataPlugin

Integrates with the ObjectStack kernel plugin system:

- Registers as the primary `IMetadataService` provider
- Auto-loads all metadata types from the filesystem on startup (sorted by `loadOrder`)
- Supports YAML, JSON, TypeScript, and JavaScript metadata formats

## Metadata Types

The platform supports **26 built-in metadata types** across 6 protocol domains:

| Domain       | Types                                                                       |
|:-------------|:----------------------------------------------------------------------------|
| **Data**     | `object`, `field`, `datasource`, `validation`                               |
| **UI**       | `view`, `app`, `dashboard`, `report`, `action`, `theme`                     |
| **Automation** | `flow`, `workflow`, `trigger`, `schedule`                                 |
| **System**   | `manifest`, `translation`, `api`, `permission_set`, `role`, `profile`       |
| **Security** | `permission_set`, `role`                                                    |
| **AI**       | `agent`, `rag_pipeline`, `model`, `prompt`, `tool`                          |

Each type has a defined `loadOrder` (dependencies load before dependents), file patterns (e.g. `**/*.object.{ts,json,yaml}`), and overlay support flag.

## Spec Protocol References

This package depends on schemas and contracts defined in `@objectstack/spec`:

| Spec Module                      | What It Defines                                     |
|:---------------------------------|:----------------------------------------------------|
| `spec/contracts/metadata-service` | `IMetadataService` — the async service interface   |
| `spec/kernel/metadata-loader`    | Loader contract, load/save/watch schemas, `MetadataManagerConfig` |
| `spec/kernel/metadata-plugin`    | Type registry, plugin manifest, capabilities        |
| `spec/kernel/metadata-customization` | Overlay, merge strategy, customization policy   |
| `spec/system/metadata-persistence` | `MetadataRecord` — DB persistence envelope        |
| `spec/data/datasource`           | `DatasourceSchema`, `DriverDefinition`, capabilities |
| `spec/contracts/data-driver`     | `IDataDriver` — database driver interface           |

## Installation

```bash
pnpm add @objectstack/metadata
```

## Usage

### Basic (Browser-Compatible)

```typescript
import { MetadataManager, MemoryLoader } from '@objectstack/metadata';

const manager = new MetadataManager({
  formats: ['json'],
  loaders: [new MemoryLoader()],
});

// Register metadata
await manager.register('object', 'account', { name: 'account', label: 'Account', fields: {} });

// Retrieve
const obj = await manager.get('object', 'account');

// Query
const result = await manager.query({ types: ['object'], search: 'account' });
```

### Node.js (with Filesystem)

```typescript
import { NodeMetadataManager, MetadataPlugin } from '@objectstack/metadata/node';

const manager = new NodeMetadataManager({
  rootDir: './src',
  formats: ['typescript', 'json', 'yaml'],
  watch: true,
});

// Load all objects from filesystem
const objects = await manager.loadMany('object');

// Watch for changes
manager.watchService('object', (event) => {
  console.log(`Object ${event.name} was ${event.type}`);
});
```

### With Kernel Plugin

```typescript
import { MetadataPlugin } from '@objectstack/metadata/node';

const plugin = MetadataPlugin({
  rootDir: './src',
  watch: process.env.NODE_ENV === 'development',
});
// Register with ObjectStack kernel
kernel.use(plugin);
```

## Package Publishing

ObjectStack supports **package-level metadata publishing** — all metadata items within a package are published atomically.

### Publish a Package

```typescript
const result = await manager.publishPackage('com.acme.crm', {
  publishedBy: 'admin',
  validate: true,
});
// result: { success: true, version: 2, itemsPublished: 5, publishedAt: '...' }
```

### Revert to Last Published State

```typescript
await manager.revertPackage('com.acme.crm');
// All items restored to their publishedDefinition snapshots
```

### Get Published Version (Runtime Serving)

```typescript
const published = await manager.getPublished('object', 'opportunity');
// Returns publishedDefinition if exists, else current definition
```

## Package Structure

```
packages/metadata/
├── src/
│   ├── index.ts                     # Main exports (browser-compatible)
│   ├── node.ts                      # Node.js exports (filesystem, watching)
│   ├── metadata-manager.ts          # MetadataManager (IMetadataService impl)
│   ├── node-metadata-manager.ts     # NodeMetadataManager (+ file watching)
│   ├── plugin.ts                    # MetadataPlugin (kernel integration)
│   ├── loaders/
│   │   ├── loader-interface.ts      # MetadataLoader contract
│   │   ├── filesystem-loader.ts     # File I/O with glob, cache, ETag
│   │   ├── memory-loader.ts         # In-memory store (tests/overrides)
│   │   └── remote-loader.ts         # HTTP API loader with auth
│   ├── serializers/
│   │   ├── serializer-interface.ts  # MetadataSerializer contract
│   │   ├── json-serializer.ts       # JSON format
│   │   ├── yaml-serializer.ts       # YAML format
│   │   └── typescript-serializer.ts # TS/JS module format
│   └── migration/
│       ├── index.ts                 # Barrel export
│       └── executor.ts              # ChangeSet executor (DDL operations)
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── README.md                        # This file
└── ROADMAP.md                       # Development roadmap
```

## Related Packages

| Package                 | Relationship                                     |
|:------------------------|:-------------------------------------------------|
| `@objectstack/spec`     | Protocol definitions (schemas, contracts, types)  |
| `@objectstack/core`     | Logger, service registry, kernel utilities        |
| `@objectstack/runtime`  | Uses this package to bootstrap metadata           |
| `apps/studio`           | Visual metadata editor (consumes IMetadataService)|

## License

Apache-2.0 — see [LICENSE](../../LICENSE) for details.
