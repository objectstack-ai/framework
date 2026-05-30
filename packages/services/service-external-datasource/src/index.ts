// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

// Core service
export { ExternalDatasourceService } from './external-datasource-service.js';
export type {
  ExternalDatasourceServiceConfig,
  DatasourceLike,
  ObjectLike,
  Logger,
} from './external-datasource-service.js';

// NOTE: the runtime datasource *lifecycle* (DatasourceAdminService /
// DatasourceAdminServicePlugin, ADR-0015 Addendum) was extracted into the
// private `@objectstack/datasource-admin` package. This package keeps only
// *federation* (introspect / draft / import / validate) — ADR-0015 main body.

// Kernel plugin
export { ExternalDatasourceServicePlugin } from './plugin.js';
export type { ExternalDatasourceServicePluginOptions } from './plugin.js';
