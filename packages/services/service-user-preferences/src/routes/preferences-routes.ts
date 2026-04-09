// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { IUserPreferencesService, IUserFavoritesService, Logger } from '@objectstack/spec/contracts';

/**
 * Minimal HTTP handler abstraction so routes stay framework-agnostic.
 *
 * Consumers wire these handlers to their HTTP server of choice
 * (Hono, Express, Fastify, etc.) via the kernel's HTTP server service.
 */
export interface RouteDefinition {
  /** HTTP method */
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  /** Path pattern (e.g. '/api/v1/user/preferences') */
  path: string;
  /** Human-readable description */
  description: string;
  /** Whether this route requires authentication (default: true). */
  auth?: boolean;
  /** Required permissions for accessing this route. */
  permissions?: string[];
  /**
   * Handler receives a plain request-like object and returns a response-like object.
   */
  handler: (req: RouteRequest) => Promise<RouteResponse>;
}

/**
 * Authenticated user context attached to a route request.
 */
export interface RouteUserContext {
  /** Unique user identifier. */
  userId: string;
  /** User display name (optional). */
  displayName?: string;
  /** Roles assigned to the user (e.g. `['admin', 'user']`). */
  roles?: string[];
  /** Fine-grained permissions (e.g. `['preferences:read', 'preferences:write']`). */
  permissions?: string[];
}

export interface RouteRequest {
  /** Parsed JSON body (for POST/PUT requests) */
  body?: unknown;
  /** Route/query parameters */
  params?: Record<string, string>;
  /** Query string parameters */
  query?: Record<string, string>;
  /** Authenticated user context (populated by auth middleware). */
  user?: RouteUserContext;
}

export interface RouteResponse {
  /** HTTP status code */
  status: number;
  /** JSON-serializable body */
  body?: unknown;
}

/**
 * Build HTTP routes for the User Preferences Service.
 *
 * Routes:
 * - GET    /api/v1/user/preferences         - Get all preferences (optionally filtered by prefix)
 * - GET    /api/v1/user/preferences/:key    - Get a single preference by key
 * - POST   /api/v1/user/preferences         - Set multiple preferences (batch)
 * - PUT    /api/v1/user/preferences/:key    - Set a single preference
 * - DELETE /api/v1/user/preferences/:key    - Delete a preference
 * - GET    /api/v1/user/favorites           - List all favorites
 * - POST   /api/v1/user/favorites           - Add a favorite
 * - DELETE /api/v1/user/favorites/:id       - Remove a favorite
 * - POST   /api/v1/user/favorites/toggle    - Toggle a favorite
 *
 * @param preferencesService - User preferences service instance
 * @param favoritesService - User favorites service instance
 * @param logger - Logger instance
 * @returns Array of route definitions
 */
