// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { z } from 'zod';
import { SnakeCaseIdentifierSchema } from '../shared/identifiers.zod';
import { I18nLabelSchema, AriaPropsSchema } from './i18n.zod';
import { SharingConfigSchema } from './sharing.zod';

/**
 * HTTP Method Enum
 */
export const HttpMethodSchema = z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * HTTP Request Configuration for API Provider
 */
export const HttpRequestSchema = z.object({
  url: z.string().describe('API endpoint URL'),
  method: HttpMethodSchema.optional().default('GET').describe('HTTP method'),
  headers: z.record(z.string(), z.string()).optional().describe('Custom HTTP headers'),
  params: z.record(z.string(), z.unknown()).optional().describe('Query parameters'),
  body: z.unknown().optional().describe('Request body for POST/PUT/PATCH'),
});

/**
 * View Data Source Configuration
 * Supports three modes:
 * 1. 'object': Standard Protocol - Auto-connects to ObjectStack Metadata and Data APIs
 * 2. 'api': Custom API - Explicitly provided API URLs
 * 3. 'value': Static Data - Hardcoded data array
 */
export const ViewDataSchema = z.discriminatedUnion('provider', [
  z.object({
    provider: z.literal('object'),
    object: z.string().describe('Target object name'),
  }),
  z.object({
    provider: z.literal('api'),
    read: HttpRequestSchema.optional().describe('Configuration for fetching data'),
    write: HttpRequestSchema.optional().describe('Configuration for submitting data (for forms/editable tables)'),
  }),
  z.object({
    provider: z.literal('value'),
    items: z.array(z.unknown()).describe('Static data array'),
  }),
]);

/**
 * Column Summary Function Schema
 * Aggregation function for column footer (Airtable-style column summaries)
 */
export const ColumnSummarySchema = z.enum([
  'none',
  'count',
  'count_empty',
  'count_filled',
  'count_unique',
  'percent_empty',
  'percent_filled',
  'sum',
  'avg',
  'min',
  'max',
]).describe('Aggregation function for column footer summary');

/**
 * List Column Configuration Schema
 * Detailed configuration for individual list view columns
 */
export const ListColumnSchema = z.object({
  field: z.string().describe('Field name (snake_case)'),
  label: I18nLabelSchema.optional().describe('Display label override'),
  width: z.number().positive().optional().describe('Column width in pixels'),
  align: z.enum(['left', 'center', 'right']).optional().describe('Text alignment'),
  hidden: z.boolean().optional().describe('Hide column by default'),
  sortable: z.boolean().optional().describe('Allow sorting by this column'),
  resizable: z.boolean().optional().describe('Allow resizing this column'),
  wrap: z.boolean().optional().describe('Allow text wrapping'),
  type: z.string().optional().describe('Renderer type override (e.g., "currency", "date")'),

  /** Pinning (Airtable-style frozen columns) */
  pinned: z.enum(['left', 'right']).optional().describe('Pin/freeze column to left or right side'),

  /** Column Footer Summary (Airtable-style aggregation) */
  summary: ColumnSummarySchema.optional().describe('Footer aggregation function for this column'),

  /** Interaction */
  link: z.boolean().optional().describe('Functions as the primary navigation link (triggers View navigation)'),
  action: z.string().optional().describe('Registered Action ID to execute when clicked'),
});

/**
 * List View Selection Configuration
 */
export const SelectionConfigSchema = z.object({
  type: z.enum(['none', 'single', 'multiple']).default('none').describe('Selection mode'),
});

/**
 * List View Pagination Configuration
 */
export const PaginationConfigSchema = z.object({
  pageSize: z.number().int().positive().default(25).describe('Number of records per page'),
  pageSizeOptions: z.array(z.number().int().positive()).optional().describe('Available page size options'),
});

/**
 * Row Height / Density Schema (Airtable-style)
 * Controls the visual density of rows in a list view.
 */
export const RowHeightSchema = z.enum([
  'compact',     // Minimal padding, single line
  'short',       // Reduced padding
  'medium',      // Default padding
  'tall',        // Extra padding, multi-line preview
  'extra_tall',  // Maximum padding, rich content preview
]).describe('Row height / density setting for list view');

