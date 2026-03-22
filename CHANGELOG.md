# Changelog

All notable changes to the ObjectStack Protocol will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **`@objectstack/driver-sql` plugin** — Migrated the Knex-based SQL driver from `@objectql/driver-sql`
  into `packages/plugins/driver-sql/`. The driver implements the standard `DriverInterface` from
  `@objectstack/core` and imports types from `@objectstack/spec/data`. Supports PostgreSQL, MySQL,
  and SQLite (via `better-sqlite3`). Includes schema sync, introspection, aggregation, window
  functions, transactions, and full CRUD with both QueryAST and legacy filter format support.
  All 72 unit tests pass against in-memory SQLite.

### Changed
- **Migrate API layer to Hono + Vercel Node adapter** — Replaced the vestigial Next.js-style
  `api/[...path].ts` catch-all with a proper `api/index.ts` Hono entrypoint using `handle(app)`
  from `hono/vercel`. Vercel routes now use a rewrite rule (`/api/*` → `/api`) for native Hono
  routing, eliminating path-normalisation hacks and catch-all bundling pitfalls. Kernel boot
  remains lazy (cold-start only) via `ensureApp()` / `ensureKernel()` in `_kernel.ts`.

### Fixed
- **Service-analytics build error (TS6133)** — Removed unused `measure` variable in
  `native-sql-strategy.ts` that caused the DTS build to fail with `noUnusedLocals` enabled,
  blocking the entire CI build pipeline.
- **Next.js adapter test failures** — Updated 9 metadata API test assertions to match the
  current `dispatch(method, path, body, queryParams, context)` call signature used by the
  implementation. Tests were still expecting the old `dispatch(subPath, context, method, body)`
  signature.
- **Auth plugin test failures** — Fixed 2 tests in `auth-plugin.test.ts` that referenced the
  wrong `AuthManager` instance via `registerService.mock.calls`. Added `mockClear()` before
  local plugin init to ensure `mock.calls[0]` points to the correct AuthManager for the test's
  plugin instance.
- **SvelteKit adapter test failures** — Updated test mock to include `dispatch()` method and
  aligned Metadata, Data, Error handling, and toResponse test assertions with the unified
  catch-all dispatch pattern used by the implementation and all other adapters (e.g. Hono).
  Removed obsolete `handleMetadata`/`handleData` references from the mock.
- **Vercel serverless 404 fix** — The previous `api/[...path].ts` path-normalisation fix is now
  superseded by the Hono adapter migration above. The new `api/index.ts` entrypoint combined with
  Vercel rewrites (`/api/*` → `/api`) eliminates the routing ambiguity that caused 404s.
- **Kernel cold-start race condition** — `api/_kernel.ts` uses a shared boot promise so that
  concurrent cold-start requests wait for the same initialisation rather than launching
  duplicate boot sequences. Seed-data failures are treated as non-fatal, and the broker shim
  is validated after bootstrap with automatic reattachment if lost.
- **Broker-resilient metadata handler** — `HttpDispatcher.handleMetadata()` no longer requires
  a broker upfront. It tries the protocol service and ObjectQL registry first, falling back to
  the broker only when available. Serverless/lightweight setups without a full message broker
  now return proper metadata responses instead of throwing 500 errors.

### Added
- **`@objectstack/service-analytics`** — New multi-driver analytics service implementing `IAnalyticsService`.
  Uses a **Strategy Pattern** with priority-ordered chain: **P1 NativeSQLStrategy** (pushes queries as
  native SQL to Postgres/MySQL drivers), **P2 ObjectQLStrategy** (translates to ObjectQL `aggregate()` AST),
  **P3 InMemoryStrategy** (delegates to existing `MemoryAnalyticsService` for dev/test). Includes
  `CubeRegistry` for auto-discovery of cubes from manifest definitions and object schema inference,
  `AnalyticsServicePlugin` for kernel plugin lifecycle, `generateSql()` dry-run capability, and
  `queryCapabilities()` driver probing for dynamic strategy selection. 34 unit tests covering all
  strategy branches.
