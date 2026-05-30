// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

// Core service
export { ExternalDatasourceService } from './external-datasource-service.js';
export type {
  ExternalDatasourceServiceConfig,
  DatasourceLike,
  ObjectLike,
  Logger,
} from './external-datasource-service.js';

// Kernel plugin
export { ExternalDatasourceServicePlugin } from './plugin.js';
export type { ExternalDatasourceServicePluginOptions } from './plugin.js';