/**
 * Grouping Field Configuration
 * Defines a single grouping level for record grouping.
 */
export const GroupingFieldSchema = z.object({
  field: z.string().describe('Field name to group by'),
  order: z.enum(['asc', 'desc']).default('asc').describe('Group sort order'),
  collapsed: z.boolean().default(false).describe('Collapse groups by default'),
});

/**
 * Grouping Configuration Schema (Airtable-style)
 * Supports multi-level grouping for grid/gallery views.
 */
export const GroupingConfigSchema = z.object({
  fields: z.array(GroupingFieldSchema).min(1).describe('Fields to group by (supports up to 3 levels)'),
}).describe('Record grouping configuration');

/**
 * Gallery View Configuration (Airtable-style)
 * Configures card layout for gallery/card views.
 */
export const GalleryConfigSchema = z.object({
  coverField: z.string().optional().describe('Attachment/image field to display as card cover'),
  coverFit: z.enum(['cover', 'contain']).default('cover').describe('Image fit mode for card cover'),
  cardSize: z.enum(['small', 'medium', 'large']).default('medium').describe('Card size in gallery view'),
  titleField: z.string().optional().describe('Field to display as card title'),
  visibleFields: z.array(z.string()).optional().describe('Fields to display on card body'),
}).describe('Gallery/card view configuration');

/**
 * Timeline View Configuration (Airtable-style)
 * Configures timeline/chronological views.
 */
export const TimelineConfigSchema = z.object({
  startDateField: z.string().describe('Field for timeline item start date'),
  endDateField: z.string().optional().describe('Field for timeline item end date'),
  titleField: z.string().describe('Field to display as timeline item title'),
  groupByField: z.string().optional().describe('Field to group timeline rows'),
  colorField: z.string().optional().describe('Field to determine item color'),
  scale: z.enum(['hour', 'day', 'week', 'month', 'quarter', 'year']).default('week').describe('Default timeline scale'),
}).describe('Timeline view configuration');

/**
 * View Sharing Configuration (Airtable-style)
 * Defines who can see and modify a view.
 */
export const ViewSharingSchema = z.object({
  type: z.enum(['personal', 'collaborative']).default('collaborative').describe('View ownership type'),
  lockedBy: z.string().optional().describe('User who locked the view configuration'),
}).describe('View sharing and access configuration');

/**
 * Row Color Configuration (Airtable-style)
 * Defines how rows are colored based on field values.
 */
export const RowColorConfigSchema = z.object({
  field: z.string().describe('Field to derive color from (typically a select/status field)'),
  colors: z.record(z.string(), z.string()).optional().describe('Map of field value to color (hex/token)'),
}).describe('Row color configuration based on field values');

/**
 * Visualization Type Schema
 * Whitelist of visualization types the user can switch between.
 * Maps to Airtable's "Visualizations" setting in Appearance panel.
 */
export const VisualizationTypeSchema = z.enum([
  'grid',
  'kanban',
  'gallery',
  'calendar',
  'timeline',
  'gantt',
  'map',
]).describe('Visualization type that users can switch to');

/**
 * User Actions Configuration Schema (Airtable Interface parity)
 * Controls which interactive actions are available to users in the view toolbar.
 * Each boolean toggles the corresponding toolbar element on/off.
 *
 * @see Airtable Interface → "User actions" panel
 */
export const UserActionsConfigSchema = z.object({
  sort: z.boolean().default(true).describe('Allow users to sort records'),
  search: z.boolean().default(true).describe('Allow users to search records'),
  filter: z.boolean().default(true).describe('Allow users to filter records'),
  rowHeight: z.boolean().default(true).describe('Allow users to toggle row height/density'),
  addRecordForm: z.boolean().default(false).describe('Add records through a form instead of inline'),
  buttons: z.array(z.string()).optional().describe('Custom action button IDs to show in the toolbar'),
}).describe('User action toggles for the view toolbar');

/**
 * Appearance Configuration Schema (Airtable Interface parity)
 * Controls visual presentation options for the view.
 *
 * @see Airtable Interface → "Appearance" panel
 */
