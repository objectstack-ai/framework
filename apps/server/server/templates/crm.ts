// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { fileURLToPath, pathToFileURL } from 'node:url';
import * as path from 'node:path';
import type { ProjectTemplate } from './types.js';

// Resolve the CRM bundle relative to THIS file so the path survives any
// compilation/build output layout. Using a file:// URL means we can hand
// the path to a dynamic import() without TypeScript trying to type-check
// the target (which lives outside apps/server's rootDir).
const HERE = path.dirname(fileURLToPath(import.meta.url));
const BUNDLE_PATH = path.resolve(HERE, '../../../../examples/app-crm/objectstack.config.ts');
const BUNDLE_URL = pathToFileURL(BUNDLE_PATH).href;

// Lazy dynamic import — the bundle's Zod evaluation is deferred until the
// template is actually selected, so a schema drift in the example cannot
// crash control-plane bootstrap.
const dyn = (spec: string): Promise<any> =>
    (new Function('s', 'return import(s)') as (s: string) => Promise<any>)(spec);

export const crmTemplate: ProjectTemplate = {
    id: 'crm',
    label: 'CRM Starter',
    description: 'Accounts, Contacts, Opportunities — full CRM example.',
    category: 'business',
    async load() {
        const mod = await dyn(BUNDLE_URL);
        // ESM default can be nested under `.default.default` when the
        // loader double-wraps (tsx + file:// URL). Unwrap defensively.
        return mod?.default?.manifest ? mod.default : (mod?.default?.default ?? mod?.default ?? mod);
    },
};
