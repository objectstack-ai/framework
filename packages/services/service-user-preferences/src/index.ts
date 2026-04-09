// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * @objectstack/service-user-preferences
 *
 * User Preferences Service for ObjectStack.
 *
 * Provides unified user preferences and favorites management with:
 * - Scalar preferences (theme, locale, etc.)
 * - Structured data (favorites, recent items)
 * - HTTP REST API
 * - ObjectQL-based persistence
 *
 * @example
 * ```ts
 * import { UserPreferencesServicePlugin } from '@objectstack/service-user-preferences';
 * import { ObjectKernel } from '@objectstack/core';
 *
 * const kernel = new ObjectKernel();
 * kernel.use(new UserPreferencesServicePlugin());
 * await kernel.bootstrap();
 *
 * const prefs = kernel.getService<IUserPreferencesService>('user-preferences');
 * await prefs.set('user123', 'theme', 'dark');
 * ```
 */

export * from './plugin';
export * from './adapters';
export * from './objects';
export * from './routes';
