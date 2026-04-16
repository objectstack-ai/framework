// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { IHttpServer } from '@objectstack/core';
import type { PackageService } from '@objectstack/service-package';

/**
 * Register package management API routes
 *
 * Provides endpoints for publishing, retrieving, and managing packages.
 * Routes:
 * - POST /api/v1/packages - Publish a package
 * - GET /api/v1/packages - List all packages
 * - GET /api/v1/packages/:id - Get a specific package
 * - DELETE /api/v1/packages/:id - Delete a package
 */
export function registerPackageRoutes(server: IHttpServer, packageService: PackageService, basePath: string = '/api/v1') {
  const packagesPath = `${basePath}/packages`;

  // POST /api/v1/packages - Publish a package
  server.post(packagesPath, async (c) => {
    try {
      const body = await c.req.json();
      const { manifest, metadata } = body;

      if (!manifest || !metadata) {
        return c.json({ error: 'Missing required fields: manifest, metadata' }, 400);
      }

      if (!manifest.id || !manifest.version) {
        return c.json({ error: 'Invalid manifest: id and version are required' }, 400);
      }

      const result = await packageService.publish({ manifest, metadata });

      if (result.success) {
        return c.json({
          success: true,
          message: `Published ${manifest.id}@${manifest.version}`,
          package: {
            id: manifest.id,
            version: manifest.version,
          },
        });
      }

      return c.json({ success: false, error: result.error }, 400);
    } catch (error) {
      return c.json({ error: (error as Error).message }, 500);
    }
  });

  // GET /api/v1/packages - List all packages (latest versions)
  server.get(packagesPath, async (c) => {
    try {
      const packages = await packageService.list();
      return c.json({ packages });
    } catch (error) {
      return c.json({ error: (error as Error).message }, 500);
    }
  });

  // GET /api/v1/packages/:id - Get a specific package
  server.get(`${packagesPath}/:id`, async (c) => {
    try {
      const packageId = c.req.param('id');
      const version = c.req.query('version') || 'latest';

      const pkg = await packageService.get(packageId, version);

      if (!pkg) {
        return c.json({ error: 'Package not found' }, 404);
      }

      return c.json({ package: pkg });
    } catch (error) {
      return c.json({ error: (error as Error).message }, 500);
    }
  });

  // DELETE /api/v1/packages/:id - Delete a package
  server.delete(`${packagesPath}/:id`, async (c) => {
    try {
      const packageId = c.req.param('id');
      const version = c.req.query('version');

      const result = await packageService.delete(packageId, version);

      if (result.success) {
        return c.json({
          success: true,
          message: `Deleted ${packageId}${version ? `@${version}` : ''}`,
        });
      }

      return c.json({ success: false }, 400);
    } catch (error) {
      return c.json({ error: (error as Error).message }, 500);
    }
  });
}
