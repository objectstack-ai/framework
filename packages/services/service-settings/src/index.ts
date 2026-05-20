// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Public entrypoint for `@objectstack/service-settings`.
 * See ADR-0007 and `README.md`.
 */

export { SettingsService } from './settings-service.js';
export {
  type CryptoAdapter,
  NoopCryptoAdapter,
} from './crypto-adapter.js';
export {
  type SettingsActionHandler,
  type SettingsAuditSink,
  type SettingsContext,
  type SettingsEngine,
  type SettingsRow,
  type SettingsServiceOptions,
  envKeyOf,
  SettingsLockedError,
  UnknownKeyError,
  UnknownNamespaceError,
} from './settings-service.types.js';
export {
  SettingsServicePlugin,
  type SettingsServicePluginOptions,
} from './settings-service-plugin.js';
export {
  registerSettingsRoutes,
  type SettingsRoutesOptions,
} from './settings-routes.js';
export {
  settingsObjects,
  settingsPluginManifestHeader,
  SETTINGS_PLUGIN_ID,
  SETTINGS_PLUGIN_VERSION,
} from './manifest.js';

// Re-export the spec types for convenience so plugin authors only need
// one import.
export type {
  SettingsManifest,
  ResolvedSettingValue,
  SettingsNamespacePayload,
  SettingsActionResult,
  SpecifierScope,
} from '@objectstack/spec/system';
