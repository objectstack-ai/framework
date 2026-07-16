// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

// REST Server
export { RestServer } from './rest-server.js';
// The protocol slice the REST layer consumes (ADR-0076 D9 / #2462 A1.5)
export type { RestProtocol } from './rest-server.js';

// Route Management
export { RouteManager, RouteGroupBuilder } from './route-manager.js';
export type { RouteEntry } from './route-manager.js';

// REST API Plugin
export { createRestApiPlugin } from './rest-api-plugin.js';
export type { RestApiPluginConfig } from './rest-api-plugin.js';

// Bulk-import building blocks (#2766 V2) — shared with the identity import
// endpoint in plugin-auth so it accepts payloads byte-identical to the
// generic /data/:object/import routes and reuses the same row engine.
export {
    prepareImportRequest,
    parseCsvToRows,
    parseXlsxToRows,
    isMetaEnvelope,
} from './import-prepare.js';
export type { PreparedImport, PrepareImportResult } from './import-prepare.js';
export { runImport } from './import-runner.js';
export type {
    ImportAction,
    ImportRowResult,
    ImportProgress,
    ImportRunSummary,
    ImportUndoLog,
    ImportProtocolLike,
    RunImportOptions,
} from './import-runner.js';
export { coerceRow } from './import-coerce.js';
export type { CoerceContext, RefResolver } from './import-coerce.js';
export { buildFieldMetaMap } from './export-format.js';
export type { ExportFieldMeta } from './export-format.js';
