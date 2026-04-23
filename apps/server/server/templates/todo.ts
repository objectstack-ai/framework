// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { ProjectTemplate } from './types.js';

const dyn = (spec: string) =>
    (new Function('s', 'return import(s)') as (s: string) => Promise<any>)(spec);

export const todoTemplate: ProjectTemplate = {
    id: 'todo',
    label: 'Todo List',
    description: 'Lightweight task tracker — single-object example.',
    category: 'starter',
    async load() {
        const mod = await dyn('../../../../examples/app-todo/objectstack.config.ts');
        return mod.default;
    },
};
