# Changelog

All notable changes to the ObjectStack Protocol will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed
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
