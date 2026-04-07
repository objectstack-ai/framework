# Changelog

All notable changes to the ObjectStack Protocol will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed
- **CI Test Failures** — Resolved test failures across multiple packages:
  - `@objectstack/service-ai`: Fixed SDK fallback test by mocking `@ai-sdk/openai` dynamic import
    (SDK now available as transitive workspace dependency)
  - `@objectstack/nuxt`, `@objectstack/nextjs`, `@objectstack/fastify`, `@objectstack/sveltekit`:
    Added missing `prefix` argument to `dispatch()` assertion calls in adapter tests
  - `@objectstack/plugin-auth`: Updated `dependencies` assertion and added `manifest` service mock
    to match current plugin implementation

### Added
- **AIServicePlugin Auto-Detection** — AIServicePlugin now automatically detects and initializes
  LLM providers based on environment variables, eliminating the need for manual adapter configuration
  in each deployment:
  - Auto-detection priority: `AI_GATEWAY_MODEL` → `OPENAI_API_KEY` → `ANTHROPIC_API_KEY` → `GOOGLE_GENERATIVE_AI_API_KEY`
  - Graceful fallback to MemoryLLMAdapter when no provider is configured
  - Comprehensive logging of selected provider and warnings for missing SDKs
  - Supports custom model selection via `AI_MODEL` environment variable
  - Consistent behavior across CLI, Vercel, Docker, and custom deployments
  - Dynamic import failures are handled as soft errors with automatic fallback
  ([#1067](https://github.com/objectstack-ai/framework/issues/1067))

- **Metadata Versioning & History** — Comprehensive version history tracking and rollback capabilities
  for metadata items. Key features include:
  - `MetadataHistoryRecordSchema` defining structure for historical snapshots
  - `sys_metadata_history` system table for version storage
  - Automatic history tracking in `DatabaseLoader` with SHA-256 checksum deduplication
  - `getHistory()`, `rollback()`, and `diff()` methods in `IMetadataService`
  - REST API endpoints: `GET /history`, `POST /rollback`, `GET /diff`
  - `HistoryCleanupManager` with configurable retention policies (age-based and count-based)
  - Comprehensive test suite covering all history operations

  This aligns ObjectStack with enterprise platforms like Salesforce Setup Audit Trail and
  ServiceNow Update Sets. See `docs/METADATA_HISTORY.md` for detailed usage.

- **CLI: Remote API Commands** - Added 12 new CLI commands for interacting with remote ObjectStack servers:
  - **Authentication**: `os auth login`, `os auth logout`, `os auth whoami`
  - **Data API**: `os data query`, `os data get`, `os data create`, `os data update`, `os data delete`
  - **Metadata API**: `os meta list`, `os meta get`, `os meta register`, `os meta delete`
  - All commands support `--url` and `--token` flags, or use stored credentials from `~/.objectstack/credentials.json`
  - Multiple output formats: `--format json|table|yaml` (yaml available on all commands)
  - Environment variable support: `OBJECTSTACK_URL`, `OBJECTSTACK_TOKEN`
  - See [REMOTE_API_COMMANDS.md](./REMOTE_API_COMMANDS.md) for full documentation

### Changed
- **i18n: `I18nLabelSchema` now accepts `string` only** — `label`, `description`, `title`,
  and other display-text fields across all UI schemas (`AppSchema`, `NavigationArea`,
  `PageSchema`, `DashboardWidgetSchema`, `ReportSchema`, `ChartSchema`, `NotificationSchema`,
  `AriaPropsSchema`, etc.) now accept only plain strings. The previous `string | I18nObject`
  union type has been replaced with `z.string()`. i18n translation keys will be auto-generated
  by the framework at registration time; developers only need to provide the default-language
  string value. Translations are managed through translation files, not inline i18n objects.
  ([#1054](https://github.com/objectstack-ai/framework/issues/1054))

  **Migration:** Replace any `label: { key: '...', defaultValue: 'X' }` with `label: 'X'`.
  Existing plain-string labels require no changes.

  **Affected plugins updated:**
  - `@objectstack/plugin-setup` — `setup-app.ts`, `setup-areas.ts`
  - `@objectstack/plugin-auth` — navigation item labels
  - `@objectstack/plugin-security` — navigation item labels
  - `@objectstack/plugin-audit` — navigation item labels

### Documentation
- **README rewrite** — Rewrote `README.md` to accurately reflect the `objectstack-ai/framework`
  repository. Updates include: corrected title ("ObjectStack Framework"), updated badges
  (v4.0.1, 6,507 tests passing), fixed stale clone URL (`spec.git` → `framework.git`),
  added all missing packages (`driver-sql`, `driver-turso`, `plugin-audit`, `plugin-setup`,
  `service-feed`, `service-automation`, `service-ai`, `service-realtime`, `service-i18n`),
  updated codebase metrics (27 packages, 200 Zod schema files, 1,600+ exported schemas,
  8,750+ `.describe()` annotations, 6,507 tests passing), and restructured sections to
  match the current monorepo layout.

### Fixed
- **ObjectQLPlugin: cold-start metadata restoration** — `ObjectQLPlugin.start()` now calls
  `protocol.loadMetaFromDb()` after driver initialization and before schema sync, restoring
  all persisted metadata (objects, views, apps, etc.) from the `sys_metadata` table into the
  in-memory `SchemaRegistry`. Previously, user-created custom objects were lost after kernel
  cold starts or redeployments because the hydration step was missing. The fix gracefully
  degrades in in-memory-only or first-run scenarios where `sys_metadata` does not yet exist.
- **Studio Vercel API routes returning HTML instead of JSON** — Adopted the
  same Vercel deployment pattern used by `hotcrm`: committed
  `api/[[...route]].js` catch-all route so Vercel detects it pre-build,
  switched esbuild output from CJS to ESM (fixes `"type": "module"` conflict),
  and changed the bundle output to `api/_handler.js` (a separate file that
  the committed wrapper re-exports).  This avoids both Vercel's TS
  compilation overwriting the bundle (`ERR_MODULE_NOT_FOUND`) and the
  "File not found" error from deleting source files during build.
  Added `createRequire` banner to the esbuild config so that CJS
  dependencies (knex/tarn) can `require()` Node.js built-in modules like
  `events` without the "Dynamic require is not supported" error.
  Added `functions.includeFiles` in `vercel.json` to include native addons
  (`better-sqlite3`, `@libsql/client`) that esbuild cannot bundle.
  Added a build step to copy native external modules from the monorepo root
  `node_modules/` into the studio's local `node_modules/`, since pnpm's strict
  mode (unlike hotcrm's `shamefully-hoist`) doesn't symlink transitive native
  dependencies into app-level `node_modules/`.
  Updated rewrites to match: `/api/:path*` → `/api/[[...route]]`.
- **Studio CORS error on Vercel temporary/preview domains** — Changed
  `VITE_SERVER_URL` from hardcoded `https://play.objectstack.ai` to `""`
  (empty string / same-origin) in `vercel.json` so each deployment — including
  previews — calls its own serverless function instead of the production API
  cross-origin.  Also added Hono CORS middleware to `apps/studio/server/index.ts`
  as a safety net for any remaining cross-origin scenarios; dynamically allows
  all `*.vercel.app` subdomains, explicitly listed Vercel deployment URLs, and
  localhost.  Extracted `getVercelOrigins()` helper to keep CORS and
  better-auth `trustedOrigins` allowlists in sync.
- **Client test aligned with removed `ai.chat` method** — Updated
  `@objectstack/client` test suite to match the current API surface where
  `ai.chat()` was removed in favour of the Vercel AI SDK `useChat()` hook.
  The obsolete test that called `client.ai.chat()` now asserts the method is
  absent, fixing the CI `@objectstack/client#test` failure.

### Added
- **Metadata Assistant Agent (`service-ai`)** — New `metadata_assistant` agent definition that
  binds all 6 metadata management tools (`create_object`, `add_field`, `modify_field`,
  `delete_field`, `list_metadata_objects`, `describe_metadata_object`). Includes a tailored
  system prompt that guides the AI to use snake_case naming, verify existing schemas before
  modifications, and warn about destructive operations. Configured with `react` planning
  strategy (10 iterations, replan enabled) for multi-step schema design conversations.
- **Tool Confirmation Flags** — Added `requiresConfirmation: true` to `create_object` and
  `delete_field` tool definitions. These destructive/creation operations now signal to the
  frontend that user approval is needed before execution.
- **Frontend Tool Call Display (`AiChatPanel`)** — Enhanced the AI Chat Panel to render tool
  invocation parts from the Vercel AI SDK v6 stream protocol. Displays tool call status with
  visual indicators:
  - **Calling**: Spinner animation with tool name and argument summary
  - **Confirmation**: Yellow-bordered card with Approve/Deny buttons for `requiresConfirmation` tools
  - **Success**: Green success indicator with result preview
  - **Error**: Red error indicator with error message
  - **Denied**: Muted indicator for user-denied operations
- **Operation Confirmation Mechanism** — Integrated the Vercel AI SDK `addToolApprovalResponse`
  hook to support approval/denial workflows for tools marked with `requiresConfirmation`.
  When the server sends an `approval-requested` state, the chat panel shows Approve and Deny
  buttons. User decisions are sent back to the server to continue or abort the tool execution.
- **Metadata Management Tools (`service-ai`)** — Added 6 built-in AI tools for metadata
  CRUD operations, each defined as a first-class `Tool` metadata file using `defineTool()`
  from `@objectstack/spec/ai`:
  - `create-object.tool.ts` — Creates a new data object with schema validation
  - `add-field.tool.ts` — Adds a field to an existing object
  - `modify-field.tool.ts` — Modifies field properties on an object
  - `delete-field.tool.ts` — Removes a field from an object
  - `list-metadata-objects.tool.ts` — Lists all registered metadata objects
  - `describe-metadata-object.tool.ts` — Returns full schema details of an object
  
  Each `.tool.ts` file is an independent metadata unit with `name`, `label`, `description`,
  `category`, `builtIn`, and `parameters` — following the same `.object.ts` / `.view.ts`
  metadata file convention. Handler factories remain in `metadata-tools.ts` and bind handlers
  at `ai:ready` time via `registerMetadataTools(registry, { metadataService })`.
  79 unit tests covering tool metadata properties, handler execution, input validation,
  error handling, dual registration with data tools, and a full lifecycle test.
- **Agent Skills — `skills/` directory (agentskills.io)** — Created `skills/` folder at
  repository root following the [agentskills.io specification](https://agentskills.io/specification).
  Five expert-knowledge skills with hand-written `SKILL.md` files and `references/` quick-lookup
  tables:
  - `skills/schema-design/` — Data schema design (Object, Field, Validation, Index)
  - `skills/ui-design/` — UI protocol (View, App, Dashboard, Report, Action)
  - `skills/automation-design/` — Automation (Flow, Workflow, Trigger, Approval)
  - `skills/ai-agent-design/` — AI Agent protocol (Agent, Skill, RAG, Tool)
  - `skills/api-design/` — API protocol (REST endpoints, Discovery, Datasource)
  Each `SKILL.md` includes YAML frontmatter (`name`, `description`, `license`, `metadata`),
  domain rules, usage guidance, best practices, common pitfalls, and code examples.
  Zod schema files remain the single source of truth; skills reference them for validation.
- **Discovery Schema — `ServiceStatus` enum & `handlerReady` field** — Added `'registered'`
  status to `ServiceInfoSchema` to distinguish routes that are declared in the dispatcher
  table but whose HTTP handler has not been verified. Added optional `handlerReady` boolean
  field (omitted = unverified/unknown) so clients can filter handler-ready services before
  displaying endpoints when the value is explicitly `true`.
- **Discovery Schema — `RouteHealthReportSchema`** — New schema for automated route/handler
  coverage reporting at startup. Includes per-route health entries (`pass`, `fail`, `missing`,
  `skip`) and summary counters.
- **Dispatcher Schema — `DispatcherErrorCode` & `DispatcherErrorResponseSchema`** — Semantic
  error codes (`404`/`405`/`501`/`503`) with machine-readable `type` field
  (`ROUTE_NOT_FOUND`, `METHOD_NOT_ALLOWED`, `NOT_IMPLEMENTED`, `SERVICE_UNAVAILABLE`) and
  developer-facing `hint` strings.
- **Dispatcher Schema — `/health` route** — Added health endpoint to `DEFAULT_DISPATCHER_ROUTES`.
- **REST API Plugin — `handlerStatus` field** — Added `handlerStatus` (`implemented`, `stub`,
  `planned`) to `RestApiEndpointSchema` to track handler implementation readiness.
- **REST API Plugin — `RouteCoverageReportSchema`** — Schema for adapter-generated coverage
  reports listing every declared endpoint and its implementation status.
- `ai` v6 as a dependency of `@objectstack/spec` for type re-exports

### Removed
- **Removed `value` field from data API responses** — The `findData` protocol
  implementation no longer returns the deprecated `value` field alongside `records`.
  Only `records` is returned, matching the `FindDataResponseSchema` spec. All
  downstream consumers (Studio, app-host example, tests) updated to use `records`
  exclusively. OData-specific responses (`ODataResponseSchema`) retain `value` per
  the OData v4 standard — protocol-to-OData adaptation is handled in the HTTP
  dispatch layer.

### Changed
- **AI Chat Protocol Aligned with Vercel AI SDK** — Removed custom AI chat protocol
  types and Zod schemas (`AIMessage`, `AIToolCall`, `AIStreamEvent`,
  `AiChatRequestSchema`, `AiChatResponseSchema`) from `@objectstack/spec`. The
  canonical message, tool-call, and streaming types are now re-exported from the
  Vercel AI SDK (`ai` v6):
  - `ModelMessage` replaces `AIMessage`
  - `ToolCallPart` replaces `AIToolCall`
  - `ToolResultPart` replaces `AIToolResult`
  - `TextStreamPart<ToolSet>` replaces `AIStreamEvent`
  - `IAIService` and `LLMAdapter` method signatures now accept `ModelMessage[]`
    and return `TextStreamPart<ToolSet>` for streaming
  - Deprecated type aliases preserved for migration convenience
  - NLQ, Suggest, and Insights protocols (ObjectStack-specific) are retained
- **`@objectstack/service-ai` migrated to Vercel AI SDK types** — All source files
  and tests now use canonical Vercel types (`ModelMessage`, `ToolCallPart`,
  `ToolResultPart`, `TextStreamPart<ToolSet>`) instead of deprecated aliases:
  - `ToolRegistry.execute()` accepts `ToolCallPart` and returns `ToolExecutionResult`
    (extends `ToolResultPart` with `isError?: boolean`)
  - Tool call loop in `AIService.chatWithTools()` constructs proper
    `AssistantModelMessage` and `ToolModelMessage` with Vercel-format content arrays
  - `MemoryLLMAdapter.streamChat()` emits Vercel `TextStreamPart<ToolSet>` events
  - Conversation services serialize/deserialize `ModelMessage` union to flat DB columns
  - All 158 service-ai tests updated and passing

### Fixed
- **Runtime Dispatcher — semantic error differentiation** — `HttpDispatcher.dispatch()` now
  returns typed 404 (`ROUTE_NOT_FOUND`) with diagnostic info instead of bare `{ handled: false }`.
  Added `routeNotFound()` (404) helper method.
- **Runtime Dispatcher — `/health` handler** — Added health endpoint returning `status`,
  `timestamp`, `version`, and `uptime`.
- **Runtime Dispatcher — `handlerReady` in discovery** — `getDiscoveryInfo()` now emits
  `handlerReady: true` for services with confirmed handlers and `handlerReady: false` for
  unavailable services.
- **Dispatcher Plugin — semantic 404** — `sendResult()` now returns `ROUTE_NOT_FOUND` error
  type with a hint pointing to the discovery endpoint. Added `/health` handler registration.
- **Studio — handler-ready filtering** — `useApiDiscovery()` now checks both `enabled` and
  `handlerReady` (or `status === 'available' | 'degraded'` for backward compatibility) before
  displaying service endpoints in the UI.

### Removed
- `AiChatRequestSchema` / `AiChatResponseSchema` Zod schemas from
  `@objectstack/spec/api` — the AI chat wire protocol now uses Vercel AI SDK's
  data stream format (`toDataStreamResponse()`)
- `aiChat` method from `IObjectStackAPI` and client SDK — consumers should use
  `@ai-sdk/react/useChat` directly
- AI `/chat` endpoint from `DEFAULT_AI_ROUTES` plugin REST API definition

### Added
- `ai` v6 as a dependency of `@objectstack/spec` for type re-exports
- **Vercel AI Data Stream Protocol support on `/api/v1/ai/chat`** — The chat
  endpoint now supports dual-mode responses:
  - **Streaming (default)**: When `stream` is not `false`, returns Vercel Data
    Stream Protocol frames (`0:` text, `9:` tool-call, `d:` finish, etc.),
    directly consumable by `@ai-sdk/react/useChat`
  - **JSON (legacy)**: When `stream: false`, returns the original JSON response
  - Accepts Vercel useChat flat body format (`system`, `model`, `temperature`,
    `maxTokens` as top-level fields) alongside the legacy `{ messages, options }`
  - `systemPrompt` / `system` field is prepended as a system message
  - Message validation now accepts Vercel multi-part array content
  - `RouteResponse.vercelDataStream` flag signals HTTP server layer to encode
    events using the Vercel Data Stream frame format
- **`VercelLLMAdapter`** — Production adapter wrapping Vercel AI SDK's
  `generateText` / `streamText` for any compatible model provider (OpenAI,
  Anthropic, Google, Ollama, etc.)
- **`vercel-stream-encoder.ts`** — Utilities (`encodeStreamPart`,
  `encodeVercelDataStream`) to convert `TextStreamPart<ToolSet>` events into
  Vercel Data Stream wire-format frames
- 176 service-ai tests passing (18 new tests for stream encoder, route
  dual-mode, systemPrompt, flat options, array content)

## [4.0.1] — 2026-03-31

### Fixed
- **Version Alignment Patch** — Unified all package versions to `4.0.1`. Previously,
  `@objectstack/driver-sql` and `@objectstack/driver-turso` were at `3.3.2`, example
  packages were at `3.0.26`, and the root monorepo was at `3.0.8` while all other
  `@objectstack/*` packages were at `4.0.0`. All packages now share a single, consistent
  version number aligned with the changeset `fixed` group configuration.

### Added
- **`@objectstack/service-realtime` — `sys_presence` System Object** — Registers the
  `sys_presence` system object in the `service-realtime` package as the canonical Presence
  domain object. Fields align with the `PresenceStateSchema` protocol definition
  (`user_id`, `session_id`, `status`, `last_seen`, `current_location`, `device`,
  `custom_status`, `metadata`). `RealtimeServicePlugin` now auto-registers the object
  via the `app.com.objectstack.service.realtime` service convention. Added
  `SystemObjectName.PRESENCE` constant (`'sys_presence'`) to `@objectstack/spec/system`.
- **`@objectstack/service-ai` — Data Chatbot: Tool Call Loop & Agent Runtime** — Implements
  an Airtable Copilot-style data conversation Chatbot with full-stack support:
  - `AIService.chatWithTools()` — automatic multi-round LLM ↔ tool call loop with
    `maxIterations` safety limit, parallel tool execution, and forced final response
  - `AIResult.toolCalls` — new field on the AI result contract so adapters can return
    tool call requests from the LLM
  - `ChatWithToolsOptions` — new contract interface extending `AIRequestOptions`
  - 5 built-in data tools: `list_objects`, `describe_object`, `query_records`,
    `get_record`, `aggregate_data` — with parameter schemas, limit capping (max 200),
    and error handling
  - `registerDataTools(registry, context)` — factory to register all data tools
    against `IDataEngine` + `IMetadataService`
  - `AgentRuntime` — loads agent metadata, builds system prompts from instructions +
    UI context (`objectName`, `recordId`, `viewName`), resolves agent tool references
    against the `ToolRegistry`
  - `buildAgentRoutes()` — new `POST /api/v1/ai/agents/:agentName/chat` route with
    agent lookup, active-check, context injection, and `chatWithTools` integration
  - `DATA_CHAT_AGENT` — built-in `data_chat` agent spec with role, instructions,
    guardrails, planning config, and tool declarations
  - `AIServicePlugin` auto-registers data tools and `data_chat` agent when
    `IDataEngine` + `IMetadataService` are available in the kernel
  - 42 new test cases covering tool call loop, data tools, agent runtime, agent
    routes, and agent spec validation
- **`@objectstack/service-ai` — ObjectQL-backed persistent ConversationService** — New
  `ObjectQLConversationService` implements `IAIConversationService` using `IDataEngine`
  for durable conversation and message storage across service restarts:
  - `ai_conversations` and `ai_messages` system object definitions (namespace `ai`)
  - Full CRUD: `create`, `get`, `list` (with userId/agentId/limit/cursor filters),
    `addMessage` (with toolCalls/toolCallId support), and `delete` (cascade)
  - `AIServicePlugin` auto-detects `IDataEngine` in the kernel service registry and
    uses `ObjectQLConversationService` when available, falling back to
    `InMemoryConversationService` for dev/test environments
  - `AIServicePluginOptions.conversationService` allows explicit override
  - Plugin registers AI system objects via `app.com.objectstack.service-ai` service
  - 16 new test cases covering all five interface methods plus edge cases
- **Promoted `LLMAdapter` interface to `@objectstack/spec/contracts`** — Moved the `LLMAdapter`
  adapter contract from `@objectstack/service-ai` internal types to the canonical protocol layer
  (`packages/spec/src/contracts/llm-adapter.ts`). Third-party adapter implementations (OpenAI,
  Anthropic, Ollama, etc.) can now depend solely on `@objectstack/spec` for type alignment.
  `service-ai` re-exports the interface for backward compatibility.

### Fixed
- **Changeset fixed versioning — add driver-sql and driver-turso** — Added `@objectstack/driver-sql`
  and `@objectstack/driver-turso` to the changeset `fixed` versioning group in `.changeset/config.json`.
  These packages were missing from the group, causing them to be published as `3.3.2` instead of `4.0.0`
  during the v4.0.0 release. All future releases will now keep these driver packages in sync with the
  rest of the ecosystem.
- **ObjectQL build failure** — Fixed TypeScript TS2345 errors in `packages/objectql/src/protocol.ts`
  where `SchemaRegistry.registerItem()` calls failed type checking for the `keyField` parameter.
  Applied `'name' as any` cast consistent with the established codebase pattern.
- **ObjectQL `loadMetaFromDb`** — Fixed metadata hydration for `object` type records to use
  `SchemaRegistry.registerObject()` instead of `registerItem()`, resolving a mismatch where
  objects registered via `registerItem` could not be retrieved via `getItem('object', ...)`.
- **Adapter discovery endpoints** — Fixed discovery route in Hono, SvelteKit, Nuxt, Next.js,
  and Fastify adapters to serve discovery info at the API prefix root (e.g., `GET /api`)
  instead of a `/discovery` subpath. Updated `.well-known/objectstack` redirects accordingly.
- **Client feed namespace routing** — Fixed `ObjectStackClient.feed` methods to use the `data`
  route (`/api/v1/data/{object}/{recordId}/feed`) instead of a separate `/api/v1/feed` route,
  matching the actual server-side routing where feed is a sub-resource of data.

### Added
- **`@objectstack/service-ai` — Unified AI capability service plugin** — New kernel plugin
  providing standardized AI service integration:
  - Registers as kernel `'ai'` service conforming to `IAIService` contract
  - LLM adapter layer with provider abstraction (`LLMAdapter` interface) and built-in
    `MemoryLLMAdapter` for testing/development
  - `ToolRegistry` for metadata/business tool registration and execution
  - `InMemoryConversationService` implementing `IAIConversationService` for multi-turn
    conversation management with message persistence
  - REST/SSE route self-registration (`/api/v1/ai/chat`, `/api/v1/ai/chat/stream`,
    `/api/v1/ai/complete`, `/api/v1/ai/models`, `/api/v1/ai/conversations`)
  - Plugin lifecycle hooks (`ai:ready`, `ai:routes`) for extensibility
- **Expanded `IAIService` contract** — Added streaming (`streamChat`), tool calling protocol
  (`AIToolDefinition`, `AIToolCall`, `AIToolResult`, `AIMessageWithTools`,
  `AIRequestOptionsWithTools`, `AIStreamEvent`), and conversation management
  (`IAIConversationService`, `AIConversation`) to `packages/spec/src/contracts/ai-service.ts`
- **`@objectstack/plugin-setup` — Platform Setup App plugin** — New internal plugin
  (`packages/plugins/plugin-setup`) that owns and finalizes the platform Setup App.
  Ships four built-in Setup Areas (Administration, Platform, System, AI) as empty
  skeletons. Other plugins contribute navigation items via the `setupNav` service
  during their `init` phase. At `start`, SetupPlugin merges all contributions,
  filters out empty areas, and registers the finalized Setup App as an internal
  platform app. This establishes clear architectural separation: **spec** = protocol
  only, **objectql** = data/query only, **plugins** = system feature and UI composition.

### Documentation
- **Unified API query syntax documentation with Spec canonical format** — Rewrote
  `content/docs/protocol/objectql/query-syntax.mdx` and
  `content/docs/guides/contracts/data-engine.mdx` to align all examples, interface
  definitions, and field names with the canonical `QuerySchema`, `FilterConditionSchema`,
  and `EngineQueryOptionsSchema` from `@objectstack/spec`. All query examples now use
  `where` + MongoDB-style `$op` object syntax (replacing legacy tuple/`filters`/三元组
  format), `orderBy` (replacing `sort`), `groupBy` (replacing `group_by`), and
  `aggregations` array (replacing `aggregate` object map). `IDataEngine` contract
  documentation updated to reflect the real interface (`find`/`findOne`/`insert`/
  `update`/`delete`/`count`/`aggregate`). Added legacy compatibility sections clearly
  marking tuple/array syntax as UI-builder input only, with migration guidance.

### Changed
- **Studio Vercel deployment — switched from InMemoryDriver to TursoDriver** — The Studio serverless
  API entrypoint (`apps/studio/api/index.ts`) now uses `@objectstack/driver-turso` (TursoDriver)
  instead of `@objectstack/driver-memory` (InMemoryDriver) for Vercel deployments. In production,
  the driver connects to a Turso cloud database via `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`
  environment variables (remote mode). For local development without those variables, it falls back
  to `:memory:` (ephemeral SQLite). This ensures data persistence across serverless function
  invocations on Vercel. The browser MSW mock kernel remains unchanged (InMemoryDriver).

### Fixed
- **Metadata DB persistence — `saveMetaItem()` now writes to database** — The protocol
  implementation (`ObjectStackProtocolImplementation.saveMetaItem()`) now persists metadata
  to the `sys_metadata` table via `IDataEngine` in addition to the in-memory `SchemaRegistry`.
  Previously, metadata saved via `PUT /api/v1/meta/:type/:name` was lost on server restart.
  Added `loadMetaFromDb()` bootstrap method to hydrate the registry from the database on
  startup. `getMetaItem()` and `getMetaItems()` now fall back to database queries when items
  are not found in the in-memory registry. Discovery endpoint metadata status upgraded from
  `degraded` to `available`. Graceful degradation: if the database is unavailable, operations
  fall back to memory-only mode with a warning.
- **Vercel API always returns HTML — serverless function entrypoint not found** — The `bundle-api.mjs`
  script was emitting `api/index.js` at the project root, but `vercel.json` sets `outputDirectory: "dist"`,
  so Vercel could not discover the serverless function and fell back to the SPA HTML route for all
  `/api/*` requests. Changed esbuild `outfile` to `dist/api/index.js` and added explicit `functions`
  config in `vercel.json` with `@vercel/node@3` runtime.

### Added
- **Batch schema sync for remote DDL in kernel bootstrap** — `ObjectQLPlugin.syncRegisteredSchemas()`
  now groups objects by driver and uses `syncSchemasBatch()` when the driver advertises
  `supports.batchSchemaSync = true`. This reduces the number of remote DDL round-trips from
  roughly N×(2–3) individual calls (introspection + optional PRAGMA + DDL write per object)
  to a small constant number of batched `client.batch()` calls, cutting cold-start times from
  58+ seconds to under 10 seconds for 100+ objects on remote drivers (e.g. Turso cloud).
  Falls back to sequential `syncSchema()` per object for drivers without batch support or if the
  batched calls fail at runtime. Added `batchSchemaSync` capability flag to `DriverCapabilitiesSchema`,
  optional `syncSchemasBatch()` to `IDataDriver`, and `RemoteTransport.syncSchemasBatch()` using
  `@libsql/client`'s `batch()` API.
- **`@objectstack/driver-turso` — dual transport architecture** — TursoDriver now supports three
  transport modes: `local`, `replica`, and `remote`. Remote mode (`url: 'libsql://...'`) enables
  pure cloud-only queries via `@libsql/client` SDK (HTTP/WebSocket) without requiring a local
  SQLite database or Knex. Transport mode is auto-detected from the URL or can be forced via
  `config.mode`. The driver exposes `transportMode` and `isRemote` properties for runtime
  introspection. All IDataDriver methods (CRUD, bulk, transactions, schema sync) work identically
  across all modes. Added `RemoteTransport` class, `TursoTransportMode` type, and support for
  injecting a pre-configured `@libsql/client` instance via `config.client`.

### Fixed
- **Vercel deployment — `ERR_MODULE_NOT_FOUND` for `@objectstack/metadata`** — Fixed incorrect
  `exports` paths in `@objectstack/metadata` `package.json` that pointed directly to TypeScript
  source files (`src/index.ts`, `src/node.ts`) instead of compiled dist output. Node.js cannot
  import `.ts` files at runtime, causing `ERR_MODULE_NOT_FOUND` on Vercel. Updated `main`, `types`,
  and `exports` to reference dist files (`dist/index.js`, `dist/index.mjs`, `dist/node.mjs`, etc.).
  Added a local `tsup.config.ts` with both entry points (`src/index.ts`, `src/node.ts`) and a
  `files` field to the package.json. Follows the same pattern as `@objectstack/spec`.
- **Vercel deployment — `ERR_MODULE_NOT_FOUND` for `@objectstack/service-feed`** — Fixed incorrect
  `exports` paths in `package.json` for all service packages that declare `"type": "module"`. When
  `tsup` builds an ESM package (`"type": "module"`), it outputs `.js` for ESM and `.cjs` for CJS.
  However, the exports maps incorrectly referenced `.mjs` (ESM) and `.js` (CJS) — the convention
  for packages *without* `"type": "module"`. This caused Node's ESM resolver to fail with
  `ERR_MODULE_NOT_FOUND` when Vercel tried to import `dist/index.mjs` (which doesn't exist).
  Affected packages: `service-feed`, `service-automation`, `service-cache`, `service-realtime`,
  `service-job`, `service-queue`, `service-storage`, `service-analytics`.
- **`@objectstack/driver-sql` DTS build failure — knex type resolution** — Fixed a TypeScript
  declaration build failure caused by knex v3.2.3 declaring a non-existent `.d.mts` types file
  in its package.json `exports` field. With `moduleResolution: "bundler"`, TypeScript could not
  resolve knex's type declarations, resulting in TS7016 and TS7006 errors during DTS generation.
  Added a `paths` mapping in the driver-sql `tsconfig.json` to direct TypeScript to the correct
  `knex/types/index.d.ts` file. This also fixes cascade build failures in all downstream
  packages that depend on driver-sql.
- **`SqlDriver.syncSchema()` — physical table name mismatch** — Fixed the root cause of the
  `no such table: sys_user` error: `syncSchema()` was ignoring the `object` parameter (physical
  table name like `sys_user`) and using `schema.name` (FQN like `sys__user`) for DDL operations.
  The method now correctly passes the physical table name to `initObjects()`. Additionally,
  `initObjects()` now supports a `tableName` property as defense-in-depth, preferring it over
  `name` when both are present.
- **Login API error — database tables not created** — Fixed a critical naming mismatch between
  the FQN (Fully Qualified Name) used by SchemaRegistry (e.g., `sys__user` with double underscore)
  and the physical table name derived by `ObjectSchema.create()` (e.g., `sys_user` with single
  underscore). `syncRegisteredSchemas()` now uses the `tableName` property from object definitions
  for DDL operations, ensuring tables are created with the correct physical name that matches
  what the auth adapter and `SystemObjectName` constants expect.
- **`SchemaRegistry.getObject()` — protocol name resolution** — Added a third fallback that
  matches objects by their `tableName` property (e.g., `getObject('sys_user')` now correctly
  finds the object registered as FQN `sys__user`). This bridges protocol-layer names
  (`SystemObjectName.USER = 'sys_user'`) with the registry's FQN naming convention.
- **`ObjectQL.resolveObjectName()` — physical table name** — Now returns `schema.tableName`
  (the physical table/collection name) instead of `schema.name` (the FQN) when available,
  ensuring driver SQL queries target the correct table.
- **`SqlDriver.ensureDatabaseExists()` — multi-driver support** — Extended database
  auto-creation to support MySQL (error code `ER_BAD_DB_ERROR` / errno 1049) alongside
  PostgreSQL (error code `3D000`). SQLite is explicitly skipped (auto-creates files).
- **`SqlDriver.createDatabase()` — MySQL support** — Added MySQL-specific logic that
  connects without a database specified and uses `CREATE DATABASE IF NOT EXISTS`.

### Added
- **`@objectstack/driver-turso` plugin** — Migrated and standardized the Turso/libSQL driver from
  `@objectql/driver-turso` into `packages/plugins/driver-turso/`. The driver **extends** `SqlDriver`
  from `@objectstack/driver-sql` — all CRUD, schema, filter, aggregation, and introspection logic
  is inherited with zero code duplication. Turso-specific features include: three connection modes
  (local file, in-memory, embedded replica), `@libsql/client` sync mechanism for embedded replicas,
  multi-tenant router with TTL-based driver caching, and enhanced capability flags (FTS5, JSON1,
  CTE, savepoints, indexes). Includes 53 unit tests. Factory function `createTursoDriver()` and
  plugin manifest for kernel integration.
- **Multi-tenant routing** (`createMultiTenantRouter`) — Database-per-tenant architecture with
  automatic driver lifecycle management, tenant ID validation, configurable TTL cache, and
  `onTenantCreate`/`onTenantEvict` lifecycle callbacks. Serverless-safe (no global intervals).

### Changed
- **`@objectstack/driver-sql` — Protected extensibility** — Changed `private` to `protected` for
  all internal properties and methods (`knex`, `config`, `jsonFields`, `booleanFields`,
  `tablesWithTimestamps`, `isSqlite`, `isPostgres`, `isMysql`, `getBuilder`, `applyFilters`,
  `applyFilterCondition`, `mapSortField`, `mapAggregateFunc`, `buildWindowFunction`,
  `createColumn`, `ensureDatabaseExists`, `createDatabase`, `isJsonField`, `formatInput`,
  `formatOutput`, `introspectColumns`, `introspectForeignKeys`, `introspectPrimaryKeys`,
  `introspectUniqueConstraints`). Enables clean subclassing for driver variants (Turso, D1, etc.)
  without code duplication.

### Fixed
- **`@objectstack/driver-sql` — `count()` returns NaN for zero results** — Fixed `count()` method
  using `||` (logical OR) instead of `??` (nullish coalescing) to read the count value. When the
  actual count was `0`, `row.count || row['count(*)']` evaluated to `Number(undefined)` = `NaN`
  because `0` is falsy. Now uses `row.count ?? row['count(*)'] ?? 0` for correct zero handling.

### Changed
- **Unified Data Driver Contract (`IDataDriver`)** — Resolved the split between `DriverInterface`
  (core, minimal ~13 methods) and `IDataDriver` (spec, comprehensive 28 methods). `IDataDriver`
  from `@objectstack/spec/contracts` is now the **single authoritative** contract for all database
  driver implementations. `DriverInterface` is retained as a deprecated type alias for backward
  compatibility. Both `@objectstack/driver-sql` and `@objectstack/driver-memory` now implement
  `IDataDriver` directly with full `DriverCapabilities` support.
- **`@objectstack/driver-sql`** — Added missing `IDataDriver` methods: `findStream`, `upsert`,
  `bulkUpdate`, `bulkDelete`, `commit`, `rollback`, `dropTable`, `explain`. Aligned `supports`
  with full `DriverCapabilities` schema. `updateMany`/`deleteMany` now return `number` (count)
  instead of `{ modifiedCount }` / `{ deletedCount }` objects. `delete` returns `boolean`.
- **`@objectstack/driver-memory`** — Aligned `supports` property with full `DriverCapabilities`
  schema (added `create`, `read`, `update`, `delete`, `bulkCreate`, `bulkUpdate`, `bulkDelete`,
  `savepoints`, `queryCTE`, `jsonQuery`, `geospatialQuery`, `streaming`, `schemaSync`, etc.).

### Removed
- **`@objectstack/driver-sql` — Legacy query key fallbacks** — Removed support for deprecated
  query keys `filters` (use `where`), `sort` (use `orderBy`), `skip` (use `offset`), and `top`
  (use `limit`) from `find`, `updateMany`, `deleteMany`, and `count` methods. The SQL driver now
  strictly follows the `IDataDriver` / `QueryAST` protocol. All `as any` casts for legacy key
  access have been eliminated. Tests updated to use only standard `QueryAST` keys.

### Deprecated
- **`DriverInterface`** — Use `IDataDriver` from `@objectstack/spec/contracts` instead.
  `DriverInterface` remains as a type alias in both `@objectstack/spec/contracts` and
  `@objectstack/core` for backward compatibility.

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
