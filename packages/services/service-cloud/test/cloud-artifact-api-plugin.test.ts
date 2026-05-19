// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Tests for the cloud-side Artifact API plugin.
 *
 * Spins up the plugin against an in-memory `IHttpServer` mock and a
 * fake control-plane driver to verify it correctly:
 *
 *   - Resolves a hostname to a project and returns the runtime block.
 *   - Falls back to the wildcard (`*`) project when no exact host matches.
 *   - Returns 404 when no project is bound.
 *   - Loads the artifact bundle file referenced by `metadata.artifact_path`
 *     and returns a well-formed `ProjectArtifact` envelope.
 *   - Enforces bearer auth when `apiKey` is configured.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createCloudArtifactApiPlugin } from '../src/cloud-artifact-api-plugin.js';

interface Route {
    method: 'GET' | 'POST';
    path: string;
    handler: (req: any, res: any) => any;
}

class FakeHttpServer {
    routes: Route[] = [];
    get(path: string, handler: (req: any, res: any) => any) {
        this.routes.push({ method: 'GET', path, handler });
    }
    post(path: string, handler: (req: any, res: any) => any) {
        this.routes.push({ method: 'POST', path, handler });
    }
    delete(path: string, handler: (req: any, res: any) => any) {
        this.routes.push({ method: 'DELETE', path, handler });
    }
    put() {} patch() {}
    async invoke(method: 'GET' | 'POST' | 'DELETE', urlPath: string, opts: { params?: Record<string, string>; query?: Record<string, string>; headers?: Record<string, string>; body?: any } = {}) {
        const route = this.routes.find((r) => r.method === method && pathMatches(r.path, urlPath));
        if (!route) return { status: 404, body: { error: 'no route' } };
        const params = extractParams(route.path, urlPath);
        const req = { params: { ...params, ...opts.params }, query: opts.query ?? {}, headers: opts.headers ?? {} };
        let captured: { status: number; body: any } = { status: 200, body: undefined };
        const res: any = {
            status(code: number) { captured.status = code; return res; },
            json(body: any) { captured.body = body; return res; },
        };
        await route.handler(req, res);
        return captured;
    }
}

function pathMatches(pattern: string, actual: string): boolean {
    const a = pattern.split('/');
    const b = actual.split('/');
    if (a.length !== b.length) return false;
    return a.every((seg, i) => seg.startsWith(':') || seg === b[i]);
}
function extractParams(pattern: string, actual: string): Record<string, string> {
    const out: Record<string, string> = {};
    const a = pattern.split('/');
    const b = actual.split('/');
    a.forEach((seg, i) => { if (seg.startsWith(':')) out[seg.slice(1)] = b[i]; });
    return out;
}

interface FakeProject {
    id: string; organization_id?: string; hostname?: string;
    database_driver?: string; database_url?: string; database_auth_token?: string;
    metadata?: any; is_system?: boolean;
}

class FakeDriver {
    constructor(public projects: FakeProject[] = [], public credentials: Array<{ project_id: string; database_driver?: string; database_url?: string; database_auth_token?: string }> = []) {}
    async findOne(table: string, query: any): Promise<any> {
        const where = query?.where ?? {};
        if (table === 'sys_project') {
            return this.projects.find((p) => Object.entries(where).every(([k, v]) => (p as any)[k] === v)) ?? null;
        }
        if (table === 'sys_project_credential') {
            return this.credentials.find((c) => Object.entries(where).every(([k, v]) => (c as any)[k] === v)) ?? null;
        }
        return null;
    }
    async find(table: string, query: any): Promise<any[]> {
        const where = query?.where ?? {};
        if (table === 'sys_project') {
            return this.projects.filter((p) => Object.entries(where).every(([k, v]) => {
                if (v && typeof v === 'object') {
                    if ('$like' in (v as any)) {
                        const pattern = String((v as any).$like).replace(/%/g, '.*');
                        return new RegExp(`^${pattern}$`).test(String((p as any)[k] ?? ''));
                    }
                    if ('$contains' in (v as any)) {
                        return String((p as any)[k] ?? '').includes(String((v as any).$contains));
                    }
                }
                return (p as any)[k] === v;
            })).slice(0, query?.limit ?? 100);
        }
        return [];
    }
}

