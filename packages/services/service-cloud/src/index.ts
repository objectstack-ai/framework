// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

// ── Main entry point ──────────────────────────────────────────────────────────
export { createCloudStack } from './cloud-stack.js';
export type { CloudStackConfig } from './cloud-stack.js';

// ── Multi-project orchestration ───────────────────────────────────────────────
export { MultiProjectPlugin } from './multi-project-plugin.js';
export type {
    MultiProjectPluginConfig,
    ProjectTemplate,
    TemplateSeeder,
} from './multi-project-plugin.js';

export { KernelManager } from './kernel-manager.js';
export type {
    ProjectKernelFactory,
    KernelManagerConfig,
} from './kernel-manager.js';

export { DefaultProjectKernelFactory } from './project-kernel-factory.js';
export type {
    DefaultProjectKernelFactoryConfig,
    BasePluginsFactory,
    AppBundleResolver,
    SysProjectRow,
    SysProjectCredentialRow,
    LocalProjectConfig,
} from './project-kernel-factory.js';

// ── Environment registry ──────────────────────────────────────────────────────
export {
    DefaultEnvironmentDriverRegistry,
    createEnvironmentDriverRegistry,
    NoopSecretEncryptor,
} from './environment-registry.js';
export type {
    EnvironmentDriverRegistry,
    SecretEncryptor,
} from './environment-registry.js';

// ── Proxy driver ──────────────────────────────────────────────────────────────
export { ControlPlaneProxyDriver } from './control-plane-proxy-driver.js';

// ── Shared-kernel mode (ADR-0003 v2) ─────────────────────────────────────────
export { SharedProjectPlugin } from './shared-project-plugin.js';
export type { SharedProjectPluginConfig } from './shared-project-plugin.js';
export { ProjectScopeManager } from './project-scope-manager.js';
export type { ProjectScopeManagerConfig } from './project-scope-manager.js';

// ── Control-plane preset ──────────────────────────────────────────────────────
export { createControlPlanePlugins } from './control-plane-preset.js';
export type { ControlPlanePresetConfig } from './control-plane-preset.js';

// ── Studio auxiliary routes ───────────────────────────────────────────────────
export {
    createStudioRuntimeConfigPlugin,
    createTemplatesRoutePlugin,
} from './multi-project-plugins.js';
