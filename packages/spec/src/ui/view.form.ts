// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * View — canonical FormView layout.
 *
 * Views power most data surfaces (grid / kanban / calendar / gantt /
 * gallery / timeline / chart) and each surface has its own block of
 * options. We group fields by surface so the editor doesn't dump 30+
 * irrelevant knobs on the user.
 *
 * Visibility predicates use the `type` discriminator to reveal only
 * the surface-specific block.
 */

import { defineForm } from './view.zod';

export const viewForm = defineForm({
  schemaId: 'view',
  type: 'tabbed',
  sections: [
    {
      label: 'Basics',
      description: 'Identity and primary surface.',
      fields: [
        { field: 'name', required: true, helpText: 'snake_case, unique per environment' },
        { field: 'label', required: true },
        { field: 'description' },
        { field: 'type', required: true, helpText: 'Primary view surface' },
        { field: 'data', widget: 'json', helpText: 'Data source (defaults to "object" provider)' },
      ],
    },
    {
      label: 'Columns & filters',
      description: 'What rows show and how users filter them.',
      fields: [
        { field: 'columns', widget: 'master-detail', required: true },
        { field: 'filter', widget: 'filter-builder' },
        { field: 'sort', widget: 'json' },
        { field: 'searchableFields', widget: 'json' },
        { field: 'filterableFields', widget: 'json' },
      ],
    },
    {
      label: 'Table options',
      description: 'Grid-only display options.',
      visibleOn: "data.type == 'grid' || data.type == null",
      fields: [
        { field: 'resizable' },
        { field: 'striped' },
        { field: 'bordered' },
        { field: 'compactToolbar' },
        { field: 'rowHeight' },
        { field: 'selection', widget: 'json' },
        { field: 'pagination', widget: 'json' },
      ],
    },
    {
      label: 'Kanban',
      visibleOn: "data.type == 'kanban'",
      fields: [{ field: 'kanban', widget: 'json' }],
    },
    {
      label: 'Calendar',
      visibleOn: "data.type == 'calendar'",
      fields: [{ field: 'calendar', widget: 'json' }],
    },
    {
      label: 'Gantt',
      visibleOn: "data.type == 'gantt'",
      fields: [{ field: 'gantt', widget: 'json' }],
    },
    {
      label: 'Gallery',
      visibleOn: "data.type == 'gallery'",
      fields: [{ field: 'gallery', widget: 'json' }],
    },
    {
      label: 'Timeline',
      visibleOn: "data.type == 'timeline'",
      fields: [{ field: 'timeline', widget: 'json' }],
    },
    {
      label: 'Chart',
      visibleOn: "data.type == 'chart'",
      fields: [{ field: 'chart', widget: 'chart-config' }],
    },
    {
      label: 'Navigation & sharing',
      fields: [
        { field: 'navigation', widget: 'json' },
        { field: 'sharing', widget: 'json' },
      ],
    },
  ],
});
