// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { createMemoryCache } from './memory-cache.js';
import { createMemoryQueue } from './memory-queue.js';
import { createMemoryJob } from './memory-job.js';
import { createMemoryI18n } from './memory-i18n.js';

export { createMemoryCache } from './memory-cache.js';
export { createMemoryQueue } from './memory-queue.js';
export { createMemoryJob } from './memory-job.js';
export { createMemoryI18n, resolveLocale } from './memory-i18n.js';

/**
 * Map of core-criticality service names to their in-memory fallback factories.
 * Used by ObjectKernel.validateSystemRequirements() to auto-inject fallbacks
 * when no real plugin provides the service.
 */
export const CORE_FALLBACK_FACTORIES: Record<string, () => Record<string, any>> = {
  cache: createMemoryCache,
  queue: createMemoryQueue,
  job:   createMemoryJob,
  i18n:  createMemoryI18n,
};
