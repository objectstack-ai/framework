// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

// Core service
export { AnalyticsService } from './analytics-service.js';
export type { AnalyticsServiceConfig } from './analytics-service.js';

// Kernel plugin
export { AnalyticsServicePlugin } from './plugin.js';
export type { AnalyticsServicePluginOptions } from './plugin.js';

// Cube registry
export { CubeRegistry } from './cube-registry.js';

// Strategies
export { NativeSQLStrategy } from './strategies/native-sql-strategy.js';
export { ObjectQLStrategy } from './strategies/objectql-strategy.js';
export { InMemoryStrategy } from './strategies/in-memory-strategy.js';
export type { AnalyticsStrategy, StrategyContext, DriverCapabilities } from './strategies/types.js';
