// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { z } from 'zod';
import { FieldType } from '../data/field.zod';
import { SnakeCaseIdentifierSchema } from '../shared/identifiers.zod';
import { I18nLabelSchema, AriaPropsSchema } from './i18n.zod';

/**
 * Action Parameter Schema
 * Defines inputs required before executing an action.
 */
export const ActionParamSchema = z.object({
  name: z.string(),
  label: I18nLabelSchema,
  type: FieldType,
  required: z.boolean().default(false),
  options: z.array(z.object({ label: I18nLabelSchema, value: z.string() })).optional(),
});

/**
 * Action type enum values.
 */
export const ActionType = z.enum(['script', 'url', 'modal', 'flow', 'api']);

/**
 * Action types that require a `target` field.
 * Derived from ActionType, excluding 'script' which allows inline handlers.
 * These types reference an external resource (URL, flow, modal, or API endpoint)
 * and cannot function without a target binding.
 */
const TARGET_REQUIRED_TYPES: ReadonlySet<string> = new Set(
  ActionType.options.filter((t) => t !== 'script'),
);

/**
 * Action Schema
 * 
 * **NAMING CONVENTION:**
 * Action names are machine identifiers used in code and must be lowercase snake_case.
 * 
 * **TARGET BINDING:**
 * The `target` field is the canonical way to bind an action to its handler.
 * - `type: 'script'` — `target` is recommended (references a script/function name).
 * - `type: 'url'`    — `target` is **required** (the URL to navigate to).
 * - `type: 'flow'`   — `target` is **required** (the flow name to invoke).
 * - `type: 'modal'`  — `target` is **required** (the modal/page name to open).
 * - `type: 'api'`    — `target` is **required** (the API endpoint to call).
 * 
 * The `execute` field is **deprecated** and will be removed in a future version.
 * If `execute` is provided without `target`, it is automatically migrated to `target`.
 * 
 * @example Good action names
 * - 'on_close_deal'
 * - 'send_welcome_email'
 * - 'approve_contract'
 * - 'export_report'
 * 
 * @example Bad action names (will be rejected)
 * - 'OnCloseDeal' (PascalCase)
 * - 'sendEmail' (camelCase)
 * - 'Send Email' (spaces)
 * 
 * Note: The action name is the configuration ID. JavaScript function names can use camelCase,
 * but the metadata ID must be lowercase snake_case.
 */
export const ActionSchema = z.object({
  /** Machine name of the action */
  name: SnakeCaseIdentifierSchema.describe('Machine name (lowercase snake_case)'),
  
  /** Display label */
  label: I18nLabelSchema.describe('Display label'),

  /** Target object this action belongs to (optional, snake_case) */
  objectName: z.string().regex(/^[a-z_][a-z0-9_]*$/).optional().describe('Target object this action belongs to. When set, the action is auto-merged into the object\'s actions array by defineStack().'),
  
  /** Icon name (Lucide) */
  icon: z.string().optional().describe('Icon name'),

  /** Where does this action appear? */
  locations: z.array(z.enum([
    'list_toolbar', 'list_item', 
    'record_header', 'record_more', 'record_related',
    'global_nav'
  ])).optional().describe('Locations where this action is visible'),

  /** 
   * Visual Component Type
   * Defaults to 'button' or 'menu_item' based on location,
   * but can be overridden.
   */
  component: z.enum([
    'action:button', // Standard Button
    'action:icon',   // Icon only
    'action:menu',   // Dropdown menu
    'action:group'   // Button Group
  ]).optional().describe('Visual component override'),
  
  /** What type of interaction? */
  type: ActionType.default('script').describe('Action functionality type'),
  
  /** 
   * Payload / Target — the canonical binding for the action handler.
   * Required for url, flow, modal, and api types.
   * Recommended for script type.
   */
  target: z.string().optional().describe('URL, Script Name, Flow ID, or API Endpoint'),

  /** 
   * @deprecated Use `target` instead. This field is auto-migrated to `target` during parsing.
   */
  execute: z.string().optional().describe('@deprecated — Use target instead. Auto-migrated to target during parsing.'),
  
  /** User Input Requirements */
  params: z.array(ActionParamSchema).optional().describe('Input parameters required from user'),
  
  /** Visual Style */
  variant: z.enum(['primary', 'secondary', 'danger', 'ghost', 'link']).optional().describe('Button visual variant for styling (primary = highlighted, danger = destructive, ghost = transparent)'),

  /** UX Behavior */
  confirmText: I18nLabelSchema.optional().describe('Confirmation message before execution'),
  successMessage: I18nLabelSchema.optional().describe('Success message to show after execution'),
  refreshAfter: z.boolean().default(false).describe('Refresh view after execution'),
  
  /** Access */
  visible: z.string().optional().describe('Formula returning boolean'),
  disabled: z.union([z.boolean(), z.string()]).optional().describe('Whether the action is disabled, or a condition expression string'),

  /** Keyboard Shortcut */
  shortcut: z.string().optional().describe('Keyboard shortcut to trigger this action (e.g., "Ctrl+S")'),

  /** Bulk Operations */
  bulkEnabled: z.boolean().optional().describe('Whether this action can be applied to multiple selected records'),

  /** Execution */
  timeout: z.number().optional().describe('Maximum execution time in milliseconds for the action'),

  /** ARIA accessibility attributes */
  aria: AriaPropsSchema.optional().describe('ARIA accessibility attributes'),
}).transform((data) => {
  // Auto-migrate deprecated `execute` → `target` for backward compatibility
  if (data.execute && !data.target) {
    return { ...data, target: data.execute };
  }
  return data;
}).refine((data) => {
  // Require `target` for types that reference an external resource
  if (TARGET_REQUIRED_TYPES.has(data.type) && !data.target) {
    return false;
  }
  return true;
}, {
  message: "Action 'target' is required when type is 'url', 'flow', 'modal', or 'api'.",
  path: ['target'],
});

export type Action = z.infer<typeof ActionSchema>;
export type ActionParam = z.infer<typeof ActionParamSchema>;
export type ActionInput = z.input<typeof ActionSchema>;

/**
 * Action Factory Helper
 */
export const Action = {
  create: (config: z.input<typeof ActionSchema>): Action => ActionSchema.parse(config),
} as const;