export const AppearanceConfigSchema = z.object({
  showDescription: z.boolean().default(true).describe('Show the view description text'),
  allowedVisualizations: z.array(VisualizationTypeSchema).optional()
    .describe('Whitelist of visualization types users can switch between (e.g. ["grid", "gallery", "kanban"])'),
}).describe('Appearance and visualization configuration');

/**
 * View Tab Schema (Airtable Interface parity)
 * Defines a tab in a multi-tab view interface.
 * Each tab references a named list view and can be ordered, pinned, or set as default.
 *
 * @see Airtable Interface → "Tabs" panel
 */
export const ViewTabSchema = z.object({
  name: SnakeCaseIdentifierSchema.describe('Tab identifier (snake_case)'),
  label: I18nLabelSchema.optional().describe('Display label'),
  icon: z.string().optional().describe('Tab icon name'),
  view: z.string().optional().describe('Referenced list view name from listViews'),
  filter: z.array(z.unknown()).optional().describe('Tab-specific filter criteria'),
  order: z.number().int().min(0).optional().describe('Tab display order'),
  pinned: z.boolean().default(false).describe('Pin tab (cannot be removed by users)'),
  isDefault: z.boolean().default(false).describe('Set as the default active tab'),
  visible: z.boolean().default(true).describe('Tab visibility'),
}).describe('Tab configuration for multi-tab view interface');

/**
 * Add Record Configuration Schema (Airtable Interface parity)
 * Configures the "Add Record" entry point for a list view.
 *
 * @see Airtable Interface → "+ Add record" button
 */
export const AddRecordConfigSchema = z.object({
  enabled: z.boolean().default(true).describe('Show the add record entry point'),
  position: z.enum(['top', 'bottom', 'both']).default('bottom').describe('Position of the add record button'),
  mode: z.enum(['inline', 'form', 'modal']).default('inline').describe('How to add a new record'),
  formView: z.string().optional().describe('Named form view to use when mode is "form" or "modal"'),
}).describe('Add record entry point configuration');

/**
 * Kanban Settings
 */
export const KanbanConfigSchema = z.object({
  groupByField: z.string().describe('Field to group columns by (usually status/select)'),
  summarizeField: z.string().optional().describe('Field to sum at top of column (e.g. amount)'),
  columns: z.array(z.string()).describe('Fields to show on cards'),
});

/**
 * Calendar Settings
 */
export const CalendarConfigSchema = z.object({
  startDateField: z.string(),
  endDateField: z.string().optional(),
  titleField: z.string(),
  colorField: z.string().optional(),
});

/**
 * Gantt Settings
 */
export const GanttConfigSchema = z.object({
  startDateField: z.string(),
  endDateField: z.string(),
  titleField: z.string(),
  progressField: z.string().optional(),
  dependenciesField: z.string().optional(),
});

/**
 * Navigation Mode Enum
 * Defines how to navigate to the detail view from a list item.
 */
export const NavigationModeSchema = z.enum([
  'page',       // Navigate to a new route (default)
  'drawer',     // Open details in a side drawer/panel
  'modal',      // Open details in a modal dialog
  'split',      // Show details side-by-side with the list (master-detail)
  'popover',    // Show details in a popover (lightweight)
  'new_window', // Open in new browser tab/window
  'none'        // No navigation (read-only list)
]);

/**
 * Navigation Configuration Schema
 */
export const NavigationConfigSchema = z.object({
  mode: NavigationModeSchema.default('page'),
  
  /** Target View Config */
  view: z.string().optional().describe('Name of the form view to use for details (e.g. "summary_view", "edit_form")'),
  
  /** Interaction Triggers */
  preventNavigation: z.boolean().default(false).describe('Disable standard navigation entirely'),
  openNewTab: z.boolean().default(false).describe('Force open in new tab (applies to page mode)'),
  
  /** Dimensions (for modal/drawer) */
  width: z.union([z.string(), z.number()]).optional().describe('Width of the drawer/modal (e.g. "600px", "50%")'),
});

