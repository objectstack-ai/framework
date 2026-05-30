// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

// Core service
export { ExternalDatasourceService } from './external-datasource-service.js';
export type {
  ExternalDatasourceServiceConfig,
  DatasourceLike,
  ObjectLike,
  Logger,
} from './external-datasource-service.js';

// Datasource lifecycle service (ADR-0015 Addendum)
export { DatasourceAdminService } from './datasource-admin-service.js';
export type {
  DatasourceAdminServiceConfig,
  StoredDatasource,
  ProbeInput,
} from './datasource-admin-service.js';

// Datasource lifecycle kernel plugin
export { DatasourceAdminServicePlugin } from './datasource-admin-plugin.js';
export type {
  DatasourceAdminServicePluginOptions,
  SecretBinder,
} from './datasource-admin-plugin.js';

// Kernel plugin
export { ExternalDatasourceServicePlugin } from './plugin.js';
export type { ExternalDatasourceServicePluginOptions } from './plugin.js';
