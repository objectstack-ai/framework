// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { ObjectKernel, DriverPlugin, AppPlugin } from '@objectstack/runtime';
import { ObjectQLPlugin } from '@objectstack/objectql';
import { InMemoryDriver } from '@objectstack/driver-memory';
import { MSWPlugin } from '@objectstack/plugin-msw';
import { SetupPlugin } from '@objectstack/plugin-setup';
import { AutomationServicePlugin } from '@objectstack/service-automation';
import { AnalyticsServicePlugin } from '@objectstack/service-analytics';
import { MetadataPlugin } from '@objectstack/metadata';
import { AIServicePlugin } from '@objectstack/service-ai';
import { FeedServicePlugin } from '@objectstack/service-feed';
import { createBrokerShim } from '../lib/create-broker-shim';

// System object definitions — resolved via Vite aliases to plugin source (no runtime deps)
import {
    SysUser, SysSession, SysAccount, SysVerification,
    SysOrganization, SysMember, SysInvitation,
    SysTeam, SysTeamMember,
    SysApiKey, SysTwoFactor,
} from '@objectstack/plugin-auth/objects';
import { SysRole, SysPermissionSet } from '@objectstack/plugin-security/objects';
import { SysAuditLog } from '@objectstack/plugin-audit/objects';

/** All system objects from auth, security, and audit plugins */
const SYSTEM_OBJECTS = [
    // Auth
    SysUser, SysSession, SysAccount, SysVerification,
    SysOrganization, SysMember, SysInvitation,
    SysTeam, SysTeamMember,
    SysApiKey, SysTwoFactor,
    // Security
    SysRole, SysPermissionSet,
    // Audit
    SysAuditLog,
];

export interface KernelOptions {
    appConfigs?: any[];      // Multiple app configs
    appConfig?: any;         // Legacy single app config (backward compat)
    enableBrowser?: boolean; // Default true (for browser usage), set false for tests
}

export async function createKernel(options: KernelOptions) {
    const { enableBrowser = true } = options;
    
    // Support both single and multi-app modes
    const allConfigs = options.appConfigs 
        || (options.appConfig ? [options.appConfig] : []);

    console.log('[KernelFactory] Creating ObjectStack Kernel...');
    console.log('[KernelFactory] App Configs:', allConfigs.length);

    const driver = new InMemoryDriver();
    const kernel = new ObjectKernel();

    // Register ObjectQL engine
    await kernel.use(new ObjectQLPlugin());
    
    // Register the driver
    await kernel.use(new DriverPlugin(driver, 'memory'));
    
    // Register system objects (auth, security, audit) as a built-in system package
    const systemConfig = {
        name: 'system',
        manifest: {
            id: 'com.objectstack.system',
            name: 'System',
            version: '1.0.0',
            type: 'plugin',
            namespace: 'sys',
        },
        objects: SYSTEM_OBJECTS,
    };
    console.log('[KernelFactory] Loading system objects:', SYSTEM_OBJECTS.length);
    await kernel.use(new AppPlugin(systemConfig));
    
    // Load all app configs as plugins (handles object registration & seeding)
    for (const appConfig of allConfigs) {
        console.log('[KernelFactory] Loading app:', appConfig.manifest?.id || appConfig.name || 'unknown');
        await kernel.use(new AppPlugin(appConfig));
    }

    // Register services and plugins
    await kernel.use(new FeedServicePlugin());
    await kernel.use(new MetadataPlugin({ watch: false }));
    await kernel.use(new AIServicePlugin());
    await kernel.use(new AutomationServicePlugin());
    await kernel.use(new AnalyticsServicePlugin());
    await kernel.use(new SetupPlugin());

    // Protocol service is registered automatically by ObjectQLPlugin.init()
    // via ObjectStackProtocolImplementation (which uses SchemaRegistry internally).
    // Do NOT manually set 'protocol' on kernel.services — it would conflict with
    // ObjectQLPlugin's ctx.registerService('protocol', ...) during bootstrap.
    console.log('[KernelFactory] Protocol service will be registered by ObjectQLPlugin');

    // --- BROKER SHIM (MUST be registered BEFORE MSWPlugin) ---
    // HttpDispatcher requires a broker to function. We inject a shim.
    (kernel as any).broker = createBrokerShim(kernel);
    // --- BROKER SHIM END ---

    // MSW Plugin (AFTER protocol service and broker shim are registered)
    await kernel.use(new MSWPlugin({
        enableBrowser: enableBrowser,
        baseUrl: '/api/v1',
        logRequests: true
    }));
    
    await kernel.bootstrap();

    // FORCE SYNC SEED: Guarantees data availability for both Browser and Tests
    const ql = (kernel as any).context?.getService('objectql');
    if (ql) {
        // Helper: resolve short object name to FQN using namespace
        const RESERVED_NS = new Set(['base', 'system']);
        const toFQN = (name: string, namespace?: string) => {
            if (name.includes('__') || !namespace || RESERVED_NS.has(namespace)) return name;
            return `${namespace}__${name}`;
        };

        // Seed data for all app configs
        for (const appConfig of allConfigs) {
            const namespace = (appConfig.manifest || appConfig)?.namespace as string | undefined;
            
            // Collect datasets from all locations:
            // 1. Top-level `data` (new standard)
            // 2. `manifest.data` (legacy/backward compat)
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
                
                // Check if data already seeded
                let existing = await ql.find(objectFQN);
                if (existing && (existing as any).value) existing = (existing as any).value;
                
                if (!existing || existing.length === 0) {
                    console.log(`[KernelFactory] Manual Seeding ${dataset.records.length} records for ${objectFQN}`);
                    for (const record of dataset.records) {
                        await ql.insert(objectFQN, record);
                    }
                } else {
                    console.log(`[KernelFactory] Data verified present for ${objectFQN}: ${existing.length} records.`);
                }
            }
        }
    }

    return kernel;
}