- **Studio system objects visibility** — Studio now auto-registers all system objects (sys_user,
  sys_role, sys_audit_log, etc.) from plugin-auth, plugin-security, and plugin-audit at kernel
  initialization. The sidebar "System" group dynamically lists all `isSystem=true` objects
  with a collapsible "System Objects" section. A filter toggle on the Data group allows
  showing/hiding system objects from the main object list.
- **ObjectSchema `namespace` property** — New optional `namespace` field on `ObjectSchema` for logical domain
  classification (e.g., `'sys'`, `'crm'`). When set, `tableName` is auto-derived as `{namespace}_{name}` by
  `ObjectSchema.create()` unless an explicit `tableName` is provided. This decouples the logical object name
  from the physical table name and enables unified routing, permissions, and discovery by domain.
- **SystemObjectName constants** — Extended with all system objects: `ORGANIZATION`, `MEMBER`, `INVITATION`,
  `TEAM`, `TEAM_MEMBER`, `API_KEY`, `TWO_FACTOR`, `ROLE`, `PERMISSION_SET`, `AUDIT_LOG` (in addition to
  existing `USER`, `SESSION`, `ACCOUNT`, `VERIFICATION`, `METADATA`).
- **plugin-auth system objects** — Added `SysOrganization`, `SysMember`, `SysInvitation`, `SysTeam`,
  `SysTeamMember`, `SysApiKey`, `SysTwoFactor` object definitions with `namespace: 'sys'`. Existing objects
  (`SysUser`, `SysSession`, `SysAccount`, `SysVerification`) migrated to use namespace convention.
- **plugin-security system objects** — Added `SysRole` and `SysPermissionSet` object definitions.
- **plugin-audit** — New plugin package with `SysAuditLog` immutable audit trail object definition.
- **StorageNameMapping.resolveTableName()** — Now supports namespace-aware auto-derivation
  (`{namespace}_{name}` fallback when no explicit `tableName` is set).

### Changed
- **ObjectFilterSchema `includeSystem` default** — Changed from `false` to `true`. Studio
  ObjectManager now includes system objects by default. Users can toggle visibility via the
  Data group filter control.
- **System object naming convention** — All system objects now use `namespace: 'sys'` with short `name`
  (e.g., `name: 'user'` instead of `name: 'sys_user'`). The `sys_` prefix is auto-derived via
  `tableName` = `{namespace}_{name}`. File naming follows `sys-{name}.object.ts` pattern.
- **plugin-auth object exports** — New canonical exports use `Sys*` prefix (e.g., `SysUser`, `SysSession`).
  Legacy `Auth*` exports are preserved as deprecated re-exports for backward compatibility.
- **sys_metadata object** — Migrated to `namespace: 'sys'`, `name: 'metadata'` convention (tableName
  auto-derived as `sys_metadata`).
- **Locale code fallback** — New `resolveLocale()` helper in `@objectstack/core` that resolves
  locale codes through a 4-step fallback chain: exact match → case-insensitive match
  (`zh-cn` → `zh-CN`) → base language match (`zh-CN` → `zh`) → variant expansion
  (`zh` → `zh-CN`). Used by `createMemoryI18n`, `HttpDispatcher.handleI18n()`, and
  `I18nServicePlugin` route handlers.
- **Auto-detection of I18nServicePlugin** — Both `DevPlugin` and CLI `serve` command now
  automatically detect `translations`/`i18n` config in the stack definition and register
  `I18nServicePlugin` from `@objectstack/service-i18n` when available. Falls back to
  the core in-memory i18n (with locale resolution) if the package is not installed.
- **Enhanced i18n diagnostics** — `AppPlugin` now emits clear warnings when:
  - Translations exist but no i18n service is registered (guides user to add the plugin).
  - Translations are loaded into a fallback/stub i18n service (recommends production plugin).
- **i18n locale fallback in REST routes** — `HttpDispatcher.handleI18n()` translations and labels
  endpoints now resolve locale codes via fallback when exact match returns empty translations.
  The response includes `requestedLocale` when a fallback was used.

### Changed
- **DevPlugin i18n stub** — Replaced the duplicate `createI18nStub()` in `DevPlugin` with
  `createMemoryI18n` from `@objectstack/core`, ensuring locale fallback works consistently
  in dev mode. DevPlugin now tries `I18nServicePlugin` before the stub when stack has translations.
