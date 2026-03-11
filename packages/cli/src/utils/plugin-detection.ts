// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Detect whether a loaded config is a host/aggregator configuration.
 *
 * A host config already contains a `plugins` array with instantiated Plugin
 * objects (i.e. objects that have an `init` method). Such configs must NOT
 * be wrapped again by AppPlugin in the CLI, as that would cause duplicate
 * plugin registration and startup failures.
 */
export function isHostConfig(config: any): boolean {
  return (
    Array.isArray(config.plugins) &&
    config.plugins.some((p: any) => typeof p?.init === 'function')
  );
}
