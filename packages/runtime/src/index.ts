// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

// Export Kernels
export { ObjectKernel } from '@objectstack/core';

// Export Runtime
export { Runtime } from './runtime.js';
export type { RuntimeConfig } from './runtime.js';

// Export Plugins
export { DriverPlugin } from './driver-plugin.js';
export { AppPlugin } from './app-plugin.js';
export { SeedLoaderService } from './seed-loader.js';
export { createDispatcherPlugin } from './dispatcher-plugin.js';
export type { DispatcherPluginConfig } from './dispatcher-plugin.js';
export { createSystemProjectPlugin, SYSTEM_PROJECT_ID } from './system-project-plugin.js';
export type { SystemProjectPluginConfig } from './system-project-plugin.js';

// Export HTTP Server Components
export { HttpServer } from './http-server.js';
export { HttpDispatcher } from './http-dispatcher.js';
export type { HttpProtocolContext, HttpDispatcherResult } from './http-dispatcher.js';
export { MiddlewareManager } from './middleware.js';

// Export Environment Registry
export {
    DefaultEnvironmentDriverRegistry,
    createEnvironmentDriverRegistry,
    NoopSecretEncryptor,
} from './environment-registry.js';
export type {
    EnvironmentDriverRegistry,
    SecretEncryptor,
} from './environment-registry.js';

// Re-export from @objectstack/rest
export {
    RestServer,
    RouteManager,
    RouteGroupBuilder,
    createRestApiPlugin,
} from '@objectstack/rest';
export type {
    RouteEntry,
    RestApiPluginConfig,
} from '@objectstack/rest';

// Export Types
export * from '@objectstack/core';



