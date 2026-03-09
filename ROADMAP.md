# ObjectStack Protocol — Road Map

> **Last Updated:** 2026-02-28  
> **Current Version:** v3.0.11  
> **Status:** Protocol Specification Complete · Runtime Implementation In Progress

---

## Table of Contents

- [Current State Summary](#current-state-summary)
- [Codebase Metrics](#codebase-metrics)
- [🎯 Priority Roadmap — February 2026](#-priority-roadmap--february-2026)
- [Package Naming Convention](#package-naming-convention)
- [Phase 1: Protocol Specification (✅ Complete)](#phase-1-protocol-specification--complete)
- [Phase 2: Core Runtime (✅ Complete)](#phase-2-core-runtime--complete)
- [Phase 3: Data Layer (🟡 Mostly Complete)](#phase-3-data-layer--mostly-complete)
- [Phase 4: Service Implementations (🔴 In Progress)](#phase-4-service-implementations--in-progress)
- [Phase 5: Framework Adapters (✅ Complete)](#phase-5-framework-adapters--complete)
- [Phase 6: Enterprise Services (🔴 Planned)](#phase-6-enterprise-services--planned)
- [Phase 7: AI & Intelligence (🔴 Planned)](#phase-7-ai--intelligence--planned)
- [Phase 8: Platform & Ecosystem (🔴 Planned)](#phase-8-platform--ecosystem--planned)
- [Contract Implementation Matrix](#contract-implementation-matrix)
- [Package Status Matrix](#package-status-matrix)
- [v4.0 Schema & Toolchain Roadmap](#v40-schema--toolchain-roadmap)
- [Versioning Plan](#versioning-plan)
- [Related Documents](#related-documents)

---

## Current State Summary

ObjectStack v3.0 has achieved **comprehensive protocol specification** with 193 Zod schemas,
27 service contracts, and 8,425 `.describe()` annotations providing machine-readable documentation.
The core kernel, data engine, metadata system, and developer tooling are production-ready.
The primary focus now shifts to implementing the remaining 19 service contracts and hardening
the ecosystem for enterprise workloads.

### What Works Today

| Capability | Status | Package |
|:---|:---:|:---|
| Protocol Specification (Zod Schemas) | ✅ | `@objectstack/spec` |
| Microkernel (ObjectKernel / LiteKernel) | ✅ | `@objectstack/core` |
| Data Engine (ObjectQL) | ✅ | `@objectstack/objectql` |
| In-Memory Driver | ✅ | `@objectstack/driver-memory` |
| Metadata Service | ✅ | `@objectstack/metadata` |
| REST API Server | ✅ | `@objectstack/rest` |
| Client SDK (TypeScript) | ✅ | `@objectstack/client` |
| React Hooks | ✅ | `@objectstack/client-react` |
| Authentication (better-auth) | ✅ | `@objectstack/plugin-auth` |
| Auth in MSW/Mock Mode | ✅ | `@objectstack/plugin-auth` + `@objectstack/runtime` |
| RBAC / RLS / FLS Security | ✅ | `@objectstack/plugin-security` |
| CLI (16 commands) | ✅ | `@objectstack/cli` |
| Dev Mode Plugin | ✅ | `@objectstack/plugin-dev` |
| Next.js Adapter | ✅ | `@objectstack/nextjs` |
| NestJS Adapter | ✅ | `@objectstack/nestjs` |
| Hono HTTP Server | ✅ | `@objectstack/plugin-hono-server` |
| MSW Testing Plugin | ✅ | `@objectstack/plugin-msw` |
| VS Code Extension | 🟡 | `objectstack-vscode` |
| Studio IDE | 🟡 | `@objectstack/studio` |
| Hono Adapter | 🔴 | `@objectstack/hono` |

### What Needs Building

11 of 27 service contracts are specification-only (no runtime implementation).
These are the backbone of ObjectStack's enterprise capabilities.

### Minimal Implementation Strategy

ObjectStack follows a **minimal-first** approach to service implementation:

1. **Implement the smallest possible working version first** — Each service starts with the minimal viable implementation that unblocks real-world use cases.

2. **In-memory fallbacks via dev-plugin** — All non-critical services already have working in-memory fallbacks provided by `@objectstack/plugin-dev`, allowing development and testing to proceed while production implementations are built incrementally.

3. **DatabaseLoader is implemented (P0 resolved)** — The `DatabaseLoader` in the metadata service is now available, enabling:
   - Platform-level metadata editing in Studio
   - User overlay persistence across sessions
   - Multi-instance metadata synchronization
   - Production-grade metadata storage via any `IDataDriver`

4. **Independent upgrade path** — Each service can be independently upgraded from:
   - **Stub** (dev-plugin fallback) → **MVP** (minimal working implementation) → **Production** (full-featured with adapters)

This strategy ensures rapid iteration while maintaining a clear path to production readiness.

---

## Codebase Metrics

| Metric | Count |
|:---|---:|
| Packages (total) | 27 |
| Apps | 2 (Studio, Docs) |
| Examples | 4 (Todo, CRM, Host, BI Plugin) |
| Zod Schema Files | 200 |
| Exported Schemas | 1,600+ |
| `.describe()` Annotations | 8,750+ |
| Service Contracts | 27 |
| Contracts Implemented | 13 (52%) |
| Test Files | 229 |
| Tests Passing | 6,507 / 6,507 |
| `@deprecated` Items | 3 |
| Protocol Domains | 15 (Data, UI, AI, API, Automation, Cloud, Contracts, Identity, Integration, Kernel, QA, Security, Shared, Studio, System) |

### Spec Protocol Hardening Status

| Item | Status | Details |
|:---|:---:|:---|
| `defineStack()` strict by default | ✅ | `strict: true` default since v3.0.2, validates schemas + cross-references |
| `z.any()` elimination in UI protocol | ✅ | All `filter` fields → `FilterConditionSchema` or `ViewFilterRuleSchema`, all `value` fields → typed unions |
| Filter format unification | ✅ | MongoDB-style filters use `FilterConditionSchema`, declarative view/tab filters use `ViewFilterRuleSchema` — `z.array(z.unknown())` eliminated |
| Filter parameter naming (`filter` vs `filters`) | ✅ | Canonical HTTP param: `filter` (singular). `filters` accepted for backward compat. `HttpFindQueryParamsSchema` added. Client SDK + protocol.ts unified. |
| `isFilterAST()` structural validation | ✅ | Exported from `data/filter.zod.ts` — validates AST shape (comparison/logical/legacy) instead of naïve `Array.isArray`. `VALID_AST_OPERATORS` constant. |
| GET by ID parameter pollution prevention | ✅ | `GetDataRequestSchema` allowlists `select`/`expand`. Dispatcher whitelists only safe params. |
| Dispatcher response field mapping | ✅ | `handleApiEndpoint` uses spec-correct `result.records`/`result.total` instead of `result.data`/`result.count` |
| Seed data → object cross-reference | ✅ | `validateCrossReferences` detects seed data referencing undefined objects |
| Navigation → object/dashboard/page/report cross-reference | ✅ | App navigation items validated against defined metadata (recursive group support) |
| Negative validation tests (dashboard, page, report, view) | ✅ | Missing required fields, invalid enums, type violations, cross-reference errors all covered |
| Example-level strict validation tests | ✅ | Todo-style and CRM-style full app configs validated in strict mode |
| SSOT: types from Zod (`z.infer`) | ✅ | 135 UI types derived via `z.infer`, zero duplicate interfaces in `.zod.ts` files |
| `z.any()` in data/filter.zod.ts (8 instances) | ✅ Justified | Runtime comparison operators (`$eq`, `$ne`, `$in`, `$nin`) accept any value type |
| `z.unknown()` in extensibility fields | ✅ Justified | `properties`, `children`, `context`, `options`, `body` — inherently dynamic extensibility points |
| DashboardWidget discriminated union by type | 🔴 | Planned — chart/metric/pivot subtypes with type-specific required fields |
| CI lint rule rejecting new `z.any()` | 🔴 | Planned — eslint or custom lint rule to block `z.any()` additions |
| Dispatcher async `getService` bug fix | ✅ | All `getService`/`getObjectQLService` calls in `http-dispatcher.ts` now properly `await` async service factories. Covers `handleAnalytics`, `handleAuth`, `handleStorage`, `handleAutomation`, `handleMetadata`, `handleUi`, `handlePackages`. All 7 framework adapters (Express, Fastify, Hono, Next.js, SvelteKit, NestJS, Nuxt) updated to use `getServiceAsync()` for auth service resolution. |
| Analytics `getMetadata` → `getMeta` naming fix | ✅ | `handleAnalytics` in `http-dispatcher.ts` called `getMetadata({ request })` which didn't match the `IAnalyticsService` contract (`getMeta(cubeName?: string)`). Renamed to `getMeta()` and aligned call signature. Updated test mocks accordingly. |
| Unified ID/audit/tenant field naming | ✅ | Eliminated `_id`/`modified_at`/`modified_by`/`space_id` from protocol layer. All protocol code uses `id`, `updated_at`, `updated_by`, `tenant_id` per `SystemFieldName`. Storage-layer (NoSQL driver internals) retains `_id` for MongoDB/Mingo compat. |

---

## 🎯 Priority Roadmap — February 2026

> **Goal:** Prioritize APIs and client capabilities needed by [ObjectUI](https://github.com/objectstack-ai/objectui/blob/main/ROADMAP.md) frontend development.  
> **Target:** v3.1 protocol to fill core platform gaps.  
> **Updated:** 2026-02-22  
> **Owner:** @hotlong

### 1. Comments & Collaboration API for ObjectUI

Support record comments, @mention, activity feed, and changelog for the ObjectUI frontend.

| Item | Status | Location |
|:---|:---:|:---|
| Feed CRUD schema (create/list/update/delete) | ✅ | `api/feed-api.zod.ts` |
| Feed item types (comment, field_change, task, note, file, etc.) | ✅ | `data/feed.zod.ts` (13 types) |
| @mention support | ✅ | `data/feed.zod.ts` → `MentionSchema` |
| Threaded replies (parentId) | ✅ | `data/feed.zod.ts` → `parentId` |
| Emoji reactions (add/remove with counts) | ✅ | `api/feed-api.zod.ts` |
| Record subscriptions (notification channels) | ✅ | `api/feed-api.zod.ts` |
| Real-time collaboration (OT/CRDT) | ✅ | `system/collaboration.zod.ts` |
| `IFeedService` contract | ✅ | `contracts/feed-service.ts` |
| `service-feed` in-memory implementation | ✅ | `@objectstack/service-feed` (40 tests) |
| Pin/star comments | ✅ | `data/feed.zod.ts` → `pinned`/`starred`, `api/feed-api.zod.ts` → Pin/Star endpoints |
| Comment notification integration with `INotificationService` | 🔴 | `service-notification` not implemented |
| Activity feed search/filter endpoint | ✅ | `api/feed-api.zod.ts` → `SearchFeedRequestSchema` |
| Changelog (field-level audit trail) endpoint | ✅ | `api/feed-api.zod.ts` → `GetChangelogRequestSchema`, `ChangelogEntrySchema` |
| Feed route handler (14 methods in ObjectStackProtocol) | ✅ | `objectql/protocol.ts` → `listFeed`, `createFeedItem`, etc. |
| Client SDK `feed` namespace (14 methods) | ✅ | `client/src/index.ts` → `client.feed.*` |
| Feed service discovery | ✅ | `objectql/protocol.ts` → `getDiscovery()` → `services.feed` |

### 2. Automation Persistence & Scheduling Specs

Multi-stage triggers, action pipelines, execution logs, and cron scheduling standards.

| Item | Status | Location |
|:---|:---:|:---|
| Flow orchestration (18 node types) | ✅ | `automation/flow.zod.ts` |
| Trigger registry (record, field, webhook) | ✅ | `automation/trigger-registry.zod.ts` |
| Cron scheduling expression | ✅ | `automation/etl.zod.ts`, `automation/webhook.zod.ts` |
| Action pipeline (webhook, email, CRUD, notification) | ✅ | `automation/flow.zod.ts` (HTTP, CRUD, script nodes) |
| State machine & approval processes | ✅ | `automation/state-machine.zod.ts`, `automation/workflow.zod.ts` |
| Retry policies with exponential backoff | ✅ | `automation/webhook.zod.ts` |
| `IAutomationService` contract | ✅ | `contracts/automation-service.ts` (typed: `FlowParsed`, `ExecutionLog`) |
| `service-automation` DAG engine (MVP) | ✅ | `@objectstack/service-automation` (67 tests) |
| Execution log/history storage protocol | ✅ | `automation/execution.zod.ts` → `ExecutionLogSchema`, `ExecutionStepLogSchema` |
| Execution error tracking & diagnostics | ✅ | `automation/execution.zod.ts` → `ExecutionErrorSchema`, `ExecutionErrorSeverity` |
| Conflict resolution for concurrent executions | ✅ | `automation/execution.zod.ts` → `ConcurrencyPolicySchema` |
| Checkpointing/resume for interrupted flows | ✅ | `automation/execution.zod.ts` → `CheckpointSchema` |
| Scheduled execution persistence (next-run, pause/resume) | ✅ | `automation/execution.zod.ts` → `ScheduleStateSchema` |
| Automation API protocol (REST CRUD schemas) | ✅ | `api/automation-api.zod.ts` → 9 endpoints, all with `input`/`output` schemas (37 schema tests) |
| Automation HTTP route handler (9 routes) | ✅ | `runtime/http-dispatcher.ts` → `handleAutomation()` CRUD + toggle + runs |
| Client SDK `automation` namespace (10 methods) | ✅ | `client/src/index.ts` → `list`, `get`, `create`, `update`, `delete`, `toggle`, `runs.*` |
| Fault edge error path support | ✅ | `@objectstack/service-automation` → fault-type edge routing in DAG executor |
| Node step-level execution logging | ✅ | `@objectstack/service-automation` → per-node timing/status in `ExecutionLogEntry.steps` |
| Retry with exponential backoff & jitter | ✅ | `automation/flow.zod.ts` → `backoffMultiplier`, `maxRetryDelayMs`, `jitter` |
| Parallel branch execution (Promise.all) | ✅ | `@objectstack/service-automation` → unconditional edges run in parallel |
| Node timeout mechanism (Promise.race) | ✅ | `automation/flow.zod.ts` → `timeoutMs` per node, engine enforces via `Promise.race` |
| DAG cycle detection on registerFlow | ✅ | `@objectstack/service-automation` → DFS-based cycle detection with friendly error messages |
| Safe expression evaluation (no `new Function`) | ✅ | `@objectstack/service-automation` → operator-based parser, no code execution |
| Node input/output schema validation | ✅ | `automation/flow.zod.ts` → `inputSchema`/`outputSchema` per node, runtime validation |
| Flow version history & rollback | ✅ | `automation/flow.zod.ts` → `FlowVersionHistorySchema`, engine version management |
| BPMN parallel gateway & join gateway | ✅ | `automation/flow.zod.ts` → `parallel_gateway` (AND-split), `join_gateway` (AND-join) node types |
| BPMN default sequence flow | ✅ | `automation/flow.zod.ts` → `isDefault` field + `conditional` edge type on `FlowEdgeSchema` |
| BPMN boundary events (error/timer/signal) | ✅ | `automation/flow.zod.ts` → `boundary_event` node type + `boundaryConfig` (interrupting/non-interrupting) |
| BPMN wait event configuration | ✅ | `automation/flow.zod.ts` → `waitEventConfig` (timer/signal/webhook/manual/condition event types) |
| BPMN checkpoint reasons (parallel join, boundary) | ✅ | `automation/execution.zod.ts` → `parallel_join`, `boundary_event` in `CheckpointSchema.reason` |
| Wait node executor plugin protocol | ✅ | `automation/node-executor.zod.ts` → `WaitExecutorConfigSchema`, `WaitResumePayloadSchema`, `NodeExecutorDescriptorSchema` (19 tests) |
| BPMN XML interop protocol (import/export) | ✅ | `automation/bpmn-interop.zod.ts` → `BpmnImportOptionsSchema`, `BpmnExportOptionsSchema`, `BpmnInteropResultSchema`, `BUILT_IN_BPMN_MAPPINGS` (20 tests) |
| Studio Flow Builder protocol (canvas nodes/edges) | ✅ | `studio/flow-builder.zod.ts` → `FlowBuilderConfigSchema`, `FlowCanvasNodeSchema`, `FlowCanvasEdgeSchema`, `BUILT_IN_NODE_DESCRIPTORS` (23 tests) |
| Wait node runtime pause/resume executor | 🔴 | Runtime: `NodeExecutor` plugin for `wait` nodes (spec ready, runtime not yet implemented) |
| Studio Flow Builder canvas UI | 🔴 | Runtime: visual canvas with parallel/join/boundary node controls (spec ready, UI not yet implemented) |
| BPMN XML import/export plugin | 🔴 | Runtime: plugin-based BPMN 2.0 XML importer/exporter (spec ready, low priority) |

### 3. File Direct Upload & Resumable Upload Protocol

CloudFile / PresignedUrl schema supporting S3/Azure/GCS direct-to-cloud file uploads.

| Item | Status | Location |
|:---|:---:|:---|
| Presigned URL generation (upload/download) | ✅ | `api/storage.zod.ts` |
| Multi-provider support (S3, Azure, GCS, MinIO, R2, etc.) | ✅ | `system/object-storage.zod.ts` |
| Multipart upload configuration | ✅ | `system/object-storage.zod.ts` (chunk size 5MB–5GB) |
| Storage lifecycle policies (transition/expiration) | ✅ | `system/object-storage.zod.ts` |
| Bucket encryption & CORS | ✅ | `system/object-storage.zod.ts` |
| `IStorageService` contract | ✅ | `contracts/storage-service.ts` |
| `IStorageService` chunked upload methods | ✅ | `contracts/storage-service.ts` → `initiateChunkedUpload`, `uploadChunk`, `completeChunkedUpload`, `abortChunkedUpload` |
| `service-storage` local FS + S3 skeleton | ✅ | `@objectstack/service-storage` (8 tests) |
| `S3StorageAdapter` multipart upload stubs | ✅ | `@objectstack/service-storage` → `S3StorageAdapter` |
| Chunked upload with resume token | ✅ | `api/storage.zod.ts` → `InitiateChunkedUploadRequestSchema`, `resumeToken` |
| Complete chunked upload response | ✅ | `api/storage.zod.ts` → `CompleteChunkedUploadResponseSchema` |
| Upload progress tracking protocol | ✅ | `api/storage.zod.ts` → `UploadProgressSchema` |
| `StorageApiContracts` route registry | ✅ | `api/storage.zod.ts` → 6 endpoints (presigned, complete, chunked init/chunk/complete, progress) |
| Client SDK chunked upload methods | ✅ | `client/src/index.ts` → `getPresignedUrl`, `initChunkedUpload`, `uploadPart`, `completeChunkedUpload`, `resumeUpload` |
| Mobile / file picker / browser fallback | 🔴 | Not yet specified (runtime concern) |
| File type whitelist/blacklist validation | ✅ | `api/storage.zod.ts` → `FileTypeValidationSchema` |

### 4. Streaming Data Export & Batch Operation Optimization

Cursor/Pagination protocol for large-scale data import/export with template-based mapping.

| Item | Status | Location |
|:---|:---:|:---|
| Batch CRUD (create/update/upsert/delete, max 200) | ✅ | `api/batch.zod.ts` |
| Atomic transactions & dry-run validation | ✅ | `api/batch.zod.ts` |
| Cursor-based & offset pagination | ✅ | `data/query.zod.ts` |
| Import mapping configuration | ✅ | `data/mapping.zod.ts` |
| Dataset import mode | ✅ | `data/dataset.zod.ts` |
| Full query & filter language | ✅ | `data/filter.zod.ts` |
| Streaming/chunked export endpoint (CSV/JSON/Excel) | ✅ | `api/export.zod.ts` → `CreateExportJobRequestSchema`, `ExportFormat` |
| Import validation & deduplication | ✅ | `api/export.zod.ts` → `ImportValidationConfigSchema`, `DeduplicationStrategy` |
| Template-based field mapping for import/export | ✅ | `api/export.zod.ts` → `ExportImportTemplateSchema`, `FieldMappingEntrySchema` |
| Scheduled export jobs & status query | ✅ | `api/export.zod.ts` → `ScheduledExportSchema`, `ScheduleExportRequestSchema` |
| Export job progress & download URL | ✅ | `api/export.zod.ts` → `ExportJobProgressSchema`, `GetExportJobDownloadResponseSchema` |
| Export job listing & history | ✅ | `api/export.zod.ts` → `ListExportJobsRequestSchema`, `ExportJobSummarySchema` |
| Export API contracts (6 endpoints) | ✅ | `api/export.zod.ts` → `ExportApiContracts` |
| IExportService contract | ✅ | `contracts/export-service.ts` |
| Cursor-based pagination in data.find() | ✅ | `api/protocol.zod.ts` → `FindDataResponseSchema` (`nextCursor` + `hasMore`) |

### 5. API Capability Declaration & Service Discovery

Strengthen discovery capabilities for frontend intelligent adaptation.

| Item | Status | Location |
|:---|:---:|:---|
| Per-service status reporting (available/degraded/stub) | ✅ | `api/discovery.zod.ts` |
| Dynamic API route mapping | ✅ | `api/discovery.zod.ts` → `ApiRoutesSchema` |
| Localization info (locale, timezone) | ✅ | `api/discovery.zod.ts` |
| Custom metadata extensions | ✅ | `api/discovery.zod.ts` |
| Capabilities declaration (comments, automation, search, cron, files, analytics) | ✅ | `api/discovery.zod.ts` → `capabilities` with hierarchical descriptors |
| Well-known capabilities (feed, comments, automation, cron, search, export, chunkedUpload) | ✅ | `api/discovery.zod.ts` → `WellKnownCapabilitiesSchema`, `protocol.zod.ts` → `GetDiscoveryResponseSchema.capabilities` |
| Dynamic capabilities population from registered services | ✅ | `objectql/protocol.ts` → `getDiscovery()` builds capabilities from service registry |
| Client SDK `capabilities` getter | ✅ | `client/index.ts` → `ObjectStackClient.capabilities` |
| Per-service version info | ✅ | `api/discovery.zod.ts` → `ServiceInfoSchema.version` |
| Rate limit & quota disclosure | ✅ | `api/discovery.zod.ts` → `ServiceInfoSchema.rateLimit` |
| OpenAPI/GraphQL schema discovery endpoint | ✅ | `api/discovery.zod.ts` → `DiscoverySchema.schemaDiscovery` |

> **Recommendation:** Sync this roadmap with ObjectUI / client / runner / console and prioritize v3.1 protocol to fill core platform gaps.

---

## Package Naming Convention

> **Adopted:** 2026-02-15  
> **Scope:** All new packages from v3.1 onward; existing `plugin-auth` will migrate to `service-auth` in v4.0.

To clearly distinguish **core platform services** from **optional extensions**, all ObjectStack packages
follow a strict naming convention:

| Prefix | Purpose | Characteristics | Examples |
|:---|:---|:---|:---|
| `service-*` | **Core service implementations** | Implements an `I*Service` contract; provides platform infrastructure; typically required for production | `service-auth`, `service-cache`, `service-queue` |
| `plugin-*` | **Optional extensions** | Adds optional functionality; development tools, testing utilities, or domain-specific features; not required for production | `plugin-dev`, `plugin-msw`, `plugin-bi` |
| `driver-*` | **Data drivers** | Implements `IDataDriver` for a specific database | `driver-memory`, `driver-postgres` |
| `adapter / framework name` | **Framework adapters** | Integrates ObjectStack with a web framework | `nextjs`, `nestjs`, `hono`, `express` |

### Migration from `plugin-*` to `service-*`

The following renames are planned for packages that implement core service contracts:

| Current Name (v3.x) | New Name (v4.0) | Reason |
|:---|:---|:---|
| `@objectstack/plugin-auth` | `@objectstack/service-auth` | Implements `IAuthService` contract |
| `@objectstack/plugin-cache` (not yet published) | `@objectstack/service-cache` | Implements `ICacheService` contract |
| `@objectstack/plugin-queue` (not yet published) | `@objectstack/service-queue` | Implements `IQueueService` contract |
| `@objectstack/plugin-dev` | `@objectstack/plugin-dev` | ✅ Keep — optional developer tooling |
| `@objectstack/plugin-msw` | `@objectstack/plugin-msw` | ✅ Keep — optional test mocking |
| `@objectstack/plugin-bi` | `@objectstack/plugin-bi` | ✅ Keep — optional BI extension |
| `@objectstack/plugin-hono-server` | `@objectstack/service-http` | Implements `IHttpServer` contract |
| `@objectstack/plugin-security` | `@objectstack/service-security` | Implements security enforcement |

> **Note:** During v3.x, new service implementations will be published directly under `service-*` naming.
> The existing `plugin-auth` package will be preserved with a deprecation notice and re-export shim
> until v4.0 removes the old name.

### System Object Naming Convention (`sys_` Prefix)

> **Adopted:** 2026-02-19  
> **Scope:** All system kernel objects in `SystemObjectName` constants.

All system kernel objects use the `sys_` prefix to clearly distinguish platform-internal objects from
business/custom objects, aligning with industry best practices (e.g., ServiceNow `sys_user`, `sys_audit`).

| Constant Key | Protocol Name | Description |
|:---|:---|:---|
| `SystemObjectName.USER` | `sys_user` | Authentication: user identity |
| `SystemObjectName.SESSION` | `sys_session` | Authentication: active session |
| `SystemObjectName.ACCOUNT` | `sys_account` | Authentication: OAuth / credential account |
| `SystemObjectName.VERIFICATION` | `sys_verification` | Authentication: email / phone verification |
| `SystemObjectName.METADATA` | `sys_metadata` | System metadata storage |

**Rationale:**
- Prevents naming collisions between system objects and business objects (e.g., a CRM `account` vs. `sys_account`)
- Aligns with ServiceNow and similar platforms that use `sys_` as a reserved namespace
- ObjectStack already uses namespace + FQN for business object isolation; the `sys_` prefix completes the picture for kernel-level objects
- Physical storage table names can differ via `ObjectSchema.tableName` + `StorageNameMapping.resolveTableName()` for backward compatibility

**Migration (v3.x → v4.0):**
- v3.x: The `SystemObjectName` constants now emit `sys_`-prefixed names. Implementations using `StorageNameMapping.resolveTableName()` can set `tableName` to preserve legacy physical table names during the transition.
- v3.x: The `@objectstack/plugin-auth` ObjectQL adapter now includes `AUTH_MODEL_TO_PROTOCOL` mapping to translate better-auth's hardcoded model names (`user`, `session`, `account`, `verification`) to protocol names (`sys_user`, `sys_session`, `sys_account`, `sys_verification`). Custom adapters must adopt the same mapping.
- v3.x: **Bug fix** — `AuthManager.createDatabaseConfig()` now wraps the ObjectQL adapter as a `DBAdapterInstance` factory function (`(options) => DBAdapter`). Previously the raw adapter object was passed, which fell through to the Kysely adapter path and failed silently. `AuthManager.handleRequest()` and `AuthPlugin.registerAuthRoutes()` now inspect `response.status >= 500` and log the error body, since better-auth catches internal errors and returns 500 Responses without throwing.
- v4.0: Legacy un-prefixed aliases will be fully removed.

---

## Phase 1: Protocol Specification (✅ Complete)

> **Goal:** Define every schema, type, and contract as a Zod-first source of truth.  
> **Result:** 193 Zod schemas, 27 service contracts, 8,425+ `.describe()` annotations across 15 protocol domains.

<details>
<summary>Deliverables — All Completed (click to expand)</summary>

- [x] **Data Protocol** — Object, Field (35+ types), Query, Filter, Validation, Hook, Datasource, Dataset, Analytics, Document, Storage Name Mapping (`tableName`/`columnName`), Feed & Activity Timeline (FeedItem, Comment, Mention, Reaction, FieldChange), Record Subscription (notification channels)
- [x] **Driver Specifications** — Memory, PostgreSQL, MongoDB driver schemas + SQL/NoSQL abstractions
- [x] **UI Protocol** — View (List/Form/Kanban/Calendar/Gantt), App, Dashboard, Report, Action, Page (16 types), Chart, Widget, Theme, Animation, DnD, Touch, Keyboard, Responsive, Offline, Notification, i18n, Content Elements, Enhanced Activity Timeline (`RecordActivityProps` unified timeline, `RecordChatterProps` sidebar/drawer), Unified Navigation Protocol (`NavigationItem` as single source of truth with 7 types: object/dashboard/page/url/report/action/group; `NavigationArea` for business domain partitioning; `order`/`badge`/`requiredPermissions` on all nav items), Airtable Interface Parity (`UserActionsConfig`, `AppearanceConfig`, `ViewTab`, `AddRecordConfig`, `InterfacePageConfig`, `showRecordCount`, `allowPrinting`)
- [x] **System Protocol** — Manifest, Auth Config, Cache, Logging, Metrics, Tracing, Audit, Encryption, Masking, Migration, Tenant, Translation (object-first `AppTranslationBundle` + diff/coverage detection + ICU MessageFormat support + bundle `_meta`/bidi + namespace isolation + `_notifications`/`_errors` grouping + AI translation hooks + coverage breakdown), Search Engine, HTTP Server, Worker, Job, Object Storage, Notification, Message Queue, Registry Config, Collaboration, Compliance, Change Management, Disaster Recovery, License, Security Context, Core Services, SystemObjectName/SystemFieldName Constants, StorageNameMapping Utilities
- [x] **Automation Protocol** — Flow (autolaunched/screen/schedule), Workflow, State Machine, Trigger Registry, Approval, ETL, Sync, Webhook, BPMN Semantics (parallel/join gateways, boundary events, wait events, default sequence flows), Node Executor Plugin Protocol (wait pause/resume, executor descriptors), BPMN XML Interop (import/export options, element mappings, diagnostics)
- [x] **AI Protocol** — Agent, Agent Action, Conversation, Cost, MCP, Model Registry, NLQ, Orchestration, Predictive, RAG Pipeline, Runtime Ops, Feedback Loop, DevOps Agent, Plugin Development
- [x] **API Protocol** — Protocol (104 schemas), Endpoint, Contract, Router, Dispatcher, REST Server, GraphQL, OData, WebSocket, Realtime, Batch, Versioning, HTTP Cache, Documentation, Discovery, Registry, Errors, Auth, Auth Endpoints, Metadata, Analytics, Query Adapter, Storage, Plugin REST API, Feed API (Feed CRUD, Reactions, Subscription), Automation API (CRUD + Toggle + Runs)
- [x] **Security Protocol** — Permission, Policy, RLS, Sharing, Territory
- [x] **Identity Protocol** — Identity, Organization, Role, SCIM
- [x] **Kernel Protocol** — Plugin, Plugin Lifecycle, Plugin Loading, Plugin Registry, Plugin Security, Plugin Validator, Plugin Versioning, Service Registry, Startup Orchestrator, Feature Flags, Context, Events, Metadata Plugin, Metadata Loader, Metadata Customization, CLI Extension, Dev Plugin, Package Registry, Package Upgrade, Execution Context
- [x] **Cloud Protocol** — Marketplace, App Store, Developer Portal, Marketplace Admin
- [x] **Integration Protocol** — Connector (Database, SaaS, File Storage, GitHub, Message Queue, Vercel)
- [x] **QA Protocol** — Testing framework schemas
- [x] **Studio Protocol** — Plugin extension schemas, Object Designer (field editor, relationship mapper, ER diagram), Page Builder (canvas, palette), Flow Builder (canvas nodes, edges, BPMN node descriptors, layout algorithms)
- [x] **Contracts** — 27 service interfaces with full method signatures
- [x] **Stack Definition** — `defineStack()`, `defineView()`, `defineApp()`, `defineFlow()`, `defineAgent()` helpers
- [x] **Stack Composition** — `composeStacks()` for declarative multi-stack merging with conflict resolution (`error`/`override`/`merge`)
- [x] **Error Map** — Custom Zod error messages with `objectStackErrorMap`
- [x] **DX Utilities** — `safeParsePretty()`, `formatZodError()`, `suggestFieldType()`

</details>

---

## Phase 2: Core Runtime (✅ Complete)

> **Goal:** Build the microkernel, plugin system, and service infrastructure.  
> **Result:** ObjectKernel + LiteKernel with full plugin lifecycle, service registry, security, and hot-reload.

<details>
<summary>Deliverables — All Completed (click to expand)</summary>

- [x] **ObjectKernel** — Full-featured async kernel with dependency resolution, rollback, health monitoring
- [x] **LiteKernel** — Lightweight sync kernel for serverless/test environments
- [x] **Plugin Lifecycle** — Three-phase lifecycle (init → start → destroy) with timeout/rollback
- [x] **Service Registry** — SINGLETON / TRANSIENT / SCOPED lifecycle, factory pattern, circular detection
- [x] **Logger** — Pino-based structured logging with child loggers and trace context
- [x] **API Registry** — Multi-protocol endpoint registry with conflict resolution
- [x] **Health Monitor** — Plugin health checking and recovery
- [x] **Hot Reload** — Runtime plugin hot-reload capability
- [x] **Dependency Resolver** — Semantic version parsing and constraint matching
- [x] **Security** — Permission manager, plugin permission enforcer, config validator, signature verifier, sandbox runtime, security scanner
- [x] **QA Module** — Testing adapter, HTTP adapter, test runner

</details>

---

## Phase 3: Data Layer (🟡 Mostly Complete)

> **Goal:** Deliver a production-ready data engine with multiple driver support.

### Completed

- [x] **ObjectQL Engine** — CRUD, hooks (before/after), middleware chain, action registry
- [x] **ObjectQL $expand** — Engine-level expand post-processing for lookup/master_detail fields via batch $in queries (driver-agnostic, max depth 3)
- [x] **Schema Registry** — FQN namespacing, multi-package contribution, priority resolution
- [x] **In-Memory Driver** — Full CRUD, bulk ops, transactions, aggregation pipeline (Mingo), streaming
- [x] **In-Memory Driver Persistence** — File-system (Node.js) and localStorage (Browser) persistence adapters with auto-save, custom adapter support
- [x] **Metadata Service** — CRUD, query, bulk ops, overlay system, dependency tracking, import/export, file watching
- [x] **Metadata Package Publishing** — `publishPackage`, `revertPackage`, `getPublished` for atomic package-level metadata publishing with version snapshots
- [x] **Serializers** — JSON, YAML, TypeScript format support
- [x] **Loaders** — Memory, Filesystem, Remote (HTTP) loaders
- [x] **REST API** — Auto-generated CRUD/Metadata/Batch/Discovery endpoints
- [x] **Protocol Implementation** — Discovery, ETag caching, batch operations, service status, $expand/populate normalization for REST/JSON-RPC/OData

### Remaining

- [ ] **PostgreSQL Driver** — Real SQL driver implementing `IDataDriver` (schema exists at `data/driver/postgres.zod.ts`)
- [ ] **MongoDB Driver** — Real NoSQL driver implementing `IDataDriver` (schema exists at `data/driver/mongo.zod.ts`)
- [ ] **Schema Migration Executor** — `modify_field` and `rename_object` operations incomplete
- [ ] **Vector Search** — `vectorFind()` on IDataEngine (spec defined, not implemented)
- [ ] **Full-Text Search Integration** — Driver-level FTS with ISearchService bridge
- [ ] **Connection Pooling** — `getPoolStats()` on IDataDriver

---

## Phase 4: Service Implementations (🔴 In Progress)

> **Goal:** Implement the remaining service contracts following the minimal-first strategy.  
> **Naming:** All contract implementations use `service-*` prefix (see [Package Naming Convention](#package-naming-convention)).

### Phase 4a: Metadata Persistence (P0 — ✅ Complete)

**The single critical blocker preventing production deployment — resolved.**

**DatabaseLoader Implementation:**
- [x] **Implement `DatabaseLoader`** in `packages/metadata/src/loaders/database-loader.ts`
  - [x] Implement `MetadataLoader` interface with protocol `datasource:`
  - [x] Accept `IDataDriver` instance via constructor injection
  - [x] Map to `sys_metadata` table CRUD operations
  - [x] Support `scope` filtering (system/platform/user)
  - [x] Auto-create `sys_metadata` table on first use via `syncSchema`
  - [x] Implement upsert semantics for `save()` operations
  - [x] Support optimistic concurrency via `version` field
  - [x] Implement `list()` with type filtering and pagination
  - [x] Declare capabilities: `{ read: true, write: true, watch: false, list: true }`

**Metadata Manager Integration:**
- [x] Auto-configure `DatabaseLoader` when `config.datasource` + `config.driver` is set
- [x] `setDatabaseDriver(driver)` for deferred setup via kernel service registry
- [x] Support multi-tenant isolation via `tenantId` filter
- [ ] Implement fallback strategy per `config.fallback` setting
- [ ] Persist overlay customizations to database (overlay save/remove backed by DatabaseLoader)

**Tests:**
- [x] Unit tests with mock `IDataDriver` (31 tests)
- [x] Integration tests for MetadataManager + DatabaseLoader (9 tests)
- [x] Error handling tests (driver failures → graceful degradation)

**This unblocks:**
- Platform-level metadata editing in Studio
- User overlay persistence across sessions
- Multi-instance metadata synchronization
- Production-grade metadata storage
- Package-level metadata publishing (publishPackage / revertPackage / getPublished)

### Phase 4b: Infrastructure Service Upgrades (P1 — Weeks 3-4)

**Upgrade existing services from in-memory fallbacks to production adapters.**

| Contract | Current Status | Upgrade Path |
|:---|:---|:---|
| `ICacheService` | ✅ Memory adapter + Redis skeleton | Add Redis adapter implementation |
| `IQueueService` | ✅ Memory adapter + BullMQ skeleton | Add BullMQ adapter implementation |
| `IJobService` | ✅ Interval scheduler + cron skeleton | Add cron adapter implementation |
| `IStorageService` | ✅ Local FS + S3 skeleton + chunked upload contract | Add S3 adapter implementation |

- [ ] `service-cache` — Implement Redis adapter with connection pooling
- [ ] `service-queue` — Implement BullMQ adapter with job persistence
- [ ] `service-job` — Implement cron adapter with distributed coordination
- [ ] `service-storage` — Implement S3 adapter with multipart upload

### Phase 4c: Communication & Search Services (P1 — Weeks 5-6)

**Implement new service contracts with minimal viable implementations.**

| Contract | Priority | Package | Notes |
|:---|:---:|:---|:---|
| `II18nService` | **P1** | `@objectstack/service-i18n` | Map-backed translation with locale resolution; object-first bundle & diff detection; AI suggestion hook (`suggestTranslations`) |
| `IRealtimeService` | **P1** | `@objectstack/service-realtime` | WebSocket/SSE push (replaces Studio setTimeout hack) |
| `IFeedService` | **P1** | `@objectstack/service-feed` | ✅ Feed/Chatter with comments, reactions, subscriptions |
| `ISearchService` | **P1** | `@objectstack/service-search` | In-memory search first, then Meilisearch driver |
| `INotificationService` | **P2** | `@objectstack/service-notification` | Email adapter (console logger in dev mode) |

- [x] `service-i18n` — Implement `II18nService` with file-based locale loading
- [x] `service-realtime` — Implement `IRealtimeService` with WebSocket + in-memory pub/sub
- [x] `service-feed` — Implement `IFeedService` with in-memory adapter (Feed CRUD, Reactions, Subscriptions, Threading)
- [ ] `service-search` — Implement `ISearchService` with in-memory search + Meilisearch adapter
- [ ] `service-notification` — Implement `INotificationService` with email adapter

### Phase 4d: Business Logic Services (P2 — Future)

**Advanced services for workflow automation and business intelligence.**

| Contract | Priority | Package | Notes |
|:---|:---:|:---|:---|
| `IAutomationService` | **P2** | `@objectstack/service-automation` | ✅ Plugin-based DAG flow engine + HTTP API + Client SDK (67 tests) |
| `IWorkflowService` | **P2** | `@objectstack/service-workflow` | State machine + approval processes |
| `IGraphQLService` | **P2** | `@objectstack/service-graphql` | Auto-generated GraphQL from objects |
| `IAIService` | **P2** | `@objectstack/service-ai` | LLM integration (OpenAI/Anthropic/local) |
| `IAnalyticsService` | **P3** | `@objectstack/service-analytics` | BI/OLAP queries |

- [x] `service-automation` — Implement `IAutomationService` with plugin-based DAG flow engine (CRUD/Logic/HTTP nodes, fault edges, parallel branches, cycle detection, safe eval, timeout, versioning), HTTP API CRUD (9 routes), Client SDK (10 methods), execution history with step-level logging
- [ ] `service-workflow` — Implement `IWorkflowService` with state machine runtime
- [ ] `service-graphql` — Implement `IGraphQLService` with auto-schema generation
- [ ] `service-ai` — Implement `IAIService` with multi-provider LLM routing
- [ ] `service-analytics` — Implement full `IAnalyticsService` beyond memory reference

---

## Phase 5: Framework Adapters (✅ Complete)

> **Goal:** First-class integration with popular web frameworks.  
> **Result:** 9 framework adapters — Next.js, NestJS, Hono, Express, Fastify, SvelteKit, Nuxt, plus Server Actions and Hono Server Plugin.

<details>
<summary>Deliverables — All Completed (click to expand)</summary>

- [x] **Next.js Adapter** — App Router, Auth/GraphQL/Meta/Data/Storage handlers (10/10)
- [x] **NestJS Adapter** — Full DI module, Express/Fastify support (10/10)
- [x] **Hono Server Plugin** — Production HTTP server with static file serving
- [x] **Hono Adapter** — Full route dispatchers for Auth/GraphQL/Meta/Data/Storage with createHonoApp
- [x] **Next.js Server Actions** — createServerActions with query/getById/create/update/remove/getMetadata
- [x] **Express Adapter** — Standalone Express v5 router with all ObjectStack routes
- [x] **Fastify Adapter** — Fastify plugin with full route dispatchers
- [x] **SvelteKit Adapter** — Web-standard Request/Response based handler for SvelteKit routes
- [x] **Nuxt Adapter** — h3 router integration for Nuxt server routes

</details>

---

## Phase 6: Enterprise Services (🔴 Planned)

> **Goal:** Production hardening for enterprise deployment scenarios.

### 6.1 Database Drivers

- [ ] `driver-postgres` — PostgreSQL driver with connection pooling, prepared statements, migrations
- [ ] `driver-mysql` — MySQL/MariaDB driver
- [ ] `driver-sqlite` — SQLite driver for edge/embedded
- [ ] `driver-mongodb` — MongoDB driver with aggregation pipeline
- [ ] `driver-turso` — Turso/libSQL edge database driver (see [Design Document](docs/design/driver-turso.md))
  - [x] **Phase 0: Protocol Schema** — `TursoConfigSchema`, `TursoSyncConfigSchema`, `TursoDriverSpec` defined in `packages/spec/src/data/driver/turso.zod.ts`
  - [ ] **Phase A: Core Driver** (v3.1) — `IDataDriver` + `ISchemaDriver` implementation, QueryAST→SQL compiler, plugin wrapper
  - [ ] **Phase B: Edge & Sync** (v3.2) — Embedded replica sync, WASM build for Cloudflare/Deno, offline write queue
  - [ ] **Phase C: Multi-Tenancy** (v3.3) — Database-per-tenant router, Turso Platform API integration
  - [ ] **Phase D: Advanced** (v4.0) — Vector search + `IAIService`, FTS5 + `ISearchService`, ~~better-auth adapter~~ (✅ done in plugin-auth)
- [ ] Driver benchmark suite comparing performance across all drivers

### 6.2 Multi-Tenancy

- [x] Tenant isolation strategies (schema-per-tenant, row-level, database-per-tenant) — `system/tenant.zod.ts`: `TenantIsolationConfigSchema` with `RowLevelIsolationStrategySchema`, `SchemaLevelIsolationStrategySchema`, `DatabaseLevelIsolationStrategySchema`
- [x] Tenant provisioning and lifecycle management — `system/provisioning.zod.ts`: `TenantProvisioningRequestSchema`, `TenantProvisioningResultSchema`, `ProvisioningStepSchema`; `contracts/provisioning-service.ts`: `IProvisioningService`
- [x] Tenant runtime context and quota enforcement — `kernel/context.zod.ts`: `TenantRuntimeContextSchema` with `tenantQuotas`; `system/tenant.zod.ts`: `TenantQuotaSchema`, `TenantUsageSchema`, `QuotaEnforcementResultSchema`
- [x] Tenant routing contract — `contracts/tenant-router.ts`: `ITenantRouter` (session → tenantId → DB client)
- [x] Metadata-driven deploy pipeline — `system/deploy-bundle.zod.ts`: `DeployBundleSchema`, `MigrationPlanSchema`, `DeployDiffSchema`; `contracts/deploy-pipeline-service.ts`: `IDeployPipelineService`
- [x] App marketplace installation protocol — `system/app-install.zod.ts`: `AppManifestSchema`, `AppInstallResultSchema`, `AppCompatibilityCheckSchema`; `contracts/app-lifecycle-service.ts`: `IAppLifecycleService`
- [ ] Cross-tenant data sharing policies

### 6.3 Observability

- [ ] OpenTelemetry integration (traces, metrics, logs)
- [ ] Distributed tracing across plugin boundaries
- [ ] Health dashboard and alerting
- [ ] Query performance monitoring and slow-query detection

### 6.4 Compliance & Audit

- [ ] Audit trail for all data mutations
- [ ] Data masking and encryption at rest
- [ ] GDPR/CCPA compliance utilities (right to erasure, data export)
- [ ] Change management and approval workflows for schema changes

### 6.5 ISO 27001:2022 Compliance

> **Goal:** Full schema coverage for ISO 27001:2022 Annex A controls to support certification readiness.

#### 6.5.1 High Priority (Certification Blockers) — ✅ Schema Complete

- [x] **Incident Response Protocol** (A.5.24–A.5.28) — `system/incident-response.zod.ts`: Incident classification, severity grading, response phases, notification matrix, escalation policies
- [x] **Audit Scheduling & Finding Tracking** (A.5.35) — `system/compliance.zod.ts`: AuditScheduleSchema, AuditFindingSchema for independent review and remediation tracking
- [x] **Change Management Security Approval** (A.8.32) — `system/change-management.zod.ts`: SecurityImpactAssessment with risk level, data classification, security reviewer workflow

#### 6.5.2 Medium Priority (Compliance Completeness) — ✅ Schema Complete

- [x] **Supplier Security Assessment** (A.5.19–A.5.22) — `system/supplier-security.zod.ts`: Supplier risk levels, security requirements, assessment lifecycle, remediation tracking
- [x] **Information Security Training** (A.6.3) — `system/training.zod.ts`: Training courses, completion records, organizational training plans with recertification

#### 6.5.3 Medium Priority (Pending)

- [ ] **OAuth Scope Binding** (A.8.1) — API endpoint schema with required OAuth scopes
- [ ] **Permission Registry** (A.8.2) — Transform `manifest.permissions` from `string[]` to structured registry enum

#### 6.5.4 Low Priority (Enhancements)

- [ ] Permission delegation and temporary privilege elevation protocol (AWS STS-style)
- [ ] Device trust policy extensions

---

## Phase 7: AI & Intelligence (🔴 Planned)

> **Goal:** First-class AI/ML capabilities as native platform services.

### 7.1 Core AI Services

- [ ] `service-ai` — Multi-provider LLM service (OpenAI, Anthropic, Gemini, local models)
- [ ] NLQ (Natural Language Query) runtime — translate natural language to ObjectQL
- [ ] Embedding service for vector search and RAG

### 7.2 Agent Framework

- [ ] Agent runtime — execute AI agents defined in spec schemas
- [ ] Tool registry — connect agents to ObjectQL operations, APIs, and workflows
- [ ] Conversation management — persistent chat with context windows

### 7.3 RAG Pipeline

- [ ] Document ingestion and chunking
- [ ] Vector store integration (Pinecone, Qdrant, pgvector)
- [ ] Retrieval-augmented generation with source attribution

### 7.4 Intelligence Layer

- [ ] Predictive analytics on object data
- [ ] Anomaly detection for operational metrics
- [ ] AI-assisted schema design and query optimization

---

## Phase 8: Platform & Ecosystem (🔴 Planned)

> **Goal:** Build the ecosystem for community and enterprise adoption.

### 8.1 UI Protocol Enhancement — Airtable Interface Parity

> See [Airtable Interface Gap Analysis](docs/design/airtable-interface-gap-analysis.md) for the full evaluation.
> **Note:** The `InterfaceSchema` layer has been removed in favor of direct App→Page navigation.
> App now supports unlimited nesting depth and sharing/embed capabilities directly.

#### Phase A: Page Foundation (v3.2) ✅

- [x] `RecordReviewConfigSchema` — Sequential record review/approval page type with navigation and actions
- [x] Content elements — `element:text`, `element:number`, `element:image`, `element:divider` as `PageComponentType` extensions
- [x] Per-element data binding — `dataSource` property on `PageComponentSchema` for multi-object pages
- [x] Element props — `ElementTextPropsSchema`, `ElementNumberPropsSchema`, `ElementImagePropsSchema`

#### Phase B: Element Library & Builder (v3.3) ✅

- [x] Interactive elements — `element:button`, `element:filter`, `element:form`, `element:record_picker`
- [x] `BlankPageLayoutSchema` — Free-form canvas composition with grid-based positioning
- [x] Record picker variable binding — `PageVariableSchema` integration with `element:record_picker`
- [x] `PageBuilderConfigSchema` — Canvas snap, zoom, element palette, layer panel configuration
- [ ] Studio Page Builder — Drag-and-drop element placement UI (runtime)

#### Phase C: Sharing, Embedding & Permissions (v4.0) 🟡

- [x] `SharingConfigSchema` — Public link, password, domain restriction, expiration (`src/ui/sharing.zod.ts`)
- [x] `EmbedConfigSchema` — iframe embedding with origin restrictions and display options
- [x] App-level sharing/embed — `sharing` and `embed` on `AppSchema`
- [x] Public form sharing — `sharing` property on `FormViewSchema`
- [ ] Design-time user impersonation — `previewAs` option for page preview (see [UX Optimization](docs/design/visual-design-ux-optimization.md))
- [ ] Share link generation runtime service
- [ ] Embed code generation runtime service
- [ ] Security audit for shared/embedded access control

#### Phase D: Advanced Page Features (v4.1)

- [ ] Page templates and duplication
- [ ] Page versioning — draft → published → archived lifecycle
- [ ] Real-time collaborative page editing
- [ ] Page analytics — page views, element interactions, user engagement

#### Phase E: Interface Parity — User Actions, Appearance & Tabs (v3.x) ✅

> Aligns Spec UI configuration with Airtable Interface capabilities.

- [x] `UserActionsConfigSchema` — Declarative toggles for sort/search/filter/rowHeight/addRecordForm/buttons in view toolbar (`src/ui/view.zod.ts`)
- [x] `AppearanceConfigSchema` — showDescription toggle and allowedVisualizations whitelist (`src/ui/view.zod.ts`)
- [x] `VisualizationTypeSchema` — Enum of switchable visualization types (grid/kanban/gallery/calendar/timeline/gantt/map) (`src/ui/view.zod.ts`)
- [x] `ViewTabSchema` — Multi-tab view interface with order, icon, pinned, isDefault, visible (`src/ui/view.zod.ts`)
- [x] `AddRecordConfigSchema` — Add record entry point with position/mode/formView (`src/ui/view.zod.ts`)
- [x] `showRecordCount` — Boolean on `ListViewSchema` for record count display (`src/ui/view.zod.ts`)
- [x] `allowPrinting` — Boolean on `ListViewSchema` for print capability (`src/ui/view.zod.ts`)
- [x] `InterfacePageConfigSchema` — Page-level interface configuration (source, levels, filterBy, appearance, userFilters, userActions, addRecord, showRecordCount, allowPrinting) (`src/ui/page.zod.ts`)
- [x] `PageSchema.interfaceConfig` — Optional interface config on pages for Airtable-style declarative page setup (`src/ui/page.zod.ts`)

### 8.2 Dashboard Enhancement — Airtable Dashboard Parity

> See [Airtable Dashboard Gap Analysis](content/docs/guides/airtable-dashboard-analysis.mdx) for the full evaluation and implementation examples.
> **Related Issues:** [#712](https://github.com/objectstack-ai/spec/issues/712), [#713](https://github.com/objectstack-ai/spec/issues/713), [#714](https://github.com/objectstack-ai/spec/issues/714), [objectui#585](https://github.com/objectstack-ai/objectui/issues/585), [objectui#586](https://github.com/objectstack-ai/objectui/issues/586), [objectui#587](https://github.com/objectstack-ai/objectui/issues/587), [objectui#588](https://github.com/objectstack-ai/objectui/issues/588)

#### Phase 1: Foundation (Sprint 1-2) — 2 weeks 🔴

Protocol enhancements and core component implementations for dashboard feature parity.

**Spec Protocol Changes:**
- [x] Add `colorVariant`, `actionUrl`, `description`, `actionType`, `actionIcon` to `DashboardWidgetSchema` ([#713](https://github.com/objectstack-ai/spec/issues/713))
- [x] Enhance `globalFilters` with `options`, `optionsFrom`, `defaultValue`, `scope`, `targetWidgets` ([#712](https://github.com/objectstack-ai/spec/issues/712))
- [x] Add `header` configuration to `DashboardSchema` with `showTitle`, `showDescription`, `actions` ([#714](https://github.com/objectstack-ai/spec/issues/714))
- [x] Add `pivotConfig` and `measures` array to `DashboardWidgetSchema` for multi-measure pivots ([#714](https://github.com/objectstack-ai/spec/issues/714))
- [x] Add required `id` field (SnakeCaseIdentifier) to `DashboardWidgetSchema` for `targetWidgets` referencing
- [x] Unify `WidgetActionTypeSchema` with `ActionSchema.type` — add `script` and `api` types
- [x] Add `.superRefine` conditional validation to `PageSchema` (`recordReview` required for `record_review`, `blankLayout` for `blank`)
- [x] Unify easing naming in `AnimationSchema` (theme.zod) to snake_case (`ease_in`, `ease_out`, `ease_in_out`)
- [x] Add `themeToken` reference to `TransitionConfigSchema` for theme animation token binding
- [x] Add `ResponsiveConfigSchema` and `PerformanceConfigSchema` to `ListViewSchema`
- [x] Migrate `HttpMethodSchema` / `HttpRequestSchema` from `view.zod.ts` to `shared/http.zod.ts` (re-exported for backward compat)
- [x] Rename `ThemeMode`→`ThemeModeSchema`, `DensityMode`→`DensityModeSchema`, `WcagContrastLevel`→`WcagContrastLevelSchema` (deprecated aliases kept)

**ObjectUI Component Implementations:**
- [ ] Implement `DashboardFilterBar` component for global filters ([objectui#588](https://github.com/objectstack-ai/objectui/issues/588))
- [ ] Add color variants + action button support to `MetricCard` component ([objectui#587](https://github.com/objectstack-ai/objectui/issues/587))
- [ ] Add description + action button to widget headers ([objectui#586](https://github.com/objectstack-ai/objectui/issues/586))

**Total Effort:** ~7.5 days

#### Phase 2: Advanced Widgets (Sprint 3-4) — 2 weeks 🟡

Advanced widget types and chart implementations.

- [ ] Implement `PivotTable` component with row/column totals and multi-measure support ([objectui#585](https://github.com/objectstack-ai/objectui/issues/585))
- [x] Protocol support for `funnel` chart type in `DashboardWidgetSchema` ([#713](https://github.com/objectstack-ai/spec/issues/713))
- [x] Protocol support for `grouped-bar` chart type in `DashboardWidgetSchema` ([#713](https://github.com/objectstack-ai/spec/issues/713))
- [ ] Implement `funnel` chart renderer in `plugin-charts` ([#713](https://github.com/objectstack-ai/spec/issues/713))
- [ ] Implement `grouped-bar` chart renderer in `plugin-charts` ([#713](https://github.com/objectstack-ai/spec/issues/713))
- [ ] Implement `stacked-bar` chart type in `plugin-charts` ([#713](https://github.com/objectstack-ai/spec/issues/713))
- [ ] Implement `horizontal-bar` chart variant in `plugin-charts` ([#713](https://github.com/objectstack-ai/spec/issues/713))

**Total Effort:** ~8.5 days

#### Phase 3: Polish & Enhancement (Sprint 5) — 1 week 🟢

Final polish and advanced features.

- [ ] Implement `DashboardHeader` composite component ([objectui#586](https://github.com/objectstack-ai/objectui/issues/586))
- [ ] Implement `gauge` chart type in `plugin-charts` ([#713](https://github.com/objectstack-ai/spec/issues/713))
- [ ] Add dashboard export (PDF/Image) functionality

**Total Effort:** ~6 days

**Total Project Timeline:** ~22 days (4.5 weeks)

### 8.3 Studio IDE

- [x] Object Designer Protocol — field editor, relationship mapper, ER diagram, object manager schemas defined (`studio/object-designer.zod.ts`)
- [ ] Object Designer Runtime — visual field editor with inline editing, drag-reorder, type-aware property panels
- [ ] Relationship Mapper — visual lookup/master-detail/tree creation with drag-to-connect
- [ ] ER Diagram — interactive entity-relationship diagram with force/hierarchy/grid layouts, minimap, zoom, export (PNG/SVG)
- [ ] Object Manager — unified object list with search, filter, card/table/tree views, quick preview, statistics
- [ ] View Builder — drag-and-drop list/form/dashboard designers
- [ ] Page Builder — drag-and-drop page designer with element palette (see [Gap Analysis](docs/design/airtable-interface-gap-analysis.md))
- [x] Flow Builder Protocol — canvas node shapes, edge styles, BPMN node descriptors (parallel_gateway, join_gateway, boundary_event, wait), layout algorithms, palette categories (`studio/flow-builder.zod.ts`)
- [ ] Flow Builder Runtime — visual automation flow editor with drag-and-drop canvas, node palette, property panel, minimap
- [ ] Security Console — permission matrix, RLS policy editor
- [ ] AI Playground — agent testing, NLQ sandbox
- [ ] Code Editor — Monaco-based TypeScript editing with live preview

> See [`apps/studio/ROADMAP.md`](apps/studio/ROADMAP.md) for detailed Studio phases.

### 8.4 Developer Experience

- [ ] VS Code Extension — full IntelliSense, diagnostics, and code actions for `.object.ts`, `.view.ts`
- [ ] `create-objectstack` scaffolding — templates for app, plugin, driver, adapter
- [ ] Documentation site — interactive tutorials, API playground
- [ ] CLI enhancements — `objectstack migrate`, `objectstack deploy`

### 8.5 Marketplace & Cloud

- [x] Plugin marketplace protocol — package artifact format, artifact storage & distribution
- [x] Platform version compatibility — engine requirements in manifest
- [x] Dependency resolution protocol — conflict detection, topological install ordering
- [x] Namespace collision detection — registry entries, conflict errors
- [x] Upgrade migration context — version context for onUpgrade hooks, upgrade history
- [x] Protocol `.describe()` completeness — all marketplace lifecycle schemas fully annotated
- [ ] Plugin marketplace runtime — publish, discover, install community plugins
  - [x] CLI: `os plugin build` — protocol schemas for build options & results (`cli-plugin-commands.zod.ts`)
  - [x] CLI: `os plugin validate` — protocol schemas for validation options, findings & results
  - [x] CLI: `os plugin publish` — protocol schemas for publish options & results
  - [x] CLI: `os plugin build` — command implementation with checksum computation & optional signing (`packages/cli`)
  - [x] CLI: `os plugin validate` — command implementation with checksum, signature, and platform checks (`packages/cli`)
  - [x] CLI: `os plugin publish` — command implementation with marketplace REST API upload (`packages/cli`)
  - [x] Runtime: package dependency resolution & platform compatibility enforcement (`IPackageService` contract)
  - [x] Runtime: namespace conflict detection at install time (`IPackageService.checkNamespaces`)
  - [x] Runtime: package upgrade lifecycle — plan, snapshot, execute, validate, rollback (`IPackageService` contract)
  - [x] Runtime: `NamespaceResolver` — namespace registration, conflict detection, suggestion generation (`@objectstack/core`)
  - [x] Runtime: `PackageManager` — install, upgrade, rollback, uninstall with dependency & namespace checks (`@objectstack/core`)
  - [x] API: `/api/v1/packages/install` — install with dependency & namespace checks (`package-api.zod.ts`)
  - [x] API: `/api/v1/packages/upgrade` — upgrade with plan, rollback support
  - [x] API: `/api/v1/packages/resolve-dependencies` — topological sort & conflict detection
  - [x] API: `/api/v1/packages/upload` — artifact upload & validation
  - [ ] Studio: marketplace browse/search, install, upgrade, uninstall UI
  - [ ] Cloud: artifact storage, distribution, SHA256 verification, security scanning
- [ ] App store — pre-built applications (CRM, HRM, Project Management)
- [ ] Developer portal — API keys, usage metrics, billing
- [ ] Managed cloud offering — ObjectStack-as-a-Service

### 8.6 Example Applications

- [x] **app-todo** — Beginner reference (objects, actions, flows, dashboards, reports, i18n) ✅
- [x] **app-crm** — Enterprise reference (10 objects, 5 AI agents, 4 RAG pipelines, security profiles) ✅
- [x] **app-host** — Multi-app orchestration pattern ✅
- [ ] **plugin-bi** — Business Intelligence plugin (currently a stub/placeholder)
- [ ] **app-hrm** — Human Resource Management example
- [ ] **app-project** — Project Management example
- [ ] **app-ecommerce** — E-commerce example

---

## Contract Implementation Matrix

| # | Contract | Interface | Implemented | Package | Notes |
|:---:|:---|:---|:---:|:---|:---|
| 1 | Data Engine | `IDataEngine` | ✅ | `@objectstack/objectql` | Full CRUD + hooks + middleware |
| 2 | Data Driver | `IDataDriver` | ✅ | `@objectstack/driver-memory` | In-memory reference driver |
| 3 | Metadata Service | `IMetadataService` | ✅ | `@objectstack/metadata` | Full CRUD + overlays + deps |
| 4 | Auth Service | `IAuthService` | ✅ | `@objectstack/plugin-auth` → `@objectstack/service-auth` in v4.0 | better-auth integration |
| 5 | HTTP Server | `IHttpServer` | ✅ | `@objectstack/plugin-hono-server` → `@objectstack/service-http` in v4.0 | Hono-based server |
| 6 | Logger | `Logger` | ✅ | `@objectstack/core` | Pino-based structured logging |
| 7 | Service Registry | `IServiceRegistry` | ✅ | `@objectstack/core` | Built into ObjectKernel |
| 8 | Analytics Service | `IAnalyticsService` | 🟡 | `@objectstack/driver-memory` | Memory reference only |
| 9 | Plugin Lifecycle | `IPluginLifecycleEvents` | 🟡 | `@objectstack/core` | Partial in kernel |
| 10 | Cache Service | `ICacheService` | ✅ | `@objectstack/service-cache` | Memory + Redis skeleton |
| 11 | Queue Service | `IQueueService` | ✅ | `@objectstack/service-queue` | Memory + BullMQ skeleton |
| 12 | Job Service | `IJobService` | ✅ | `@objectstack/service-job` | Interval + cron skeleton |
| 13 | Storage Service | `IStorageService` | ✅ | `@objectstack/service-storage` | Local FS + S3 skeleton |
| 14 | Realtime Service | `IRealtimeService` | ✅ | `@objectstack/service-realtime` | In-memory pub/sub |
| 15 | Feed Service | `IFeedService` | ✅ | `@objectstack/service-feed` | In-memory feed/chatter (comments, reactions, subscriptions) |
| 16 | Search Service | `ISearchService` | ❌ | `@objectstack/service-search` (planned) | Spec only |
| 17 | Notification Service | `INotificationService` | ❌ | `@objectstack/service-notification` (planned) | Spec only |
| 18 | AI Service | `IAIService` | ❌ | `@objectstack/service-ai` (planned) | Spec only |
| 19 | Automation Service | `IAutomationService` | ✅ | `@objectstack/service-automation` | DAG engine + HTTP API CRUD + Client SDK + typed returns (67 tests) |
| 20 | Workflow Service | `IWorkflowService` | ❌ | `@objectstack/service-workflow` (planned) | Spec only |
| 21 | GraphQL Service | `IGraphQLService` | ❌ | `@objectstack/service-graphql` (planned) | Spec only |
| 22 | i18n Service | `II18nService` | ✅ | `@objectstack/service-i18n` | File-based locale loading |
| 23 | UI Service | `IUIService` | ⚠️ | — | **Deprecated** — merged into `IMetadataService` |
| 24 | Schema Driver | `ISchemaDriver` | ❌ | — | Spec only |
| 25 | Startup Orchestrator | `IStartupOrchestrator` | ❌ | — | Kernel handles basics |
| 26 | Plugin Validator | `IPluginValidator` | ❌ | — | Spec only |
| 27 | Package Service | `IPackageService` | ❌ | `@objectstack/service-package` (planned) | Install, upgrade, rollback, deps, namespaces |

**Summary:** 14 fully implemented · 2 partially implemented · 11 specification only

---

## Package Status Matrix

| Package | Version | Tests | Status | Completeness |
|:---|:---:|:---:|:---:|:---:|
| `@objectstack/spec` | 3.0.8 | 5,269 | ✅ Stable | 10/10 |
| `@objectstack/core` | 3.0.8 | 12 files | ✅ Stable | 10/10 |
| `@objectstack/objectql` | 3.0.8 | ✅ | ✅ Stable | 9/10 |
| `@objectstack/metadata` | 3.0.8 | ✅ | ✅ Stable | 9/10 |
| `@objectstack/rest` | 3.0.8 | ✅ | ✅ Stable | 9/10 |
| `@objectstack/client` | 3.0.8 | ✅ | ✅ Stable | 10/10 |
| `@objectstack/client-react` | 3.0.8 | — | ✅ Stable | 9/10 |
| `@objectstack/runtime` | 3.0.8 | ✅ | ✅ Stable | 9/10 |
| `@objectstack/cli` | 3.0.8 | — | ✅ Stable | 9/10 |
| `@objectstack/driver-memory` | 3.0.8 | ✅ | ✅ Stable | 9/10 |
| `@objectstack/plugin-auth` | 3.0.8 | ✅ | ✅ Stable | 9/10 |
| `@objectstack/plugin-security` | 3.0.8 | — | ✅ Stable | 9/10 |
| `@objectstack/plugin-dev` | 3.0.8 | — | ✅ Stable | 10/10 |
| `@objectstack/plugin-hono-server` | 3.0.8 | — | ✅ Stable | 9/10 |
| `@objectstack/plugin-msw` | 3.0.8 | — | ✅ Stable | 9/10 |
| `@objectstack/service-cache` | 3.0.8 | 13 | ✅ Stable | 7/10 |
| `@objectstack/service-queue` | 3.0.8 | 8 | ✅ Stable | 7/10 |
| `@objectstack/service-job` | 3.0.8 | 11 | ✅ Stable | 7/10 |
| `@objectstack/service-storage` | 3.0.8 | 8 | ✅ Stable | 7/10 |
| `@objectstack/service-i18n` | 3.0.8 | 20 | ✅ Stable | 7/10 |
| `@objectstack/service-realtime` | 3.0.8 | 14 | ✅ Stable | 7/10 |
| `@objectstack/service-feed` | 3.0.8 | 40 | ✅ Stable | 7/10 |
| `@objectstack/nextjs` | 3.0.8 | ✅ | ✅ Stable | 10/10 |
| `@objectstack/nestjs` | 3.0.8 | ✅ | ✅ Stable | 10/10 |
| `@objectstack/hono` | 3.0.8 | ✅ | ✅ Stable | 10/10 |
| `@objectstack/express` | 3.0.8 | ✅ | ✅ Stable | 9/10 |
| `@objectstack/fastify` | 3.0.8 | ✅ | ✅ Stable | 9/10 |
| `@objectstack/sveltekit` | 3.0.8 | ✅ | ✅ Stable | 9/10 |
| `@objectstack/nuxt` | 3.0.8 | ✅ | ✅ Stable | 9/10 |
| `@objectstack/types` | 3.0.8 | — | 🟡 Minimal | 3/10 |
| `objectstack-vscode` | 3.0.8 | — | 🟡 Early | 4/10 |
| `create-objectstack` | 3.0.8 | — | 🟡 Basic | 5/10 |
| `@objectstack/studio` | 3.0.8 | — | 🟡 In Progress | 5/10 |
| `@objectstack/docs` | 3.0.8 | — | 🟡 In Progress | 6/10 |

---

## v4.0 Schema & Toolchain Roadmap

> **Target:** Q1 2027  
> **Theme:** Schema infrastructure upgrade, cross-ecosystem interoperability

| Priority | Action | Reason |
|:---:|:---|:---|
| **P0** | Complete Zod v4 migration | 2-7x performance improvement + built-in JSON Schema |
| **P0** | Rename `plugin-auth` → `service-auth`, `plugin-hono-server` → `service-http`, `plugin-security` → `service-security` | Align existing packages with `service-*` / `plugin-*` naming convention |
| **P1** | Add JSON Schema output layer | Provide protocol descriptions for non-TS ecosystems (Python/Go clients) |
| **P2** | Consider OpenAPI Spec generation | Auto-generate OpenAPI from Zod Schema, connecting the full API toolchain |
| **P3** | Evaluate Effect Schema | If Zod v4 performance is still insufficient, as a long-term candidate |

---

## Versioning Plan

> **Release Process Note (2026-02-28):** Fixed a bug where `workspace:*` peer dependencies combined with changesets' default `onlyUpdatePeerDependentsWhenOutOfRange: false` caused minor version bumps to escalate to major bumps across the fixed group. Internal peer dependencies now use `workspace:^` and the changeset config enables `onlyUpdatePeerDependentsWhenOutOfRange`.

| Version | Target | Focus |
|:---|:---|:---|
| **v3.0** | ✅ Shipped | Protocol specification complete, core runtime stable |
| **v3.1** | Q2 2026 | **ObjectUI Priority:** Comments & Collaboration API, Automation persistence/scheduling, File upload protocol, Data export/batch, API discovery capabilities; Essential services (`service-cache`, `service-queue`, `service-job`, `service-storage`), PostgreSQL driver, Turso/libSQL core driver ([design](docs/design/driver-turso.md)) |
| **v3.2** | Q3 2026 | Communication services (`service-graphql`, `service-notification`), Turso embedded replica & edge sync, Streaming export & scheduled jobs |
| **v3.3** | Q4 2026 | Business logic services (`service-workflow`, `service-search`), Turso multi-tenancy (database-per-tenant), Studio Page Builder runtime, Visual Design UX optimization ([plan](docs/design/visual-design-ux-optimization.md)) |
| **v4.0** | Q1 2027 | Zod v4 migration, `plugin-auth` → `service-auth` rename, JSON Schema output, OpenAPI generation, AI services, multi-tenancy, Turso vector search & FTS5 integration, UI Protocol Enhancement Phase C spec 🟡 mostly complete (sharing, embedding), `previewAs` design-time preview, Data Studio protocol, runtime share/embed services |
| **v4.1** | Q2 2027 | Studio IDE general availability, marketplace launch, UI Protocol Enhancement Phase D (templates, versioning, collaborative editing), Page Builder enhancements (selection model, clipboard, alignment) |
| **v5.0** | 2027+ | Managed cloud, app store, global ecosystem |

---

## Related Documents

| Document | Description |
|:---|:---|
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | Microkernel design, package structure, three-layer protocol stack |
| [`docs/design/driver-turso.md`](docs/design/driver-turso.md) | Turso/libSQL driver design document — architecture impact, capabilities, implementation phases |
| [`docs/design/airtable-interface-gap-analysis.md`](docs/design/airtable-interface-gap-analysis.md) | Airtable Interface gap analysis — UI protocol comparison, schema proposals, implementation roadmap |
| [`content/docs/guides/airtable-dashboard-analysis.mdx`](content/docs/guides/airtable-dashboard-analysis.mdx) | Airtable Dashboard gap analysis — Dashboard protocol & component enhancements, pivot tables, global filters, implementation roadmap |
| [`docs/design/visual-design-ux-optimization.md`](docs/design/visual-design-ux-optimization.md) | Visual Design UX optimization plan — Airtable benchmark, spec coverage audit, Studio builder alignment |
| [`apps/studio/ROADMAP.md`](apps/studio/ROADMAP.md) | Studio IDE development phases (v2.1 → v3.0) |
| [`docs/DX_ROADMAP.md`](docs/DX_ROADMAP.md) | Developer experience improvements |
| [`RELEASE_NOTES.md`](RELEASE_NOTES.md) | Version history and changelog |
| [`CONTRIBUTING.md`](CONTRIBUTING.md) | Contribution guidelines |