- `createMemoryI18n` now uses `resolveLocale()` internally for `t()` and `getTranslations()`,
  enabling locale fallback (e.g. `zh` → `zh-CN`) without any plugin changes.
- CLI `serve` command now auto-registers `I18nServicePlugin` when config has translations/i18n,
  mirroring DevPlugin's auto-detection behavior for production environments.

### Changed
- **i18n route self-registration** — Moved i18n REST endpoint registration from `RestServer` to
  `I18nServicePlugin` (and kernel fallback). The i18n plugin now self-registers `/api/v1/i18n/*`
  routes via the `kernel:ready` hook, following the same autonomous plugin pattern used by
  `AuthPlugin`, `WorkflowPlugin`, and other service plugins. `RestServer` no longer registers or
  manages any i18n endpoints, keeping it strictly a protocol-driven gateway.
- Removed `enableI18n` flag from `RestApiConfig` schema (`rest-server.zod.ts`) — i18n endpoints
  are now controlled by the i18n service plugin's own `registerRoutes` option (default: `true`).
- Removed `registerI18nEndpoints()` method from `RestServer` class.
- `I18nServicePlugin` now accepts `registerRoutes` and `basePath` options for HTTP route control.
- i18n endpoints now work independently of `RestServer`, enabling MSW/mock test environments
  to serve i18n routes without any REST API gateway dependency.
- **Dispatcher i18n bridge routes** — `createDispatcherPlugin()` now registers i18n HTTP route
  bridges (`GET /i18n/locales`, `GET /i18n/translations/:locale`, `GET /i18n/labels/:object/:locale`)
  via `HttpDispatcher.handleI18n()`, ensuring i18n endpoints work even when only the kernel's
  memory fallback i18n is active (no explicit `I18nServicePlugin` loaded). This is consistent with
  how auth, analytics, packages, storage, and automation services are bridged.

### Added
- **i18n as core built-in service** — The i18n service is now a `core` criticality service with
  automatic in-memory fallback. When no plugin (e.g. `I18nServicePlugin`) registers an i18n service,
  the kernel auto-injects `createMemoryI18n` (in-memory Map-backed II18nService implementation)
  during `validateSystemRequirements()`. This ensures `/api/v1/i18n/*` routes and discovery always
  report i18n as available, even without `plugin-i18n` installed.
- `createMemoryI18n` fallback factory in `@objectstack/core` (packages/core/src/fallbacks/memory-i18n.ts)
  implementing `II18nService` contract with translation loading, dot-notation key resolution, parameter
  interpolation, and locale management.

### Changed
- `ServiceRequirementDef.i18n` upgraded from `'optional'` to `'core'` — kernel now warns (instead
  of silently ignoring) when no i18n service is registered, and auto-injects in-memory fallback.
- `SERVICE_CONFIG['i18n'].plugin` in `protocol.ts` corrected from `'plugin-i18n'` to `'service-i18n'`
  to match the actual `@objectstack/service-i18n` package name.
- Updated kernel-services.mdx documentation to reflect i18n as core/built-in capability.

### Fixed
- **AppPlugin getService crash on missing services** — `AppPlugin.start()` and
  `loadTranslations()` now wrap `ctx.getService()` in try/catch, since the kernel's
  `getService` throws when a service is not registered (rather than returning `undefined`).
  This was the direct cause of `plugin.app.com.example.crm failed to start` — the i18n
  service was not registered, so `getService('i18n')` threw an unhandled exception.
- **CLI serve: host config AppPlugin mis-wrap** — `serve.ts` no longer wraps a host/aggregator config
  (one that already contains instantiated plugins in its `plugins` array) with an extra `AppPlugin`.
  This prevents the `plugin.app.dev-workspace failed to start` error and eliminates duplicate plugin
  registration when running `pnpm dev`.
- **plugin-auth CJS→ESM interop** — Added `module` and `exports` fields to
  `@objectstack/plugin-auth` package.json so Node.js resolves the ESM build (`.mjs`) when using
  dynamic `import()`, eliminating the `ExperimentalWarning: CommonJS module … is loading ES Module`
  warning caused by `better-auth` being ESM-only.
