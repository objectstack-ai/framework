# @objectstack/spec

## 3.0.10

### Patch Changes

- d1e5d31: Fix UI protocol design issues

## 3.0.9

### Patch Changes

- 15e0df6: chore: unify all package versions to 3.0.8

## 3.0.8

### Patch Changes

- 5a968a2: Unify all package version numbers across the monorepo. All packages now share the same version and are released together via the changeset fixed group.

## 3.0.7

### Patch Changes

- 0119bd7: Implement DatabaseLoader for production metadata persistence
- 5426bdf: Migrate CLI architecture to oclif framework
  Improve chart

## 3.0.6

### Patch Changes

- 5df254c: Patch version release

## 3.0.5

### Patch Changes

- 23a4a68: Patch release for ObjectStack spec

## 3.0.4

### Patch Changes

- d738987: chore: patch release

## 3.0.3

### Patch Changes

- c7267f6: Patch release for maintenance updates and improvements.

## 3.0.2

### Patch Changes

- 28985f5: **Breaking Change: Strict Validation Enabled by Default**

  `defineStack()` now validates configurations by default to enforce naming conventions and catch errors early.

  **What Changed:**

  - `defineStack()` now defaults to `strict: true` (was `strict: false`)
  - Field names are now validated to ensure snake_case format
  - Object names, field types, and all schema definitions are validated

  **Migration Guide:**

  If you have existing code that violates naming conventions:

  ```typescript
  // Before (would silently accept invalid names):
  defineStack({
    manifest: {...},
    objects: [{
      name: 'my_object',
      fields: {
        firstName: { type: 'text' }  // ❌ Invalid: camelCase
      }
    }]
  });

  // After (will throw validation error):
  // Error: Field names must be lowercase snake_case

  // Fix: Use snake_case
  defineStack({
    manifest: {...},
    objects: [{
      name: 'my_object',
      fields: {
        first_name: { type: 'text' }  // ✅ Valid: snake_case
      }
    }]
  });
  ```

  **Temporary Workaround:**

  If you need to temporarily disable validation while fixing your code:

  ```typescript
  defineStack(config, { strict: false }); // Bypass validation
  ```

  **Why This Change:**

  1. **Catches Errors Early**: Invalid field names caught during development, not runtime
  2. **Enforces Conventions**: Ensures consistent snake_case naming across all projects
  3. **Prevents AI Hallucinations**: AI-generated objects must follow proper conventions
  4. **Database Compatibility**: snake_case prevents case-sensitivity issues in queries

  **Impact:**

  - Projects with properly named fields (snake_case): ✅ No changes needed
  - Projects with camelCase/PascalCase fields: ⚠️ Must update field names or use `strict: false`

## 3.0.1

### Patch Changes

- 389725a: Fix build and test stability improvements

## 3.0.0

### Major Changes

- Release v3.0.0 — unified version bump for all ObjectStack packages.

## 2.0.7

### Patch Changes

- Modularized kernel/events.zod.ts into 6 focused sub-modules for better tree-shaking and maintainability:

  - events/core.zod.ts: Priority, metadata, type definition, base event
  - events/handlers.zod.ts: Event handlers, routes, persistence
  - events/queue.zod.ts: Queue config, replay, sourcing
  - events/dlq.zod.ts: Dead letter queue, event log entries
  - events/integrations.zod.ts: Webhooks, message queues, notifications
  - events/bus.zod.ts: Complete event bus config and helpers

  kernel/events.zod.ts now re-exports from sub-modules (backward compatible).
  Created v3.0 migration guide.

## 2.0.6

### Patch Changes

- Patch release for maintenance and stability improvements

## 2.0.5

### Patch Changes

- Unify all package versions with a patch release

## 2.0.4

### Patch Changes

- Patch release for maintenance and stability improvements

## 2.0.3

### Patch Changes

- Patch release for maintenance and stability improvements

## 2.0.2

### Patch Changes

- 1db8559: chore: exclude generated json-schema from git tracking

  - Add `packages/spec/json-schema/` to `.gitignore` (1277 generated files, 5MB)
  - JSON schema files are still generated during `pnpm build` and included in npm publish via `files` field
  - Fix studio module resolution logic for better compatibility

## 2.0.1

### Patch Changes

- Patch release for maintenance and stability improvements

## 2.0.0

### Minor Changes

- 38e5dd5: feat: Studio DX, REST extraction, Dispatcher plugin
- 38e5dd5: test minor bump

## 1.0.12

### Patch Changes

- chore: add Vercel deployment configs, simplify console runtime configuration

## 1.0.11

## 1.0.10

## 1.0.9

## 1.0.8

## 1.0.7

## 1.0.6

### Patch Changes

