/**
 * Form layout for the Report metadata editor.
 *
 * Bound to {@link ReportSchema} via `data.provider = 'schema'`. The
 * `@object-ui/plugin-form` renderer resolves field metadata from the
 * Zod-derived JSON Schema served by `/api/v1/meta` and applies the
 * widget/visibility hints declared here.
 */

import { defineForm } from './view.zod';

export const reportForm = defineForm({
  schemaId: 'report',
  type: 'simple',
  sections: [
    {
      label: 'Basics',
      description: 'Identity and data source.',
      columns: 2,
      fields: [
        { field: 'name', type: 'text', colSpan: 1, required: true, helpText: 'snake_case unique identifier' },
        { field: 'label', type: 'text', colSpan: 1, required: true },
        { field: 'description', type: 'textarea', colSpan: 2 },
        { field: 'objectName', widget: 'ref:object', colSpan: 1, helpText: 'Data source object' },
        { field: 'type', colSpan: 1, helpText: 'Report type: tabular/summary/matrix/joined' },
      ],
    },
    {
      label: 'Columns',
      description: 'Columns shown in the report output.',
      fields: [
        { field: 'columns', widget: 'master-detail', helpText: 'Columns to display in the report' },
      ],
    },
    {
      label: 'Groupings',
      description: 'How rows (and columns, for matrix reports) are grouped.',
      fields: [
        { field: 'groupingsDown', widget: 'master-detail', helpText: 'Row grouping levels' },
        // CEL visibility — only Matrix reports use column groupings.
        { field: 'groupingsAcross', widget: 'master-detail', visibleOn: "data.type == 'matrix'", helpText: 'Column grouping levels (matrix only)' },
      ],
    },
    {
      label: 'Joined blocks',
      description: 'Additional blocks joined into a single report (joined reports only).',
      visibleOn: "data.type == 'joined'",
      fields: [
        { field: 'blocks', widget: 'master-detail', helpText: 'Join multiple objects (joined report only)' },
      ],
    },
    {
      label: 'Filter & chart',
      description: 'Report-level filters and chart presentation.',
      collapsible: true,
      collapsed: true,
      fields: [
        { field: 'filter', widget: 'master-detail', helpText: 'Report-level filters' },
        { field: 'chart', type: 'composite', helpText: 'Chart config (type, legend, colors)' },
      ],
    },
    {
      label: 'Advanced',
      description: 'Accessibility and performance tuning.',
      collapsible: true,
      collapsed: true,
      fields: [
        { field: 'aria', type: 'composite', helpText: 'Accessibility labels' },
        { field: 'performance', type: 'composite', helpText: 'Caching and optimization' },
      ],
    },
  ],
});
