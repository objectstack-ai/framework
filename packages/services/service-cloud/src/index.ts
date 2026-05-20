// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

// ── Main entry point ──────────────────────────────────────────────────────────
export { createCloudStack } from './cloud-stack.js';
export type { CloudStackConfig } from './cloud-stack.js';
export {
  mountDefaultProjectPlugins,
} from './default-project-plugins.js';
export type {
  MountDefaultProjectPluginsOptions,
  DefaultProjectCap,
} from './default-project-plugins.js';

// ── Data-directory resolution ─────────────────────────────────────────────────
export { resolveDefaultDataDir, isServerlessReadOnlyFs } from './data-dir.js';

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

// ── Cloud Artifact API (M3) ───────────────────────────────────────────────────
export { createCloudArtifactApiPlugin } from './cloud-artifact-api-plugin.js';

// ── Boot-mode orchestration ───────────────────────────────────────────────────
export {
    resolveMode,
    resolveAuthSecret,
    resolveBaseUrl,
    BootEnvSchema,
} from './boot-env.js';
export type { BootMode, BootEnv } from './boot-env.js';

export { createRuntimeStack, RuntimeStackConfigSchema, DEFAULT_CLOUD_URL } from './runtime-stack.js';
export type { RuntimeStackConfig, RuntimeStackResult } from './runtime-stack.js';

/** @deprecated Use `createRuntimeStack`. */
export { createProjectStack, ProjectStackConfigSchema } from './runtime-stack.js';
/** @deprecated Use `RuntimeStackConfig`/`RuntimeStackResult`. */
export type { ProjectStackConfig, ProjectStackResult } from './runtime-stack.js';


export { createBootStack, BootStackConfigSchema } from './boot-stack.js';
export type { BootStackConfig, BootStackResult } from './boot-stack.js';

// ── Local identity seeding ────────────────────────────────────────────────────
export {
    ensureLocalIdentity,
    LOCAL_ORG_ID,
    LOCAL_PROJECT_ID,
} from './local-identity.js';
export type { LocalIdentityOptions } from './local-identity.js';

// ── Single-project plugin ─────────────────────────────────────────────────────
export {
    createSingleProjectPlugin,
    DEFAULT_LOCAL_ORG_ID,
    DEFAULT_LOCAL_PROJECT_ID,
} from './single-project-plugin.js';
export type { SingleProjectPluginOptions } from './single-project-plugin.js';

// ── Filesystem app bundle resolver ────────────────────────────────────────────
export { createFsAppBundleResolver } from './fs-bundle-resolver.js';

// ── ObjectOS Cloud Runtime (artifact API mode) ────────────────────────────────
export { ArtifactApiClient } from './artifact-api-client.js';
export type {
    ArtifactApiClientConfig,
    ProjectArtifactResponse,
    ProjectRuntimeConfig,
    ResolvedHostname,
} from './artifact-api-client.js';

export { ArtifactEnvironmentRegistry } from './artifact-environment-registry.js';
export type { ArtifactEnvironmentRegistryConfig } from './artifact-environment-registry.js';

export { ArtifactKernelFactory } from './artifact-kernel-factory.js';
export type { ArtifactKernelFactoryConfig } from './artifact-kernel-factory.js';

export { createObjectOSStack } from './objectos-stack.js';
export type { ObjectOSStackConfig, ObjectOSStackResult } from './objectos-stack.js';

// ── Preview-mode stack (sandbox previews of pinned commits / branches) ───────
export { createPreviewStack } from './preview/preview-stack.js';
export type { PreviewStackConfig, PreviewStackResult } from './preview/preview-stack.js';
export { parsePreviewHost, projectIdToShort } from './preview/host-parser.js';
export type { PreviewHost, PreviewParseConfig } from './preview/host-parser.js';
export { PreviewEnvironmentRegistry } from './preview/environment-registry.js';
export type { PreviewEnvironmentRegistryConfig } from './preview/environment-registry.js';
export { PreviewKernelFactory } from './preview/kernel-factory.js';
export type { PreviewKernelFactoryConfig } from './preview/kernel-factory.js';
