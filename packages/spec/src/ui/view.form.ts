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
        { field: 'name', type: 'text', required: true, helpText: 'snake_case, unique per environment' },
        { field: 'label', type: 'text', required: true },
        { field: 'description', type: 'textarea' },
        { field: 'type', required: true, helpText: 'Primary view surface' },
        { field: 'objectName', widget: 'ref:object', required: true, helpText: 'Data source object' },
      ],
    },
    {
      label: 'Columns & filters',
      description: 'What rows show and how users filter them.',
      fields: [
        { field: 'columns', widget: 'master-detail', required: true, helpText: 'Columns to display (field names from selected object)' },
        { field: 'filter', widget: 'master-detail', helpText: 'Filter conditions' },
        { field: 'sort', widget: 'master-detail', helpText: 'Default sort order' },
        { field: 'searchableFields', widget: 'field-selector', multiple: true, dependsOn: 'objectName', helpText: 'Fields available for quick search' },
        { field: 'filterableFields', widget: 'field-selector', multiple: true, dependsOn: 'objectName', helpText: 'Fields available for filtering' },
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
        { field: 'selection', widget: 'object-fields' },
        { field: 'pagination', widget: 'object-fields' },
      ],
    },
    {
      label: 'Kanban',
      visibleOn: "data.type == 'kanban'",
      fields: [{ field: 'kanban', widget: 'object-fields' }],
    },
    {
      label: 'Calendar',
      visibleOn: "data.type == 'calendar'",
      fields: [{ field: 'calendar', widget: 'object-fields' }],
    },
    {
      label: 'Gantt',
      visibleOn: "data.type == 'gantt'",
      fields: [{ field: 'gantt', widget: 'object-fields' }],
    },
    {
      label: 'Gallery',
      visibleOn: "data.type == 'gallery'",
      fields: [{ field: 'gallery', widget: 'object-fields' }],
    },
    {
      label: 'Timeline',
      visibleOn: "data.type == 'timeline'",
      fields: [{ field: 'timeline', widget: 'object-fields' }],
    },
    {
      label: 'Chart',
      visibleOn: "data.type == 'chart'",
      fields: [{ field: 'chart', widget: 'object-fields' }],
    },
    {
      label: 'Navigation & sharing',
      fields: [
        { field: 'navigation', widget: 'object-fields' },
        { field: 'sharing', widget: 'object-fields' },
      ],
    },
  ],
});