export function buildUserPreferencesRoutes(
  preferencesService: IUserPreferencesService,
  favoritesService: IUserFavoritesService,
  logger: Logger
): RouteDefinition[] {
  return [
    // ── Preferences Routes ──────────────────────────────────────────

    {
      method: 'GET',
      path: '/api/v1/user/preferences',
      description: 'Get all user preferences (optionally filtered by prefix)',
      auth: true,
      permissions: ['preferences:read'],
      handler: async (req) => {
        const userId = req.user?.userId;
        if (!userId) {
          return { status: 401, body: { error: 'Unauthorized' } };
        }

        const prefix = req.query?.prefix;
        const preferences = await preferencesService.getAll(userId, { prefix });

        return { status: 200, body: { preferences } };
      },
    },

    {
      method: 'GET',
      path: '/api/v1/user/preferences/:key',
      description: 'Get a single preference by key',
      auth: true,
      permissions: ['preferences:read'],
      handler: async (req) => {
        const userId = req.user?.userId;
        if (!userId) {
          return { status: 401, body: { error: 'Unauthorized' } };
        }

        const key = req.params?.key;
        if (!key) {
          return { status: 400, body: { error: 'Missing preference key' } };
        }

        const value = await preferencesService.get(userId, key);

        if (value === undefined) {
          return { status: 404, body: { error: 'Preference not found' } };
        }

        return { status: 200, body: { key, value } };
      },
    },

    {
      method: 'POST',
      path: '/api/v1/user/preferences',
      description: 'Set multiple preferences (batch)',
      auth: true,
      permissions: ['preferences:write'],
      handler: async (req) => {
        const userId = req.user?.userId;
        if (!userId) {
          return { status: 401, body: { error: 'Unauthorized' } };
        }

        const body = req.body as Record<string, unknown> | undefined;
        if (!body || typeof body !== 'object') {
          return { status: 400, body: { error: 'Invalid request body' } };
        }

        const preferences = body.preferences as Record<string, unknown> | undefined;
        if (!preferences || typeof preferences !== 'object') {
          return { status: 400, body: { error: 'Missing preferences field' } };
        }

        await preferencesService.setMany(userId, preferences);

        logger.info(`[UserPreferences] Batch set ${Object.keys(preferences).length} preferences for user ${userId}`);

        return { status: 200, body: { success: true } };
      },
    },

    {
      method: 'PUT',
      path: '/api/v1/user/preferences/:key',
      description: 'Set a single preference',
      auth: true,
      permissions: ['preferences:write'],
      handler: async (req) => {
        const userId = req.user?.userId;
        if (!userId) {
          return { status: 401, body: { error: 'Unauthorized' } };
        }

        const key = req.params?.key;
        if (!key) {
          return { status: 400, body: { error: 'Missing preference key' } };
        }

        const body = req.body as { value?: unknown } | undefined;
        if (!body || !('value' in body)) {
          return { status: 400, body: { error: 'Missing value field' } };
        }

        await preferencesService.set(userId, key, body.value);

        logger.debug(`[UserPreferences] Set preference ${key} for user ${userId}`);

        return { status: 200, body: { success: true } };
      },
    },

    {
      method: 'DELETE',
      path: '/api/v1/user/preferences/:key',
      description: 'Delete a preference',
      auth: true,
      permissions: ['preferences:write'],
      handler: async (req) => {
        const userId = req.user?.userId;
        if (!userId) {
          return { status: 401, body: { error: 'Unauthorized' } };
        }

        const key = req.params?.key;
        if (!key) {
          return { status: 400, body: { error: 'Missing preference key' } };
        }

        const deleted = await preferencesService.delete(userId, key);

        if (!deleted) {
          return { status: 404, body: { error: 'Preference not found' } };
        }

        logger.debug(`[UserPreferences] Deleted preference ${key} for user ${userId}`);

        return { status: 200, body: { success: true } };
      },
    },

    // ── Favorites Routes ────────────────────────────────────────────

    {
      method: 'GET',
      path: '/api/v1/user/favorites',
      description: 'List all favorites for the current user',
      auth: true,
      permissions: ['preferences:read'],
      handler: async (req) => {
        const userId = req.user?.userId;
        if (!userId) {
          return { status: 401, body: { error: 'Unauthorized' } };
        }

        const favorites = await favoritesService.list(userId);

        return { status: 200, body: { favorites } };
      },
    },

    {
      method: 'POST',
      path: '/api/v1/user/favorites',
      description: 'Add a new favorite',
      auth: true,
      permissions: ['preferences:write'],
      handler: async (req) => {
        const userId = req.user?.userId;
        if (!userId) {
          return { status: 401, body: { error: 'Unauthorized' } };
        }

        const body = req.body as Record<string, unknown> | undefined;
        if (!body || typeof body !== 'object') {
          return { status: 400, body: { error: 'Invalid request body' } };
        }

        const { type, target, label, icon, metadata } = body;

        if (!type || typeof type !== 'string') {
          return { status: 400, body: { error: 'Missing or invalid type field' } };
        }

        if (!target || typeof target !== 'string') {
          return { status: 400, body: { error: 'Missing or invalid target field' } };
        }

        const favorite = await favoritesService.add(userId, {
          type: type as 'object' | 'view' | 'app' | 'dashboard' | 'report' | 'record',
          target,
          label: typeof label === 'string' ? label : undefined,
          icon: typeof icon === 'string' ? icon : undefined,
          metadata: typeof metadata === 'object' ? metadata as Record<string, unknown> : undefined,
        });

        logger.info(`[UserPreferences] Added favorite ${type}:${target} for user ${userId}`);

        return { status: 201, body: { favorite } };
      },
    },

    {
      method: 'DELETE',
      path: '/api/v1/user/favorites/:id',
      description: 'Remove a favorite by ID',
      auth: true,
      permissions: ['preferences:write'],
      handler: async (req) => {
        const userId = req.user?.userId;
        if (!userId) {
          return { status: 401, body: { error: 'Unauthorized' } };
        }

        const id = req.params?.id;
        if (!id) {
          return { status: 400, body: { error: 'Missing favorite ID' } };
        }

        const removed = await favoritesService.remove(userId, id);

        if (!removed) {
          return { status: 404, body: { error: 'Favorite not found' } };
        }

        logger.info(`[UserPreferences] Removed favorite ${id} for user ${userId}`);

        return { status: 200, body: { success: true } };
      },
    },

    {
      method: 'POST',
      path: '/api/v1/user/favorites/toggle',
      description: 'Toggle a favorite (add if not exists, remove if exists)',
      auth: true,
      permissions: ['preferences:write'],
      handler: async (req) => {
        const userId = req.user?.userId;
        if (!userId) {
          return { status: 401, body: { error: 'Unauthorized' } };
        }

        const body = req.body as Record<string, unknown> | undefined;
        if (!body || typeof body !== 'object') {
          return { status: 400, body: { error: 'Invalid request body' } };
        }

        const { type, target, label, icon, metadata } = body;

        if (!type || typeof type !== 'string') {
          return { status: 400, body: { error: 'Missing or invalid type field' } };
        }

        if (!target || typeof target !== 'string') {
          return { status: 400, body: { error: 'Missing or invalid target field' } };
        }

        const added = await favoritesService.toggle(userId, {
          type: type as 'object' | 'view' | 'app' | 'dashboard' | 'report' | 'record',
          target,
          label: typeof label === 'string' ? label : undefined,
          icon: typeof icon === 'string' ? icon : undefined,
          metadata: typeof metadata === 'object' ? metadata as Record<string, unknown> : undefined,
        });

        logger.info(`[UserPreferences] Toggled favorite ${type}:${target} for user ${userId} (${added ? 'added' : 'removed'})`);

        return { status: 200, body: { added } };
      },
    },
  ];
}
