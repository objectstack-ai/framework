// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Metadata History API Routes
 *
 * REST API endpoints for metadata version history, rollback, and diff operations.
 * These routes extend the standard metadata API with history-specific functionality.
 *
 * Routes:
 * - GET /api/v1/metadata/:type/:name/history - Get version history
 * - POST /api/v1/metadata/:type/:name/rollback - Rollback to a specific version
 * - GET /api/v1/metadata/:type/:name/diff - Compare two versions
 */

import type { IMetadataService } from '@objectstack/spec/contracts';

/**
 * Register metadata history routes on a Hono app or any HTTP server.
 *
 * @param app - The HTTP server/router instance (Hono-compatible)
 * @param metadataService - The metadata service instance
 */
export function registerMetadataHistoryRoutes(
  app: any, // Hono app or compatible
  metadataService: IMetadataService
): void {
  /**
   * GET /api/v1/metadata/:type/:name/history
   * Get version history for a metadata item
   *
   * Query parameters:
   * - limit: number (default: 50)
   * - offset: number (default: 0)
   * - since: ISO datetime string
   * - until: ISO datetime string
   * - operationType: create | update | publish | revert | delete
   * - includeMetadata: boolean (default: true)
   */
  app.get('/api/v1/metadata/:type/:name/history', async (c: any) => {
    if (!metadataService.getHistory) {
      return c.json({ error: 'History tracking not enabled' }, 501);
    }

    const { type, name } = c.req.param();
    const query = c.req.query();

    try {
      const options: any = {};

      if (query.limit) options.limit = parseInt(query.limit, 10);
      if (query.offset) options.offset = parseInt(query.offset, 10);
      if (query.since) options.since = query.since;
      if (query.until) options.until = query.until;
      if (query.operationType) options.operationType = query.operationType;
      if (query.includeMetadata !== undefined) {
        options.includeMetadata = query.includeMetadata === 'true';
      }

      const result = await metadataService.getHistory(type, name, options);

      return c.json({
        success: true,
        data: result,
      });
    } catch (error) {
      return c.json(
        {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to retrieve history',
        },
        500
      );
    }
  });

  /**
   * POST /api/v1/metadata/:type/:name/rollback
   * Rollback a metadata item to a specific version
   *
   * Body:
   * - version: number (required) - Target version to rollback to
   * - changeNote: string (optional) - Description of rollback
   * - recordedBy: string (optional) - User performing rollback
   */
  app.post('/api/v1/metadata/:type/:name/rollback', async (c: any) => {
    if (!metadataService.rollback) {
      return c.json({ error: 'Rollback not supported' }, 501);
    }

    const { type, name } = c.req.param();

    try {
      const body = await c.req.json();
      const { version, changeNote, recordedBy } = body;

      if (typeof version !== 'number') {
        return c.json(
          {
            success: false,
            error: 'Version number is required',
          },
          400
        );
      }

      const restoredMetadata = await metadataService.rollback(type, name, version, {
        changeNote,
        recordedBy,
      });

      return c.json({
        success: true,
        data: {
          type,
          name,
          version,
          metadata: restoredMetadata,
        },
      });
    } catch (error) {
      return c.json(
        {
          success: false,
          error: error instanceof Error ? error.message : 'Rollback failed',
        },
        500
      );
    }
  });

  /**
   * GET /api/v1/metadata/:type/:name/diff
   * Compare two versions of a metadata item
   *
   * Query parameters:
   * - version1: number (required) - First version (older)
   * - version2: number (required) - Second version (newer)
   */
  app.get('/api/v1/metadata/:type/:name/diff', async (c: any) => {
    if (!metadataService.diff) {
      return c.json({ error: 'Diff not supported' }, 501);
    }

    const { type, name } = c.req.param();
    const query = c.req.query();

    try {
      const version1 = parseInt(query.version1, 10);
      const version2 = parseInt(query.version2, 10);

      if (isNaN(version1) || isNaN(version2)) {
        return c.json(
          {
            success: false,
            error: 'Both version1 and version2 query parameters are required',
          },
          400
        );
      }

      const diffResult = await metadataService.diff(type, name, version1, version2);

      return c.json({
        success: true,
        data: diffResult,
      });
    } catch (error) {
      return c.json(
        {
          success: false,
          error: error instanceof Error ? error.message : 'Diff failed',
        },
        500
      );
    }
  });
}