- **i18n service registration & state inconsistency** — Discovery API (`getDiscoveryInfo`) now uses
  the same async `resolveService()` fallback chain that request handlers (`handleI18n`) use, ensuring
  the reported service status is always consistent with actual runtime availability.
- Discovery `locale` field is now populated from the actual i18n service (`getDefaultLocale`,
  `getLocales`) instead of being hardcoded, so clients get accurate locale information.
- Updated all framework adapters (Hono, Express, Fastify, Next.js, NestJS, Nuxt, SvelteKit),
  the dispatcher plugin, and the MSW plugin to `await` the now-async `getDiscoveryInfo()`.

### Added
- **AppPlugin i18n auto-loading** — `AppPlugin` now automatically loads translation bundles from
  app configs (`translations` array) into the kernel's i18n service during the `start` phase,
  coordinating i18n data loading across server/dev/mock environments.
- i18n service registration guide in `content/docs/guides/kernel-services.mdx` documenting
  service registration patterns, discovery consistency, and AppPlugin auto-loading behavior.

### Changed
- Updated ROADMAP.md for v3.0 release preparation with full codebase scan results
- Audited all @deprecated items: 14 in spec, 9 in runtime packages (23 total)
- Identified stale deprecation notices targeting v2.0.0 (current: v2.0.7)
- Updated metrics: 172 schema files, 191 test files, 5,165 tests, 7,095 .describe() annotations

### Deprecated
- The following items are scheduled for removal in v3.0.0 (see `packages/spec/V3_MIGRATION_GUIDE.md`):
  - `Hub.*` barrel re-exports from `hub/index.ts`
  - `location` (singular) on `ActionSchema` — use `locations` (array)
  - `definePlugin()` in spec — will move to `@objectstack/core`
  - `createErrorResponse()` / `getHttpStatusForCategory()` in spec — will move to `@objectstack/core`
  - `RateLimitSchema`, `RealtimePresenceStatus`, `RealtimeAction` aliases
  - Event bus helper functions (`createDefaultEventBusConfig`, `createDefaultDLQConfig`, `createDefaultEventHandlerConfig`)
  - `HttpDispatcher` class in `@objectstack/runtime`
  - `createHonoApp()` in `@objectstack/hono`

## [2.0.7] - 2026-02-11

### Added
- Modularized `kernel/events.zod.ts` (765 lines) into 6 focused sub-modules for better tree-shaking:
  - `events/core.zod.ts`: Priority, metadata, type definition, base event
  - `events/handlers.zod.ts`: Event handlers, routes, persistence
  - `events/queue.zod.ts`: Queue config, replay, sourcing
  - `events/dlq.zod.ts`: Dead letter queue, event log entries
  - `events/integrations.zod.ts`: Webhooks, message queues, notifications
  - `events/bus.zod.ts`: Complete event bus config and helpers
- Created v3.0 migration guide (`packages/spec/V3_MIGRATION_GUIDE.md`)

### Changed
- `kernel/events.zod.ts` now re-exports from sub-modules (backward compatible)
- Updated all packages to version 2.0.7 with unified versioning

## [2.0.6] - 2026-02-11

### Changed
- Patch release for maintenance and stability improvements
- Updated all packages to version 2.0.6 with unified versioning

## [2.0.5] - 2026-02-10

### Changed
- Unified all package versions to 2.0.5
- Added `@objectstack/plugin-auth` and `@objectstack/plugin-security` to the changeset fixed versioning group
- All packages now release together under the same version number

## [2.0.4] - 2026-02-10

### Changed
- Patch release for maintenance and stability improvements
- Updated all packages to version 2.0.4 with unified versioning

## [2.0.3] - 2026-02-10

### Changed
- Patch release for maintenance and stability improvements
- Updated all packages to version 2.0.3 with unified versioning

## [2.0.2] - 2026-02-10

### Changed
- Exclude generated JSON schema files from git tracking
- Add `packages/spec/json-schema/` to `.gitignore` (1277 generated files, 5MB)
- JSON schema files are still generated during `pnpm build` and included in npm publish
- Fix studio module resolution logic for better compatibility
- Updated all packages to version 2.0.2 with unified versioning

