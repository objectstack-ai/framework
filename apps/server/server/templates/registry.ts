// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { blankTemplate } from './blank.js';
import { crmTemplate } from './crm.js';
import { todoTemplate } from './todo.js';
import type { ProjectTemplate } from './types.js';

export const templateRegistry: Record<string, ProjectTemplate> = {
    [blankTemplate.id]: blankTemplate,
    [crmTemplate.id]: crmTemplate,
    [todoTemplate.id]: todoTemplate,
};

export const DEFAULT_TEMPLATE_ID = 'blank';

export function listTemplates(): Array<Pick<ProjectTemplate, 'id' | 'label' | 'description' | 'category'>> {
    return Object.values(templateRegistry).map(({ id, label, description, category }) => ({
        id,
        label,
        description,
        category,
    }));
}

export type { ProjectTemplate } from './types.js';
