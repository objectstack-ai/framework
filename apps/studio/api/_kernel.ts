// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Server-side Kernel Singleton for Vercel Serverless Functions
 *
 * Boots an ObjectKernel with ObjectQL + InMemoryDriver, seeds data from
 * the Studio configuration, and exposes a Hono app via createHonoApp.
 *
 * The kernel instance survives across warm invocations of the same
 * serverless function container, so boot cost is paid only on cold start.
 *
 * @module
 */

import { ObjectKernel, DriverPlugin, AppPlugin } from '@objectstack/runtime';
import { ObjectQLPlugin } from '@objectstack/objectql';
import { InMemoryDriver } from '@objectstack/driver-memory';
import { createHonoApp } from '@objectstack/hono';
import { Hono } from 'hono';
import { createBrokerShim } from '../src/lib/create-broker-shim';
import studioConfig from '../objectstack.config';

// --- Singleton state (persists across warm invocations) ---
let _kernel: ObjectKernel | null = null;
let _app: Hono | null = null;

/**
 * Boot the ObjectStack kernel (one-time cold-start cost).
 */
async function bootKernel(): Promise<ObjectKernel> {
    if (_kernel) return _kernel;

    console.log('[Vercel] Booting ObjectStack Kernel (server mode)...');

    const kernel = new ObjectKernel();

    await kernel.use(new ObjectQLPlugin());
    await kernel.use(new DriverPlugin(new InMemoryDriver(), 'memory'));
    await kernel.use(new AppPlugin(studioConfig));

    // Broker shim — bridges HttpDispatcher → ObjectQL engine
    (kernel as any).broker = createBrokerShim(kernel);

    await kernel.bootstrap();

    // Seed data from config
    await seedData(kernel, [studioConfig]);

    _kernel = kernel;
    console.log('[Vercel] Kernel ready.');
    return kernel;
}

/**
 * Seed records defined in app configs into the ObjectQL engine.
 */
async function seedData(kernel: ObjectKernel, configs: any[]) {
    const ql = (kernel as any).context?.getService('objectql');
    if (!ql) return;

    // Reserved namespaces ('base', 'system') bypass FQN transformation —
    // objects in these namespaces keep their short name as-is.
    const RESERVED_NS = new Set(['base', 'system']);
    const toFQN = (name: string, namespace?: string) => {
        if (name.includes('__') || !namespace || RESERVED_NS.has(namespace)) return name;
        return `${namespace}__${name}`;
    };

    for (const appConfig of configs) {
        const namespace = (appConfig.manifest || appConfig)?.namespace as string | undefined;

        const seedDatasets: any[] = [];
        if (Array.isArray(appConfig.data)) {
            seedDatasets.push(...appConfig.data);
        }
        if (appConfig.manifest && Array.isArray(appConfig.manifest.data)) {
            seedDatasets.push(...appConfig.manifest.data);
        }

        for (const dataset of seedDatasets) {
            if (!dataset.records || !dataset.object) continue;

            const objectFQN = toFQN(dataset.object, namespace);

            // Handle PaginatedResult wrapper — InMemoryDriver may return { value: [...] }
            let existing = await ql.find(objectFQN);
            if (existing && (existing as any).value) existing = (existing as any).value;

            if (!existing || existing.length === 0) {
                console.log(`[Vercel] Seeding ${dataset.records.length} records for ${objectFQN}`);
                for (const record of dataset.records) {
                    await ql.insert(objectFQN, record);
                }
            }
        }
    }
}

/**
 * Get (or create) the Hono application backed by the ObjectStack kernel.
 * The prefix `/api/v1` matches the client SDK's default API path.
 */
export async function getApp(): Promise<Hono> {
    if (_app) return _app;

    const kernel = await bootKernel();
    _app = createHonoApp({ kernel, prefix: '/api/v1' });
    return _app;
}
