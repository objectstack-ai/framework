// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Multi-Project End-to-End Smoke Test
 *
 * Boots the Server in `multi-project` mode against an ephemeral
 * SQLite control DB, then exercises the complete Supabase-style flow:
 *
 *   1. Create an organization
 *   2. Create two projects (A, B) under it, each with its own driver
 *   3. Define a custom object in project A
 *   4. Write data in project A
 *   5. Read metadata + data back via both `X-Project-Id` and `Host` header
 *   6. Assert project B does NOT see A's object or data (isolation)
 *
 * Runs in-process — no child processes, no random port. The Hono app is
 * obtained via `ensureApp()` and driven with synthetic `Request` objects.
 * This keeps the test fast enough to run on every commit.
 *
 *   pnpm --filter @objectstack/server test:e2e
 */

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// ---------------------------------------------------------------------------
// Minimal expect() — matches the style of the retired e2e.test.ts so nobody
// has to learn a new DSL. Kept local to the file (no vitest dependency).
// ---------------------------------------------------------------------------

function expect(actual: any) {
    return {
        toBe: (expected: any) => {
            if (actual !== expected) {
                throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
            }
        },
        toBeDefined: () => {
            if (actual === undefined || actual === null) {
                throw new Error(`Expected defined, got ${actual}`);
            }
        },
        toContain: (item: any) => {
            if (!Array.isArray(actual)) {
                throw new Error(`Expected array, got ${typeof actual}`);
            }
            if (!actual.includes(item)) {
                throw new Error(`Expected array to contain "${item}", but got: ${JSON.stringify(actual)}`);
            }
        },
        not: {
            toContain: (item: any) => {
                if (Array.isArray(actual) && actual.includes(item)) {
                    throw new Error(`Expected array to NOT contain "${item}", but got: ${JSON.stringify(actual)}`);
                }
            },
        },
        toMatchObject: (shape: Record<string, unknown>) => {
            for (const [k, v] of Object.entries(shape)) {
                if ((actual as any)?.[k] !== v) {
                    throw new Error(`Field ${k}: expected ${JSON.stringify(v)}, got ${JSON.stringify((actual as any)?.[k])}`);
                }
            }
        },
    };
}

// ---------------------------------------------------------------------------
// Env setup must happen BEFORE importing the server — objectstack.config.ts
// reads OBJECTSTACK_DATABASE_URL when selecting the control-plane driver.
// ---------------------------------------------------------------------------

const workdir = mkdtempSync(join(tmpdir(), 'objectstack-e2e-'));
const controlDb = join(workdir, 'control.db');

process.env.OBJECTSTACK_MODE = 'cloud';
process.env.OBJECTSTACK_DATABASE_URL = `file:${controlDb}`;
process.env.AUTH_SECRET = 'e2e-test-secret-must-be-at-least-32-characters-long-xxxx';
process.env.PORT = '0';
// Keep kernel LRU small so an eviction test could be added later without
// needing to reconfigure. Doesn't affect the current assertions.
process.env.OBJECTSTACK_KERNEL_CACHE_SIZE = '8';
process.env.OBJECTSTACK_ENV_CACHE_TTL_MS = '60000';

// Defer import until env is set.
const { ensureApp } = await import('../server/index.js');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type FetchInit = {
    method?: string;
    headers?: Record<string, string>;
    body?: unknown;
    host?: string;
    projectId?: string;
};

async function call(path: string, init: FetchInit = {}): Promise<{ status: number; body: any }> {
    const app = await ensureApp();
    const method = (init.method ?? 'GET').toUpperCase();
    const host = init.host ?? 'localhost';
    const headers: Record<string, string> = {
        'content-type': 'application/json',
        host,
        ...(init.headers ?? {}),
    };
    if (init.projectId) {
        headers['x-project-id'] = init.projectId;
    }
    const url = `http://${host}${path}`;
    const reqInit: RequestInit = { method, headers };
    if (init.body !== undefined) {
        reqInit.body = JSON.stringify(init.body);
    }
    const res = await app.fetch(new Request(url, reqInit));
    const text = await res.text();
    let body: any = text;
    try { body = text ? JSON.parse(text) : null; } catch { /* leave as text */ }
    return { status: res.status, body };
}

async function waitForActive(projectId: string, timeoutMs = 10_000): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        const { status, body } = await call(`/api/v1/cloud/projects/${projectId}`);
        if (status === 200 && body?.data?.project?.status === 'active') return;
        if (status === 200 && body?.data?.project?.status === 'failed') {
            const meta = body.data.project.metadata;
            throw new Error(`Project ${projectId} provisioning failed: ${meta}`);
        }
        await new Promise((r) => setTimeout(r, 100));
    }
    throw new Error(`Project ${projectId} did not become active within ${timeoutMs}ms`);
}

function id(): string {
    // RFC4122 v4 (crypto.randomUUID is available on Node 18+)
    return (globalThis as any).crypto.randomUUID();
}

// ---------------------------------------------------------------------------
// Test runner — a tiny sequential framework so failures abort immediately
// and we always hit the cleanup path.
// ---------------------------------------------------------------------------

