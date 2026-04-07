# Changelog — @objectstack/service-analytics

## 4.0.2

### Patch Changes

- Updated dependencies [5f659e9]
  - @objectstack/spec@4.0.2
  - @objectstack/core@4.0.2

## 4.0.0

### Patch Changes

- Updated dependencies [f08ffc3]
- Updated dependencies [e0b0a78]
  - @objectstack/spec@4.0.0
  - @objectstack/core@4.0.0

## 3.3.1

### Patch Changes

- @objectstack/spec@3.3.1
- @objectstack/core@3.3.1

## 3.2.10

### Patch Changes

- @objectstack/spec@3.3.0
- @objectstack/core@3.3.0

All notable changes to this package will be documented in this file.

## [3.2.9] — 2026-03-22

### Added

- Initial implementation of `@objectstack/service-analytics`
- `AnalyticsService` orchestrator implementing `IAnalyticsService`
- Strategy pattern with priority chain:
  - **P1 — NativeSQLStrategy**: Pushes queries as native SQL to SQL-capable drivers (Postgres, MySQL, etc.)
  - **P2 — ObjectQLStrategy**: Translates analytics queries into ObjectQL `engine.aggregate()` calls
  - **P3 — InMemoryStrategy**: Delegates to any registered `IAnalyticsService` (e.g., `MemoryAnalyticsService`)
- `CubeRegistry` for auto-discovery and registration of cubes from manifest definitions and object schema inference
- `AnalyticsServicePlugin` for kernel plugin lifecycle integration
- `queryCapabilities()` driver capability probing for strategy selection
- `generateSql()` dry-run SQL generation across all strategies
- Unit tests covering all strategy branches
