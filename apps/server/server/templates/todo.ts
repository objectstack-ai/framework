// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

// Static relative import — bundle-require/esbuild inlines the Todo bundle
// into the server's bundled config at boot time, so seeding does not rely
// on Node resolving a `.ts` file at runtime (which `@example/app-todo`
// would require, because workspace packages are marked external by the
// CLI's bundler).
import todoBundle from '../../../../examples/app-todo/objectstack.config';
import type { ProjectTemplate } from './types.js';

export const todoTemplate: ProjectTemplate = {
    id: 'todo',
    label: 'Todo List',
    description: 'Lightweight task tracker — single-object example.',
    category: 'starter',
    async load() {
        return todoBundle;
    },
};
