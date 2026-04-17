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
  server.post(packagesPath, async (req, res) => {
    try {
      const { manifest, metadata } = req.body || {};

      if (!manifest || !metadata) {
        res.status(400).json({ error: 'Missing required fields: manifest, metadata' });
        return;
      }

      if (!manifest.id || !manifest.version) {
        res.status(400).json({ error: 'Invalid manifest: id and version are required' });
        return;
      }

      const result = await packageService.publish({ manifest, metadata });

      if (result.success) {
        res.json({
          success: true,
          message: `Published ${manifest.id}@${manifest.version}`,
          package: {
            id: manifest.id,
            version: manifest.version,
          },
        });
        return;
      }

      res.status(400).json({ success: false, error: result.error });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // GET /api/v1/packages - List all packages (latest versions)
  server.get(packagesPath, async (_req, res) => {
    try {
      const packages = await packageService.list();
      res.json({ packages });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // GET /api/v1/packages/:id - Get a specific package
  server.get(`${packagesPath}/:id`, async (req, res) => {
    try {
      const packageId = req.params.id;
      const version = req.query?.version || 'latest';

      const pkg = await packageService.get(packageId, version);

      if (!pkg) {
        res.status(404).json({ error: 'Package not found' });
        return;
      }

      res.json({ package: pkg });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // DELETE /api/v1/packages/:id - Delete a package
  server.delete(`${packagesPath}/:id`, async (req, res) => {
    try {
      const packageId = req.params.id;
      const version = req.query?.version;

      const result = await packageService.delete(packageId, version);

      if (result.success) {
        res.json({
          success: true,
          message: `Deleted ${packageId}${version ? `@${version}` : ''}`,
        });
        return;
      }

      res.status(400).json({ success: false });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });
}