## [2.0.1] - 2026-02-09

### Changed
- Patch release for maintenance and stability improvements
- Updated all packages to version 2.0.1 with unified versioning

## [0.9.1] - 2026-02-03

### Changed
- Patch release for maintenance and stability improvements
- Updated all packages to version 0.9.1 with unified versioning

## [0.9.0] - 2026-02-03

### Changed
- Minor version bump for new features and improvements
- All packages updated to version 0.9.0

## [0.8.2] - 2026-02-02

### Changed
- **BREAKING**: Removed `view-storage.zod.ts` and `ViewStorage` related types from `@objectstack/spec`
- **BREAKING**: Removed `createView`, `updateView`, `deleteView`, `listViews` from `ObjectStackProtocol` interface
- **BREAKING**: Removed in-memory View Storage implementation from `@objectstack/objectql`
- Updated `@objectstack/plugin-msw` to dynamically load `@objectstack/objectql` to avoid hard dependencies

## [0.8.1] - 2026-02-01

### Changed
- Patch release for maintenance and stability improvements
- Updated all packages to version 0.8.1

## [0.8.0] - 2026-02-01

### Changed
- Upgrade to Zod v4 and protocol improvements
- Aligned all protocol definitions with stricter type safety
- Updated all packages to version 0.8.0

## [0.7.2] - 2026-01-31

### Changed
- Updated system protocol JSON schemas (events, worker, metadata-loader)
- Enhanced documentation structure for system protocols
- Generated comprehensive JSON schema documentation

## [0.7.1] - 2026-01-31

### Changed
- Patch release for maintenance and stability improvements
- Updated all packages to version 0.7.1

## [0.6.1] - 2026-01-28

### Changed
- Patch release for maintenance and stability improvements
- Updated all packages to version 0.6.1

## [0.4.1] - 2026-01-27

### Fixed
- Synchronized plugin-msw version to 0.4.1 (was incorrectly at 0.3.3)
- Updated runtime peer dependency versions to ^0.4.1 across all plugins
- Fixed internal dependency version mismatches

## [0.4.0] - 2026-01-26

### Changed
- Updated all core packages to version 0.4.0

## [0.3.3] - 2026-01-25

### Changed
- Enhanced GitHub workflows for CI, release, and PR automation
- Added comprehensive prompt templates for different protocol areas
- Improved project documentation and automation guides
- Updated changeset configuration
- Added cursor rules for better development experience
- Updated all packages to version 0.3.3

## [0.3.2] - 2026-01-24

### Changed
- Patch release for maintenance and stability improvements
- Updated all packages to version 0.3.2

## [0.3.1] - 2026-01-23

### Changed
- Organized zod schema files by folder structure
- Improved project documentation

## [0.3.0] - 2026-01-22

### Added
- Comprehensive documentation structure with CONTRIBUTING.md
- Documentation hub at docs/README.md
- Standards documentation (naming-conventions, api-design, error-handling)
- Architecture deep dives (data-layer, ui-layer, system-layer)
- Code of Conduct
- Changelog template
- Migration guides structure
- Security and performance guides

### Changed
- Updated README.md with improved documentation navigation
- Enhanced documentation organization following industry best practices
- All packages now use unified versioning (all packages released together with same version number)

## [0.1.1] - 2026-01-20

### Added
- Initial protocol specifications
- Zod schemas for data, UI, system, AI, and API protocols
- JSON schema generation
- Basic documentation site with Fumadocs
- Example implementations (CRM, Todo)

## Template for Future Releases

```markdown
## [X.Y.Z] - YYYY-MM-DD

### Added
- New features or capabilities

### Changed
- Changes to existing functionality

### Deprecated
- Features that will be removed in upcoming releases

### Removed
- Features that have been removed

### Fixed
- Bug fixes

### Security
- Security-related changes
```

## How to Use This Changelog

### For Contributors

When making changes:

1. **Add entries under `[Unreleased]`** section
2. **Choose the appropriate category**: Added, Changed, Deprecated, Removed, Fixed, Security
3. **Write clear, concise descriptions** of your changes
4. **Link to PRs or issues** where applicable: `- Feature description (#PR_NUMBER)`