/**
 * List View Schema (Expanded)
 * Defines how a collection of records is displayed to the user.
 * 
 * **NAMING CONVENTION:**
 * View names (when provided) are machine identifiers and must be lowercase snake_case.
 * 
 * @example Standard Grid
 * {
 *   name: "all_active",
 *   label: "All Active",
 *   type: "grid",
 *   columns: ["name", "status", "created_at"],
 *   filter: [["status", "=", "active"]]
 * }
 * 
 * @example Kanban Board
 * {
 *   type: "kanban",
 *   columns: ["name", "amount"],
 *   kanban: {
 *     groupByField: "stage",
 *     summarizeField: "amount",
 *     columns: ["name", "close_date"]
 *   }
 * }
 */
export const ListViewSchema = z.object({
  name: SnakeCaseIdentifierSchema.optional().describe('Internal view name (lowercase snake_case)'),
  label: I18nLabelSchema.optional(), // Display label override (supports i18n)
  type: z.enum([
    'grid',       // Standard Data Table
    'kanban',     // Board / Columns
    'gallery',    // Card Deck / Masonry
    'calendar',   // Monthly/Weekly/Daily
    'timeline',   // Chronological Stream (Feed)
    'gantt',      // Project Timeline
    'map'         // Geospatial
  ]).default('grid'),
  
  /** Data Source Configuration */
  data: ViewDataSchema.optional().describe('Data source configuration (defaults to "object" provider)'),
  
  /** Shared Query Config */
  columns: z.union([
    z.array(z.string()), // Legacy: simple field names
    z.array(ListColumnSchema), // Enhanced: detailed column config
  ]).describe('Fields to display as columns'),
  filter: z.array(z.unknown()).optional().describe('Filter criteria (JSON Rules)'),
  sort: z.union([
    z.string(), //Legacy "field desc"
    z.array(z.object({
      field: z.string(),
      order: z.enum(['asc', 'desc'])
    }))
  ]).optional(),
  
  /** Search & Filter */
  searchableFields: z.array(z.string()).optional().describe('Fields enabled for search'),
  filterableFields: z.array(z.string()).optional().describe('Fields enabled for end-user filtering in the top bar'),

  /** Quick Filters (One-click filter chips, Salesforce ListFilter pattern) */
  quickFilters: z.array(z.object({
    field: z.string().describe('Field name to filter by'),
    label: z.string().optional().describe('Display label for the chip'),
    operator: z.enum(['equals', 'not_equals', 'contains', 'in', 'is_null', 'is_not_null']).default('equals').describe('Filter operator'),
    value: z.unknown().optional().describe('Preset filter value'),
  })).optional().describe('One-click filter chips for quick record filtering'),

  /** Grid Features */
  resizable: z.boolean().optional().describe('Enable column resizing'),
  striped: z.boolean().optional().describe('Striped row styling'),
  bordered: z.boolean().optional().describe('Show borders'),

  /** Selection */
  selection: SelectionConfigSchema.optional().describe('Row selection configuration'),

  /** Navigation / Interaction */
  navigation: NavigationConfigSchema.optional().describe('Configuration for item click navigation (page, drawer, modal, etc.)'),

  /** Pagination */
  pagination: PaginationConfigSchema.optional().describe('Pagination configuration'),

  /** Type Specific Config */
  kanban: KanbanConfigSchema.optional(),
  calendar: CalendarConfigSchema.optional(),
  gantt: GanttConfigSchema.optional(),
  gallery: GalleryConfigSchema.optional(),
  timeline: TimelineConfigSchema.optional(),

  /** View Metadata (Airtable-style view management) */
  description: I18nLabelSchema.optional().describe('View description for documentation/tooltips'),
  sharing: ViewSharingSchema.optional().describe('View sharing and access configuration'),

  /** Row Height / Density (Airtable-style) */
  rowHeight: RowHeightSchema.optional().describe('Row height / density setting'),

  /** Record Grouping (Airtable-style) */
  grouping: GroupingConfigSchema.optional().describe('Group records by one or more fields'),

  /** Row Color (Airtable-style) */
  rowColor: RowColorConfigSchema.optional().describe('Color rows based on field value'),

  /** Field Visibility & Ordering per View (Airtable-style) */
  hiddenFields: z.array(z.string()).optional().describe('Fields to hide in this specific view'),
  fieldOrder: z.array(z.string()).optional().describe('Explicit field display order for this view'),

  /** Row & Bulk Actions */
  rowActions: z.array(z.string()).optional().describe('Actions available for individual row items'),
  bulkActions: z.array(z.string()).optional().describe('Actions available when multiple rows are selected'),

  /** Performance */
  virtualScroll: z.boolean().optional().describe('Enable virtual scrolling for large datasets'),

  /** Conditional Formatting */
  conditionalFormatting: z.array(z.object({
    condition: z.string().describe('Condition expression to evaluate'),
    style: z.record(z.string(), z.string()).describe('CSS styles to apply when condition is true'),
  })).optional().describe('Conditional formatting rules for list rows'),

  /** Inline Edit */
  inlineEdit: z.boolean().optional().describe('Allow inline editing of records directly in the list view'),

  /** Export */
  exportOptions: z.array(z.enum(['csv', 'xlsx', 'pdf', 'json'])).optional().describe('Available export format options'),

  /** User Actions (Airtable Interface parity) */
  userActions: UserActionsConfigSchema.optional().describe('User action toggles for the view toolbar'),

  /** Appearance (Airtable Interface parity) */
  appearance: AppearanceConfigSchema.optional().describe('Appearance and visualization configuration'),

  /** Tabs (Airtable Interface parity) */
  tabs: z.array(ViewTabSchema).optional().describe('Tab definitions for multi-tab view interface'),

  /** Add Record (Airtable Interface parity) */
  addRecord: AddRecordConfigSchema.optional().describe('Add record entry point configuration'),

  /** Record Count Display (Airtable Interface parity) */
  showRecordCount: z.boolean().optional().describe('Show record count at the bottom of the list'),

  /** Advanced: Allow Printing (Airtable Interface parity) */
  allowPrinting: z.boolean().optional().describe('Allow users to print the view'),

  /** Empty State */
  emptyState: z.object({
    title: I18nLabelSchema.optional(),
    message: I18nLabelSchema.optional(),
    icon: z.string().optional(),
  }).optional().describe('Empty state configuration when no records found'),

  /** ARIA accessibility attributes */
  aria: AriaPropsSchema.optional().describe('ARIA accessibility attributes for the list view'),
});

