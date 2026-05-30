// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { PluginContext } from '@objectstack/core';
import type { IHttpServer } from '@objectstack/spec/contracts';

/**
 * External Datasource Federation REST routes (ADR-0015 §6.2).
 *
 * Mounted under `/api/v1/datasources/:name/external/*` and served by the
 * `external-datasource` service. Every route degrades gracefully
 * (`503 external_service_unavailable`) when federation is not wired into the
 * host, so the routes are safe to register unconditionally.
 *
 *   GET  /datasources/:name/external/tables             → listRemoteTables
 *   POST /datasources/:name/external/tables/:remote/draft → generateObjectDraft
 *   POST /datasources/:name/external/tables/:remote/import → importObject
 *   POST /datasources/:name/external/refresh-catalog    → refreshCatalog
 *   POST /datasources/:name/external/validate           → validateAll (this ds)
 */
export function registerExternalDatasourceRoutes(
  server: IHttpServer,
  ctx: PluginContext,
  basePath = '/api/v1',
): void {
  const ext = `${basePath}/datasources/:name/external`;

  const externalService = (): any => {
    try {
      return ctx.getService<any>('external-datasource');
    } catch {
      return undefined;
    }
  };

  const unavailable = (res: any) =>
    res.status(503).json({ error: 'external_service_unavailable' });

  // List remote tables (optionally filtered by ?schema=).
  server.get(`${ext}/tables`, async (req: any, res: any) => {
    const svc = externalService();
    if (!svc?.listRemoteTables) return unavailable(res);
    const schema = typeof req.query?.schema === 'string' ? req.query.schema : undefined;
    const tables = await svc.listRemoteTables(req.params.name, { schema });
    res.json({ tables });
  });

  // Generate an Object draft (structured + *.object.ts source) from a table.
  server.post(`${ext}/tables/:remote/draft`, async (req: any, res: any) => {
    const svc = externalService();
    if (!svc?.generateObjectDraft) return unavailable(res);
    const draft = await svc.generateObjectDraft(
      req.params.name,
      req.params.remote,
      (req.body as Record<string, unknown>) ?? {},
    );
    res.json({ draft });
  });

  // Import a remote table as a live (runtime-origin) federated object so it's
  // immediately queryable — the "Import as Object" action (ADR-0015 Addendum).
  // 503 when the service is absent; 400 when import is refused (e.g. read-only
  // metadata store) or the remote table is missing.
  server.post(`${ext}/tables/:remote/import`, async (req: any, res: any) => {
    const svc = externalService();
    if (!svc?.importObject) return unavailable(res);
    try {
      const result = await svc.importObject(
        req.params.name,
        req.params.remote,
        (req.body as Record<string, unknown>) ?? {},
      );
      res.status(201).json({ object: result });
    } catch (err) {
      res.status(400).json({
        error: 'external_import_error',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  });

  // Refresh and return the cached catalog snapshot.
  server.post(`${ext}/refresh-catalog`, async (req: any, res: any) => {
    const svc = externalService();
    if (!svc?.refreshCatalog) return unavailable(res);
    const catalog = await svc.refreshCatalog(req.params.name);
    res.json({ catalog });
  });

  // Validate the federated objects on this datasource.
  server.post(`${ext}/validate`, async (req: any, res: any) => {
    const svc = externalService();
    if (!svc?.validateAll) return unavailable(res);
    const report = await svc.validateAll();
    const results = (report.results ?? []).filter((r: any) => r.datasource === req.params.name);
    res.json({ ok: results.every((r: any) => r.ok), results });
  });
}

/**
 * Datasource lifecycle REST routes (ADR-0015 Addendum §3.5).
 *
 * Mounted under `/api/v1/datasources` and served by the `datasource-admin`
 * service. Like the federation routes, every route degrades gracefully
 * (`503 datasource_admin_unavailable`) when the service is not wired in, and
 * lifecycle/validation failures surface as `400` with the service's message.
 *
 *   GET    /datasources              → listDatasources (provenance + health)
 *   POST   /datasources/test         → testConnection (no persistence)
 *   POST   /datasources              → createDatasource (origin: 'runtime')
 *   PATCH  /datasources/:name        → updateDatasource (runtime only)
 *   DELETE /datasources/:name        → removeDatasource (runtime only)
 *
 * Request bodies carry the connection draft inline with an optional cleartext
 * `secret` field; the route splits `secret` out so it never reaches the draft
 * the service persists.
 */
export function registerDatasourceAdminRoutes(
  server: IHttpServer,
  ctx: PluginContext,
  basePath = '/api/v1',
): void {
  const root = `${basePath}/datasources`;

  const adminService = (): any => {
    try {
      return ctx.getService<any>('datasource-admin');
    } catch {
      return undefined;
    }
  };

  const unavailable = (res: any) =>
    res.status(503).json({ error: 'datasource_admin_unavailable' });

  const badRequest = (res: any, err: unknown) =>
    res.status(400).json({ error: 'datasource_admin_error', message: err instanceof Error ? err.message : String(err) });

  /** Split an inline `{ secret, ...draft }` body into (draft, secret). */
  const splitSecret = (body: any): { draft: any; secret: any } => {
    const { secret, ...draft } = (body as Record<string, unknown>) ?? {};
    // Accept either a bare string or a `{ value, namespace?, key? }` object.
    const normalised =
      secret == null
        ? undefined
        : typeof secret === 'string'
          ? { value: secret }
          : secret;
    return { draft, secret: normalised };
  };

  // List all datasources with provenance + health.
  server.get(root, async (_req: any, res: any) => {
    const svc = adminService();
    if (!svc?.listDatasources) return unavailable(res);
    const datasources = await svc.listDatasources();
    res.json({ datasources });
  });

  // Probe a connection without persisting anything. Registered before the
  // `:name` routes so the literal `test` segment is never captured as a name.
  server.post(`${root}/test`, async (req: any, res: any) => {
    const svc = adminService();
    if (!svc?.testConnection) return unavailable(res);
    const { draft, secret } = splitSecret(req.body);
    try {
      const result = await svc.testConnection(draft, secret);
      res.json({ result });
    } catch (err) {
      badRequest(res, err);
    }
  });

  // Create a runtime datasource.
  server.post(root, async (req: any, res: any) => {
    const svc = adminService();
    if (!svc?.createDatasource) return unavailable(res);
    const { draft, secret } = splitSecret(req.body);
    try {
      const datasource = await svc.createDatasource(draft, secret);
      res.status(201).json({ datasource });
    } catch (err) {
      badRequest(res, err);
    }
  });

  // Patch a runtime datasource.
  server.patch(`${root}/:name`, async (req: any, res: any) => {
    const svc = adminService();
    if (!svc?.updateDatasource) return unavailable(res);
    const { draft, secret } = splitSecret(req.body);
    try {
      const datasource = await svc.updateDatasource(req.params.name, draft, secret);
      res.json({ datasource });
    } catch (err) {
      badRequest(res, err);
    }
  });

  // Remove a runtime datasource.
  server.delete(`${root}/:name`, async (req: any, res: any) => {
    const svc = adminService();
    if (!svc?.removeDatasource) return unavailable(res);
    try {
      await svc.removeDatasource(req.params.name);
      res.status(204).end();
    } catch (err) {
      badRequest(res, err);
    }
  });
}