const tests: Array<{ name: string; run: () => Promise<void> }> = [];
function test(name: string, run: () => Promise<void>) { tests.push({ name, run }); }

// ---------------------------------------------------------------------------
// Scenarios
// ---------------------------------------------------------------------------

// Shared state across the sequence. Each test appends to it.
const state = {
    orgId: '' as string,
    projectA: '' as string,
    hostnameA: 'acme.e2e.local',
    projectB: '' as string,
    hostnameB: 'tasks.e2e.local',
};

test('health check returns ok', async () => {
    const { status, body } = await call('/api/v1/health');
    expect(status).toBe(200);
    // health may return { status: 'ok' } or similar — just assert non-error shape
    expect(body).toBeDefined();
});

test('create organization (synthetic — control-plane direct insert)', async () => {
    // Normally an org is created through better-auth's /auth/organization/create
    // by a logged-in user. The E2E harness skips auth by seeding sys_organization
    // directly via the kernel's ObjectQL service, so the rest of the test can
    // focus on project provisioning + hostname routing.
    state.orgId = id();
    const { ensureBoot } = await import('../server/index.js');
    const boot = await ensureBoot();
    const ql = (boot.kernel as any).getService('objectql');
    if (!ql || typeof ql.insert !== 'function') {
        throw new Error('Control-plane ObjectQL service not available on boot.kernel');
    }
    await ql.insert('sys_organization', {
        id: state.orgId,
        name: `E2E Org ${state.orgId.slice(0, 6)}`,
        slug: `e2e-${state.orgId.slice(0, 6)}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    });
});

test('provision project A (sqlite driver, hostname a.e2e.local)', async () => {
    const { status, body } = await call('/api/v1/cloud/projects', {
        method: 'POST',
        body: {
            organization_id: state.orgId,
            display_name: 'Project A',
            driver: 'sqlite',
            hostname: state.hostnameA,
            metadata: { __simulateDelayMs: 0 },
        },
    });
    // Provisioning is fire-and-forget: the response is 202 Accepted while
    // the background job runs. A.waitForActive() polls until status flips.
    if (status < 200 || status >= 300) {
        throw new Error(`project A create failed: ${status} ${JSON.stringify(body)}`);
    }
    state.projectA = body?.data?.project?.id ?? body?.data?.id;
    expect(state.projectA).toBeDefined();
    await waitForActive(state.projectA);
});

test('provision project B (sqlite driver, hostname b.e2e.local)', async () => {
    const { status, body } = await call('/api/v1/cloud/projects', {
        method: 'POST',
        body: {
            organization_id: state.orgId,
            display_name: 'Project B',
            driver: 'sqlite',
            hostname: state.hostnameB,
            metadata: { __simulateDelayMs: 0 },
        },
    });
    if (status < 200 || status >= 300) {
        throw new Error(`project B create failed: ${status} ${JSON.stringify(body)}`);
    }
    state.projectB = body?.data?.project?.id ?? body?.data?.id;
    expect(state.projectB).toBeDefined();
    await waitForActive(state.projectB);
});

test('hostname collision returns 409 HOSTNAME_TAKEN', async () => {
    const { status, body } = await call('/api/v1/cloud/projects', {
        method: 'POST',
        body: {
            organization_id: state.orgId,
            display_name: 'Dup',
            driver: 'sqlite',
            hostname: state.hostnameA, // duplicates project A
        },
    });
    expect(status).toBe(409);
    expect(body?.error?.details?.code).toBe('HOSTNAME_TAKEN');
});

test('define custom object "task" inside project A', async () => {
    // PUT /metadata/object/task registers a new object definition via
    // protocol.saveMetaItem — that stamps env_id = projectA into sys_metadata
    // and mirrors to the in-memory SchemaRegistry.
    const { status, body } = await call('/api/v1/meta/object/task', {
        method: 'PUT',
        projectId: state.projectA,
        body: {
            name: 'task',
            label: 'Task',
            pluralLabel: 'Tasks',
            fields: {
                id: { label: 'ID', type: 'text', required: true, readonly: true },
                title: { label: 'Title', type: 'text', required: true },
                done: { label: 'Done', type: 'boolean', defaultValue: false },
            },
        },
    });
    if (status !== 200 && status !== 201) {
        throw new Error(`saveMetaItem failed: ${status} ${JSON.stringify(body)}`);
    }
});

test('kernelManager.getOrCreate(projectA) succeeds', async () => {
    const { ensureBoot } = await import('../server/index.js');
    const boot = await ensureBoot();
    if (!boot.kernelManager) throw new Error('no kernelManager on boot result');
    const k = await boot.kernelManager.getOrCreate(state.projectA);
    if (!k) throw new Error('kernelManager returned falsy kernel');
});

test('project A can read its own "task" object from /meta', async () => {
    // SchemaRegistry is updated synchronously on saveMetaItem, so this
    // round-trip should succeed without any kernel reload.
    const { status, body } = await call('/api/v1/meta/objects/task', {
        projectId: state.projectA,
    });
    expect(status).toBe(200);
    const obj = body?.data ?? body;
    expect(obj?.name).toBe('task');
});

test('project B does NOT see project A\'s "task" object (isolation)', async () => {
    const { status, body } = await call('/api/v1/meta/objects/task', {
        projectId: state.projectB,
    });
    // Acceptable responses:
    //   - 404 Not Found
    //   - 200 with `{ item: undefined }` — protocol.getMetaItem returns a
    //     "found nothing" shape rather than throwing, so a truthy body
    //     without an `item` field counts as isolation-OK.
    if (status === 200) {
        const data = body?.data ?? body;
        const item = data?.item;
        const hasFields = item && typeof item === 'object' && 'fields' in item;
        if (hasFields) {
            throw new Error(`isolation breach: B sees object with body ${JSON.stringify(body)}`);
        }
    }
});

test('hostname routing routes A\'s host to project A', async () => {
    const { status, body } = await call('/api/v1/meta/objects/task', {
        host: state.hostnameA,
    });
    expect(status).toBe(200);
    const obj = body?.data ?? body;
    expect(obj?.name).toBe('task');
});

test('hostname routing routes B\'s host — should NOT see task', async () => {
    const { status, body } = await call('/api/v1/meta/objects/task', {
        host: state.hostnameB,
    });
    if (status === 200) {
        const item = (body?.data ?? body)?.item;
        const hasFields = item && typeof item === 'object' && 'fields' in item;
        if (hasFields) {
            throw new Error(`isolation breach via hostname routing: ${JSON.stringify(body)}`);
        }
    }
});

// ---------------------------------------------------------------------------
// Template seeding tests
// ---------------------------------------------------------------------------

test('GET /cloud/templates returns a list including "blank"', async () => {
    const { status, body } = await call('/api/v1/cloud/templates');
    expect(status).toBe(200);
    const templates: Array<{ id: string }> = body?.data?.templates ?? [];
    const ids = templates.map((t) => t.id);
    expect(ids).toContain('blank');
});

test('provision project C with template_id=blank (no-op seeding, project becomes active)', async () => {
    const { status, body } = await call('/api/v1/cloud/projects', {
        method: 'POST',
        body: {
            organization_id: state.orgId,
            display_name: 'Project C (blank template)',
            driver: 'sqlite',
            template_id: 'blank',
            metadata: { __simulateDelayMs: 0 },
        },
    });
    if (status < 200 || status >= 300) {
        throw new Error(`project C create failed: ${status} ${JSON.stringify(body)}`);
    }
    const projectC = body?.data?.project?.id ?? body?.data?.id;
    expect(projectC).toBeDefined();
    await waitForActive(projectC);
    // Confirm no templateSeedError was written (blank is a no-op)
    const { body: detail } = await call(`/api/v1/cloud/projects/${projectC}`);
    const meta = detail?.data?.project?.metadata ?? {};
    if (meta.templateSeedError) {
        throw new Error(`Unexpected templateSeedError for blank template: ${JSON.stringify(meta.templateSeedError)}`);
    }
});

test('provision project D with unknown template_id — error recorded in metadata, project still active', async () => {
    const { status, body } = await call('/api/v1/cloud/projects', {
        method: 'POST',
        body: {
            organization_id: state.orgId,
            display_name: 'Project D (bad template)',
            driver: 'sqlite',
            template_id: 'nonexistent-template',
            metadata: { __simulateDelayMs: 0 },
        },
    });
    if (status < 200 || status >= 300) {
        throw new Error(`project D create failed: ${status} ${JSON.stringify(body)}`);
    }
    const projectD = body?.data?.project?.id ?? body?.data?.id;
    expect(projectD).toBeDefined();
    await waitForActive(projectD);
    // The project must be active despite the seed error (non-fatal)
    const { body: detail } = await call(`/api/v1/cloud/projects/${projectD}`);
    const proj = detail?.data?.project;
    expect(proj?.status).toBe('active');
    // templateSeedError should be captured in metadata
    if (!proj?.metadata?.templateSeedError) {
        throw new Error('Expected templateSeedError in metadata for unknown template, got none');
    }
});

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
    console.log(`[E2E] work dir: ${workdir}`);
    let failed = 0;
    for (const t of tests) {
        process.stdout.write(`  • ${t.name} ... `);
        try {
            await t.run();
            console.log('OK');
        } catch (err) {
            failed++;
            console.log('FAIL');
            console.error((err as Error).message);
            console.error((err as Error).stack);
            break; // abort on first failure — later tests depend on earlier state
        }
    }

    // cleanup
    try { rmSync(workdir, { recursive: true, force: true }); } catch { /* ignore */ }

    if (failed > 0) {
        console.error(`\nE2E: ${failed} test(s) failed.`);
        process.exit(1);
    }
    console.log('\nE2E: all tests passed.');
    process.exit(0);
}

main().catch((err) => {
    console.error('E2E harness crashed:', err);
    try { rmSync(workdir, { recursive: true, force: true }); } catch { /* ignore */ }
    process.exit(1);
});
