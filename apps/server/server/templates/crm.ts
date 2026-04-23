// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

// Static relative import — bundle-require/esbuild inlines the CRM bundle
// into the server's bundled config at boot time, so seeding does not rely
// on Node resolving a `.ts` file at runtime (which `@example/app-crm`
// would require, because workspace packages are marked external by the
// CLI's bundler).
import crmBundle from '../../../../examples/app-crm/objectstack.config';
import type { ProjectTemplate } from './types.js';

export const crmTemplate: ProjectTemplate = {
    id: 'crm',
    label: 'CRM Starter',
    description: 'Accounts, Contacts, Opportunities — full CRM example.',
    category: 'business',
    async load() {
        return crmBundle;
    },
};
