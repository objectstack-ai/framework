// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { ProjectTemplate } from './types.js';

export const crmTemplate: ProjectTemplate = {
    id: 'crm',
    label: 'CRM Starter',
    description: 'Accounts, Contacts, Opportunities — full CRM example.',
    category: 'business',
    async load() {
        // Lazy import — only resolved when a project is provisioned from this template.
        // bundleRequire/esbuild inlines the module at bundle time but defers execution,
        // so the CRM metadata (~8k lines) is not loaded into the control-plane kernel
        // on server startup. The rootDir TS error below is a tsc-only constraint;
        // esbuild (used by bundleRequire) handles cross-root imports correctly.
        // @ts-ignore — outside tsconfig rootDir but safe under bundleRequire/esbuild
        const mod = await import('../../../../examples/app-crm/objectstack.config.js');
        return mod.default ?? mod;
    },
};
