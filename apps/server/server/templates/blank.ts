// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { ProjectTemplate } from './types.js';

export const blankTemplate: ProjectTemplate = {
    id: 'blank',
    label: 'Blank',
    description: 'Empty project — start from scratch.',
    category: 'starter',
    async load() {
        return { manifest: { id: 'blank', namespace: 'blank' }, objects: [] } as any;
    },
};
