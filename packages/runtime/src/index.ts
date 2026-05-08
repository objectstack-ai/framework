// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

// Export Kernels
export { ObjectKernel } from '@objectstack/core';

// Export Runtime
export { Runtime } from './runtime.js';
export type { RuntimeConfig } from './runtime.js';

// Export Standalone Stack
export { createStandaloneStack } from './standalone-stack.js';
export type { StandaloneStackConfig, StandaloneStackResult } from './standalone-stack.js';

// Export Plugins
export { DriverPlugin } from './driver-plugin.js';
export { AppPlugin, collectBundleHooks, collectBundleFunctions, collectBundleActions } from './app-plugin.js';
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

// Export Artifact Loader
export { loadArtifactBundle, mergeRuntimeModule, isHttpUrl, readArtifactSource } from './load-artifact-bundle.js';
export type { LoadArtifactBundleOptions } from './load-artifact-bundle.js';

// Export Sandbox (script body runner) — engine choice is quickjs-emscripten.
// See packages/runtime/src/sandbox/script-runner.ts for the decision rationale.
export { UnimplementedScriptRunner, QuickJSScriptRunner, SandboxError, hookBodyRunnerFactory, actionBodyRunnerFactory } from './sandbox/index.js';
export type {
  ScriptRunner,
  ScriptContext,
  ScriptOrigin,
  ScriptResult,
  ScriptRunOptions,
  QuickJSScriptRunnerOptions,
} from './sandbox/index.js';

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