Example:
```markdown
### Added
- New encrypted field type for sensitive data (#123)
- Support for PostgreSQL window functions in query protocol (#124)

### Fixed
- Validation error when using lookup fields with filters (#125)
```

### For Maintainers

When releasing a new version:

1. **Create a new version section** from the `[Unreleased]` content
2. **Move entries** from `[Unreleased]` to the new version section
3. **Add release date** in YYYY-MM-DD format
4. **Tag the release** in git: `git tag -a v0.2.0 -m "Release v0.2.0"`
5. **Update links** at the bottom of the file

### Versioning Guide

Following [Semantic Versioning](https://semver.org/):

- **MAJOR** version (X.0.0): Incompatible API changes
- **MINOR** version (0.X.0): Add functionality in a backward compatible manner
- **PATCH** version (0.0.X): Backward compatible bug fixes

### Categories

- **Added**: New features, protocols, schemas, or capabilities
- **Changed**: Changes to existing functionality
- **Deprecated**: Features marked for removal (but still working)
- **Removed**: Features that have been removed
- **Fixed**: Bug fixes
- **Security**: Security vulnerability fixes or improvements

### Breaking Changes

Mark breaking changes clearly:

```markdown
### Changed
- **BREAKING**: Renamed `maxLength` to `maxLen` in FieldSchema (#126)
  Migration: Update all field definitions to use `maxLen` instead of `maxLength`
```

## Release Process

1. Update CHANGELOG.md with release notes
2. Update version in package.json files
3. Run `pnpm changeset version` to update package versions
4. Commit changes: `git commit -m "chore: release vX.Y.Z"`
5. Create git tag: `git tag -a vX.Y.Z -m "Release vX.Y.Z"`
6. Push: `git push && git push --tags`
7. Run `pnpm release` to publish packages

---

[Unreleased]: https://github.com/objectstack-ai/spec/compare/v2.0.7...HEAD
[2.0.7]: https://github.com/objectstack-ai/spec/compare/v2.0.6...v2.0.7
[2.0.6]: https://github.com/objectstack-ai/spec/compare/v2.0.5...v2.0.6
[2.0.5]: https://github.com/objectstack-ai/spec/compare/v2.0.4...v2.0.5
[2.0.4]: https://github.com/objectstack-ai/spec/compare/v2.0.3...v2.0.4
[2.0.3]: https://github.com/objectstack-ai/spec/compare/v2.0.2...v2.0.3
[2.0.2]: https://github.com/objectstack-ai/spec/compare/v2.0.1...v2.0.2
[2.0.1]: https://github.com/objectstack-ai/spec/compare/v0.9.1...v2.0.1
[0.9.1]: https://github.com/objectstack-ai/spec/compare/v0.9.0...v0.9.1
[0.9.0]: https://github.com/objectstack-ai/spec/compare/v0.8.2...v0.9.0
[0.8.2]: https://github.com/objectstack-ai/spec/compare/v0.8.1...v0.8.2
[0.8.1]: https://github.com/objectstack-ai/spec/compare/v0.8.0...v0.8.1
[0.8.0]: https://github.com/objectstack-ai/spec/compare/v0.7.2...v0.8.0
[0.7.2]: https://github.com/objectstack-ai/spec/compare/v0.7.1...v0.7.2
[0.7.1]: https://github.com/objectstack-ai/spec/compare/v0.6.1...v0.7.1
[0.6.1]: https://github.com/objectstack-ai/spec/compare/v0.4.1...v0.6.1
[0.4.1]: https://github.com/objectstack-ai/spec/compare/v0.4.0...v0.4.1
[0.4.0]: https://github.com/objectstack-ai/spec/compare/v0.3.3...v0.4.0
[0.3.3]: https://github.com/objectstack-ai/spec/compare/v0.3.2...v0.3.3
[0.3.2]: https://github.com/objectstack-ai/spec/compare/v0.3.1...v0.3.2
[0.3.1]: https://github.com/objectstack-ai/spec/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/objectstack-ai/spec/compare/v0.1.1...v0.3.0
[0.1.1]: https://github.com/objectstack-ai/spec/releases/tag/v0.1.1