/**
 * Form Field Configuration Schema
 * Detailed configuration for individual form fields
 */
export const FormFieldSchema = z.object({
  field: z.string().describe('Field name (snake_case)'),
  label: I18nLabelSchema.optional().describe('Display label override'),
  placeholder: I18nLabelSchema.optional().describe('Placeholder text'),
  helpText: I18nLabelSchema.optional().describe('Help/hint text'),
  readonly: z.boolean().optional().describe('Read-only override'),
  required: z.boolean().optional().describe('Required override'),
  hidden: z.boolean().optional().describe('Hidden override'),
  colSpan: z.number().int().min(1).max(4).optional().describe('Column span in grid layout (1-4)'),
  widget: z.string().optional().describe('Custom widget/component name'),
  dependsOn: z.string().optional().describe('Parent field name for cascading'),
  visibleOn: z.string().optional().describe('Visibility condition expression'),
});

/**
 * Form Layout Section
 */
export const FormSectionSchema = z.object({
  label: I18nLabelSchema.optional(),
  collapsible: z.boolean().default(false),
  collapsed: z.boolean().default(false),
  columns: z.enum(['1', '2', '3', '4']).default('2').transform(val => parseInt(val) as 1 | 2 | 3 | 4),
  fields: z.array(z.union([
    z.string(), // Legacy: simple field name
    FormFieldSchema, // Enhanced: detailed field config
  ])),
});

/**
 * Form View Schema
 * Defines the layout for creating or editing a single record.
 * 
 * @example Simple Sectioned Form
 * {
 *   type: "simple",
 *   sections: [
 *     {
 *       label: "General Info",
 *       columns: 2,
 *       fields: ["name", "status"]
 *     },
 *     {
 *       label: "Details",
 *       fields: ["description", { field: "priority", widget: "rating" }]
 *     }
 *   ]
 * }
 */
