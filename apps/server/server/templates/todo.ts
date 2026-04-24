// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { ProjectTemplate } from './types.js';

export const todoTemplate: ProjectTemplate = {
    id: 'todo',
    label: 'Todo List',
    description: 'Lightweight task tracker — single-object example.',
    category: 'starter',
    async load() {
        // Lazy import — see crm.ts for rationale.
        // @ts-ignore — outside tsconfig rootDir but safe under bundleRequire/esbuild
        const mod = await import('../../../../examples/app-todo/objectstack.config.js');
        return mod.default ?? mod;
    },
};