describe('createCloudArtifactApiPlugin', () => {
    let server: FakeHttpServer;
    let artifactRoot: string;

    beforeEach(() => {
        server = new FakeHttpServer();
        artifactRoot = mkdtempSync(join(tmpdir(), 'cloud-artifact-api-'));
    });

    async function bootPlugin(driver: FakeDriver, opts: { apiKey?: string } = {}) {
        const plugin = createCloudArtifactApiPlugin({
            controlDriverPromise: Promise.resolve({ driver: driver as any, driverName: 'memory', databaseUrl: 'memory://' }),
            artifactRoot,
            apiKey: opts.apiKey,
        });
        const ctx: any = { getService: (n: string) => (n === 'http.server' ? server : undefined), logger: console };
        await plugin.init(ctx);
        await plugin.start(ctx);
    }

    it('resolves a hostname to its project + runtime block', async () => {
        const driver = new FakeDriver(
            [{ id: 'proj_a', organization_id: 'org_1', hostname: 'tenant.example.com', database_driver: 'sqlite', database_url: 'file:./a.db' }],
            [],
        );
        await bootPlugin(driver);

        const res = await server.invoke('GET', '/api/v1/cloud/resolve-hostname', { query: { host: 'tenant.example.com' } });
        expect(res.status).toBe(200);
        expect(res.body).toEqual({
            success: true,
            data: {
                projectId: 'proj_a',
                organizationId: 'org_1',
                runtime: {
                    organizationId: 'org_1',
                    hostname: 'tenant.example.com',
                    databaseDriver: 'sqlite',
                    databaseUrl: 'file:./a.db',
                },
            },
        });
    });

    it('falls back to the wildcard project when no exact host match', async () => {
        const driver = new FakeDriver([
            { id: 'proj_default', hostname: '*', database_driver: 'sqlite', database_url: 'file:./d.db' },
        ]);
        await bootPlugin(driver);

        const res = await server.invoke('GET', '/api/v1/cloud/resolve-hostname', { query: { host: 'unknown.example.com' } });
        expect(res.status).toBe(200);
        expect(res.body.data.projectId).toBe('proj_default');
    });

    it('returns 404 when no project is bound to the hostname', async () => {
        await bootPlugin(new FakeDriver([]));
        const res = await server.invoke('GET', '/api/v1/cloud/resolve-hostname', { query: { host: 'nope.example.com' } });
        expect(res.status).toBe(404);
        expect(res.body.success).toBe(false);
    });

    it('returns 400 without host query parameter', async () => {
        await bootPlugin(new FakeDriver([{ id: 'p', hostname: 'h' }]));
        const res = await server.invoke('GET', '/api/v1/cloud/resolve-hostname', {});
        expect(res.status).toBe(400);
    });

    describe('GET /cloud/projects-by-short-id/:short', () => {
        it('resolves an 8-hex prefix to the full project id', async () => {
            const driver = new FakeDriver([
                { id: '7f3e9a01-1234-5678-9abc-def012345678', organization_id: 'org_x', hostname: 'a.com' },
                { id: 'aaaaaaaa-1111-2222-3333-444444444444', hostname: 'b.com' },
            ]);
            await bootPlugin(driver);

            const res = await server.invoke('GET', '/api/v1/cloud/projects-by-short-id/:short', { params: { short: '7f3e9a01' } });
            expect(res.status).toBe(200);
            expect(res.body.data.projectId).toBe('7f3e9a01-1234-5678-9abc-def012345678');
            expect(res.body.data.organizationId).toBe('org_x');
        });

        it('returns 404 when no project matches', async () => {
            await bootPlugin(new FakeDriver([{ id: 'aaaaaaaa-1111-2222-3333-444444444444', hostname: 'a' }]));
            const res = await server.invoke('GET', '/api/v1/cloud/projects-by-short-id/:short', { params: { short: 'deadbeef' } });
            expect(res.status).toBe(404);
        });

        it('returns 400 for malformed input', async () => {
            await bootPlugin(new FakeDriver([{ id: 'p', hostname: 'h' }]));
            const res = await server.invoke('GET', '/api/v1/cloud/projects-by-short-id/:short', { params: { short: 'zzz' } });
            expect(res.status).toBe(400);
        });

        it('returns 409 on ambiguous prefix', async () => {
            const driver = new FakeDriver([
                { id: '7f3e9a01-1111-1111-1111-111111111111', hostname: 'a.com' },
                { id: '7f3e9a01-2222-2222-2222-222222222222', hostname: 'b.com' },
            ]);
            await bootPlugin(driver);
            const res = await server.invoke('GET', '/api/v1/cloud/projects-by-short-id/:short', { params: { short: '7f3e9a01' } });
            expect(res.status).toBe(409);
        });
    });

    it('serves an artifact assembled from metadata.artifact_path', async () => {
        const artifactPath = join(artifactRoot, 'artifact.json');
        writeFileSync(artifactPath, JSON.stringify({
            schemaVersion: '0.1',
            projectId: 'proj_a',
            commitId: 'abc123',
            checksum: { algorithm: 'sha256', value: 'aa' },
            metadata: { objects: [{ name: 'account', label: 'Account' }] },
            functions: [],
            manifest: { plugins: ['hono'], drivers: ['sqlite'], engines: { node: '>=20' } },
            builtAt: '2026-01-01T00:00:00Z',
        }));

        const driver = new FakeDriver(
            [{ id: 'proj_a', organization_id: 'org_1', database_driver: 'sqlite', database_url: 'file:./a.db', metadata: { artifact_path: 'artifact.json' } }],
            [{ project_id: 'proj_a', database_driver: 'sqlite', database_url: 'file:./a.db', database_auth_token: 'tk_123' }],
        );
        await bootPlugin(driver);

        const res = await server.invoke('GET', '/api/v1/cloud/projects/:id/artifact', { params: { id: 'proj_a' } });
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.projectId).toBe('proj_a');
        expect(res.body.data.commitId).toBe('abc123');
        expect(res.body.data.metadata.objects).toEqual([{ name: 'account', label: 'Account' }]);
        expect(res.body.data.runtime).toEqual({
            organizationId: 'org_1',
            hostname: undefined,
            databaseDriver: 'sqlite',
            databaseUrl: 'file:./a.db',
            databaseAuthToken: 'tk_123',
            metadata: { artifact_path: 'artifact.json' },
        });
    });

    it('returns 404 for unknown project id', async () => {
        await bootPlugin(new FakeDriver([]));
        const res = await server.invoke('GET', '/api/v1/cloud/projects/:id/artifact', { params: { id: 'missing' } });
        expect(res.status).toBe(404);
    });

    it('handles a project with no artifact_path (returns empty metadata envelope)', async () => {
        const driver = new FakeDriver([{ id: 'proj_empty', database_driver: 'sqlite', database_url: 'file:./e.db', metadata: {} }]);
        await bootPlugin(driver);
        const res = await server.invoke('GET', '/api/v1/cloud/projects/:id/artifact', { params: { id: 'proj_empty' } });
        expect(res.status).toBe(200);
        expect(res.body.data.projectId).toBe('proj_empty');
        expect(res.body.data.metadata).toEqual({});
        expect(res.body.data.functions).toEqual([]);
    });

    it('merges multiple artifact bundles', async () => {
        mkdirSync(join(artifactRoot, 'bundles'), { recursive: true });
        writeFileSync(join(artifactRoot, 'bundles/a.json'), JSON.stringify({
            metadata: { objects: [{ name: 'a' }] }, functions: [{ name: 'fn_a' }],
        }));
        writeFileSync(join(artifactRoot, 'bundles/b.json'), JSON.stringify({
            metadata: { objects: [{ name: 'b' }], fields: [{ name: 'f' }] }, functions: [{ name: 'fn_b' }],
        }));

        const driver = new FakeDriver([{
            id: 'proj_multi', database_driver: 'sqlite', database_url: 'file:./m.db',
            metadata: { artifact_paths: ['bundles/a.json', 'bundles/b.json'] },
        }]);
        await bootPlugin(driver);

        const res = await server.invoke('GET', '/api/v1/cloud/projects/:id/artifact', { params: { id: 'proj_multi' } });
        expect(res.status).toBe(200);
        expect(res.body.data.metadata.objects).toEqual([{ name: 'a' }, { name: 'b' }]);
        expect(res.body.data.metadata.fields).toEqual([{ name: 'f' }]);
        expect(res.body.data.functions.map((f: any) => f.name)).toEqual(['fn_a', 'fn_b']);
    });

    it('enforces bearer auth when apiKey is configured', async () => {
        const driver = new FakeDriver([{ id: 'proj_a', hostname: 'h', database_driver: 'sqlite', database_url: 'file:./a.db' }]);
        await bootPlugin(driver, { apiKey: 'secret_xyz' });

        const unauth = await server.invoke('GET', '/api/v1/cloud/resolve-hostname', { query: { host: 'h' } });
        expect(unauth.status).toBe(401);

        const wrong = await server.invoke('GET', '/api/v1/cloud/resolve-hostname', {
            query: { host: 'h' }, headers: { authorization: 'Bearer wrong' },
        });
        expect(wrong.status).toBe(401);

        const ok = await server.invoke('GET', '/api/v1/cloud/resolve-hostname', {
            query: { host: 'h' }, headers: { authorization: 'Bearer secret_xyz' },
        });
        expect(ok.status).toBe(200);
    });
});