- a7f7b9d: fix(data): add missing expand, top, having, distinct fields to QuerySchema for OData/ObjectQL compatibility

## 1.0.5

### Patch Changes

- b1d24bd: refactor: migrate build system from tsc to tsup for faster builds
  - Replaced `tsc` with `tsup` (using esbuild) across all packages
  - Added shared `tsup.config.ts` in workspace root
  - Added `tsup` as workspace dev dependency
  - significantly improved build performance

## 1.0.4

## 1.0.3

## 1.0.2

### Patch Changes

- a0a6c85: Infrastructure and development tooling improvements

  - Add changeset configuration for automated version management
  - Add comprehensive GitHub Actions workflows (CI, CodeQL, linting, releases)
  - Add development configuration files (.cursorrules, .github/prompts)
  - Add documentation files (ARCHITECTURE.md, CONTRIBUTING.md, workflows docs)
  - Update test script configuration in package.json
  - Add @objectstack/cli to devDependencies for better development experience

- 109fc5b: Unified patch release to align all package versions.

## 1.0.1

## 1.0.0

### Major Changes

- Major version release for ObjectStack Protocol v1.0.
  - Stabilized Protocol Definitions
  - Enhanced Runtime Plugin Support
  - Fixed Type Compliance across Monorepo

## 0.9.2

### Patch Changes

- Refactor documentation architecture and terminology (Data/System/UI Protocols).

## 0.9.1

### Patch Changes

- Patch release for maintenance and stability improvements. All packages updated with unified versioning.

## 0.8.2

### Patch Changes

- 555e6a7: Refactor: Deprecated View Storage protocol in favor of Metadata Views.

  - **BREAKING**: Removed `view-storage.zod.ts` and `ViewStorage` related types from `@objectstack/spec`.
  - **BREAKING**: Removed `createView`, `updateView`, `deleteView`, `listViews` from `ObjectStackProtocol` interface.
  - **BREAKING**: Removed in-memory View Storage implementation from `@objectstack/objectql`.
  - **UPDATE**: `@objectstack/plugin-msw` now dynamically loads `@objectstack/objectql` to avoid hard dependencies.

## 0.8.1

## 1.0.0

### Minor Changes

- # Upgrade to Zod v4 and Protocol Improvements

  This release includes a major upgrade to the core validation engine (Zod v4) and aligns all protocol definitions with stricter type safety.

## 0.7.2

### Patch Changes

- fb41cc0: Patch release: Updated documentation and JSON schemas

## 0.7.1

### Patch Changes

- Patch release for maintenance and stability improvements

## 0.6.1

### Patch Changes

- Patch release for maintenance and stability improvements

## 0.6.0

### Minor Changes

- b2df5f7: Unified version bump to 0.5.0

  - Standardized all package versions to 0.5.0 across the monorepo
  - Fixed driver-memory package.json paths for proper module resolution
  - Ensured all packages are in sync for the 0.5.0 release

## 0.4.2

### Patch Changes

- Unify all package versions to 0.4.2

## 0.4.1

### Patch Changes

- Version synchronization and dependency updates

  - Synchronized plugin-msw version to 0.4.1
  - Updated runtime peer dependency versions to ^0.4.1
  - Fixed internal dependency version mismatches

## 0.4.0

### Minor Changes

- Release version 0.4.0

## 0.3.3

### Patch Changes

- Workflow and configuration improvements

  - Enhanced GitHub workflows for CI, release, and PR automation
  - Added comprehensive prompt templates for different protocol areas
  - Improved project documentation and automation guides
  - Updated changeset configuration
  - Added cursor rules for better development experience

## 0.3.2

### Patch Changes

- Patch release for maintenance and stability improvements

## 0.3.1

## 0.3.0

### Minor Changes

- Documentation and project structure improvements

  - Comprehensive documentation structure with CONTRIBUTING.md
  - Documentation hub at docs/README.md
  - Standards documentation (naming-conventions, api-design, error-handling)
  - Architecture deep dives (data-layer, ui-layer, system-layer)
  - Code of Conduct
  - Enhanced documentation organization following industry best practices

## 0.2.0

### Minor Changes

- Initial release of ObjectStack Protocol & Specification packages

  This is the first public release of the ObjectStack ecosystem, providing:

  - Core protocol definitions and TypeScript types
  - ObjectQL query language and runtime
  - Memory driver for in-memory data storage
  - Client library for interacting with ObjectStack
  - Hono server plugin for REST API endpoints
  - Complete JSON schema generation for all specifications

## 0.1.2

### Patch Changes

- Remove debug logs from registry and protocol modules

## 0.1.1

### Patch Changes

- b58a0ef: Initial release of ObjectStack Protocol & Specification.