export const FormViewSchema = z.object({
  type: z.enum([
    'simple',  // Single column or sections
    'tabbed',  // Tabs
    'wizard',  // Step by step
    'split',   // Master-Detail split
    'drawer',  // Side panel
    'modal'    // Dialog
  ]).default('simple'),
  
  /** Data Source Configuration */
  data: ViewDataSchema.optional().describe('Data source configuration (defaults to "object" provider)'),
  
  sections: z.array(FormSectionSchema).optional(), // For simple layout
  groups: z.array(FormSectionSchema).optional(), // Legacy support -> alias to sections

  /** Default Sort for Related Lists (e.g., sort child records by date) */
  defaultSort: z.array(z.object({
    field: z.string().describe('Field name to sort by'),
    order: z.enum(['asc', 'desc']).default('desc').describe('Sort direction'),
  })).optional().describe('Default sort order for related list views within this form'),

  /** Public form sharing configuration */
  sharing: SharingConfigSchema.optional().describe('Public sharing configuration for this form'),

  /** ARIA accessibility attributes */
  aria: AriaPropsSchema.optional().describe('ARIA accessibility attributes for the form view'),
});

/**
 * Master View Schema
 * Can define multiple named views.
 */
/**
 * View Container Schema
 * Aggregates all view definitions for a specific object or context.
 * 
 * @example
 * {
 *   list: { type: "grid", columns: ["name"] },
 *   form: { type: "simple", fields: ["name"] },
 *   listViews: {
 *     "all": { label: "All", filter: [] },
 *     "my": { label: "Mine", filter: [["owner", "=", "{user_id}"]] }
 *   }
 * }
 */
export const ViewSchema = z.object({
    list: ListViewSchema.optional(), // Default list view
    form: FormViewSchema.optional(), // Default form view
    listViews: z.record(z.string(), ListViewSchema).optional().describe('Additional named list views'),
    formViews: z.record(z.string(), FormViewSchema).optional().describe('Additional named form views'),
});

/**
 * Type-safe factory for creating view definitions.
 *
 * Validates the config at creation time using Zod `.parse()`.
 *
 * @example
 * ```ts
 * const taskViews = defineView({
 *   list: {
 *     type: 'grid',
 *     data: { provider: 'object', object: 'task' },
 *     columns: ['subject', 'status', 'priority', 'due_date'],
 *   },
 *   form: {
 *     type: 'simple',
 *     sections: [{ label: 'Details', fields: [{ field: 'subject' }] }],
 *   },
 * });
 * ```
 */
export function defineView(config: z.input<typeof ViewSchema>): View {
  return ViewSchema.parse(config);
}

export type View = z.infer<typeof ViewSchema>;
export type ListView = z.infer<typeof ListViewSchema>;
export type FormView = z.infer<typeof FormViewSchema>;
export type FormSection = z.infer<typeof FormSectionSchema>;
export type ListColumn = z.infer<typeof ListColumnSchema>;
export type FormField = z.infer<typeof FormFieldSchema>;
export type SelectionConfig = z.infer<typeof SelectionConfigSchema>;
export type NavigationConfig = z.infer<typeof NavigationConfigSchema>;
export type PaginationConfig = z.infer<typeof PaginationConfigSchema>;
export type ViewData = z.infer<typeof ViewDataSchema>;
export type HttpRequest = z.infer<typeof HttpRequestSchema>;
export type HttpMethod = z.infer<typeof HttpMethodSchema>;
export type ColumnSummary = z.infer<typeof ColumnSummarySchema>;
export type RowHeight = z.infer<typeof RowHeightSchema>;
export type GroupingConfig = z.infer<typeof GroupingConfigSchema>;
export type GalleryConfig = z.infer<typeof GalleryConfigSchema>;
export type TimelineConfig = z.infer<typeof TimelineConfigSchema>;
export type ViewSharing = z.infer<typeof ViewSharingSchema>;
export type RowColorConfig = z.infer<typeof RowColorConfigSchema>;
export type VisualizationType = z.infer<typeof VisualizationTypeSchema>;
export type UserActionsConfig = z.infer<typeof UserActionsConfigSchema>;
export type AppearanceConfig = z.infer<typeof AppearanceConfigSchema>;
export type ViewTab = z.infer<typeof ViewTabSchema>;
export type AddRecordConfig = z.infer<typeof AddRecordConfigSchema>;
