// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { z } from 'zod';

/**
 * AI Agent Action Protocol
 * 
 * Defines how AI agents can interact with the UI by mapping natural language intents
 * to structured UI actions. This enables agents to not only query data but also
 * manipulate the interface, navigate between views, and trigger workflows.
 * 
 * Architecture Alignment:
 * - Salesforce Einstein: Action recommendations and automated UI interactions
 * - ServiceNow Virtual Agent: UI action automation
 * - Microsoft Power Virtual Agents: Bot actions and UI integration
 * 
 * Use Cases:
 * - "Open the new account form" → Navigate to form view
 * - "Show me all active opportunities" → Navigate to list view with filter
 * - "Create a new task for John" → Open form with pre-filled data
 * - "Switch to the kanban view" → Change view mode
 */

// ==========================================
// UI Action Types
// ==========================================

/**
 * Navigation Action Types
 * Actions that change the current view or location
 */
import { lazySchema } from '../shared/lazy-schema';
export const NavigationActionTypeSchema = lazySchema(() => z.enum([
  'navigate_to_object_list',    // Navigate to object list view
  'navigate_to_object_form',    // Navigate to object form (new/edit)
  'navigate_to_record_detail',  // Navigate to specific record detail page
  'navigate_to_dashboard',      // Navigate to dashboard
  'navigate_to_report',         // Navigate to report view
  'navigate_to_app',            // Switch to different app
  'navigate_back',              // Go back to previous view
  'navigate_home',              // Go to home page
  'open_tab',                   // Open new tab
  'close_tab',                  // Close current tab
]));

export type NavigationActionType = z.infer<typeof NavigationActionTypeSchema>;

/**
 * View Manipulation Action Types
 * Actions that change how data is displayed
 */
export const ViewActionTypeSchema = lazySchema(() => z.enum([
  'change_view_mode',           // Switch between list/kanban/calendar/gantt
  'apply_filter',               // Apply filter to current view
  'clear_filter',               // Clear filters
  'apply_sort',                 // Apply sorting
  'change_grouping',            // Change grouping (for kanban/pivot)
  'show_columns',               // Show/hide columns
  'expand_record',              // Expand record in list
  'collapse_record',            // Collapse record in list
  'refresh_view',               // Refresh current view
  'export_data',                // Export view data
]));

export type ViewActionType = z.infer<typeof ViewActionTypeSchema>;

/**
 * Form Action Types
 * Actions that interact with forms
 */
export const FormActionTypeSchema = lazySchema(() => z.enum([
  'create_record',              // Create new record (submit form)
  'update_record',              // Update existing record
  'delete_record',              // Delete record
  'fill_field',                 // Fill a specific form field
  'clear_field',                // Clear a form field
  'submit_form',                // Submit the form
  'cancel_form',                // Cancel form editing
  'validate_form',              // Validate form data
  'save_draft',                 // Save as draft
]));

export type FormActionType = z.infer<typeof FormActionTypeSchema>;

/**
 * Data Action Types
 * Actions that perform data operations
 */
export const DataActionTypeSchema = lazySchema(() => z.enum([
  'select_record',              // Select record(s) in list
  'deselect_record',            // Deselect record(s)
  'select_all',                 // Select all records
  'deselect_all',               // Deselect all records
  'bulk_update',                // Bulk update selected records
  'bulk_delete',                // Bulk delete selected records
  'bulk_export',                // Bulk export selected records
]));

export type DataActionType = z.infer<typeof DataActionTypeSchema>;

/**
 * Workflow Action Types
 * Actions that trigger workflows or automations
 */
export const WorkflowActionTypeSchema = lazySchema(() => z.enum([
  'trigger_flow',               // Trigger a flow/workflow
  'trigger_approval',           // Start approval process
  'trigger_webhook',            // Trigger webhook
  'run_report',                 // Run a report
  'send_email',                 // Send email
  'send_notification',          // Send notification
  'schedule_task',              // Schedule a task
]));

export type WorkflowActionType = z.infer<typeof WorkflowActionTypeSchema>;

/**
 * UI Component Action Types
 * Actions that interact with UI components
 */
export const ComponentActionTypeSchema = lazySchema(() => z.enum([
  'open_modal',                 // Open modal dialog
  'close_modal',                // Close modal dialog
  'open_sidebar',               // Open sidebar panel
  'close_sidebar',              // Close sidebar panel
  'show_notification',          // Show toast/notification
  'hide_notification',          // Hide notification
  'open_dropdown',              // Open dropdown menu
  'close_dropdown',             // Close dropdown menu
  'toggle_section',             // Toggle collapsible section
]));

export type ComponentActionType = z.infer<typeof ComponentActionTypeSchema>;

/**
 * All UI Action Types Combined
 */
export const UIActionTypeSchema = lazySchema(() => z.union([
  NavigationActionTypeSchema,
  ViewActionTypeSchema,
  FormActionTypeSchema,
  DataActionTypeSchema,
  WorkflowActionTypeSchema,
  ComponentActionTypeSchema,
]));

export type UIActionType = z.infer<typeof UIActionTypeSchema>;

// ==========================================
// Action Parameters
// ==========================================

/**
 * Navigation Action Parameters
 */
export const NavigationActionParamsSchema = lazySchema(() => z.object({
  object: z.string().optional().describe('Object name (for object-specific navigation)'),
  recordId: z.string().optional().describe('Record ID (for detail page)'),
  viewType: z.enum(['list', 'form', 'detail', 'kanban', 'calendar', 'gantt']).optional(),
  dashboardId: z.string().optional().describe('Dashboard ID'),
  reportId: z.string().optional().describe('Report ID'),
  appName: z.string().optional().describe('App name'),
  mode: z.enum(['new', 'edit', 'view']).optional().describe('Form mode'),
  openInNewTab: z.boolean().optional().describe('Open in new tab'),
}));

export type NavigationActionParams = z.infer<typeof NavigationActionParamsSchema>;

/**
 * View Action Parameters
 */
export const ViewActionParamsSchema = lazySchema(() => z.object({
  viewMode: z.enum(['list', 'kanban', 'calendar', 'gantt', 'pivot']).optional(),
  filters: z.record(z.string(), z.unknown()).optional().describe('Filter conditions'),
  sort: z.array(z.object({
    field: z.string(),
    order: z.enum(['asc', 'desc']),
  })).optional(),
  groupBy: z.string().optional().describe('Field to group by'),
  columns: z.array(z.string()).optional().describe('Columns to show/hide'),
  recordId: z.string().optional().describe('Record to expand/collapse'),
  exportFormat: z.enum(['csv', 'xlsx', 'pdf', 'json']).optional(),
}));

export type ViewActionParams = z.infer<typeof ViewActionParamsSchema>;

/**
 * Form Action Parameters
 */
export const FormActionParamsSchema = lazySchema(() => z.object({
  object: z.string().optional().describe('Object name'),
  recordId: z.string().optional().describe('Record ID (for edit/delete)'),
  fieldValues: z.record(z.string(), z.unknown()).optional().describe('Field name-value pairs'),
  fieldName: z.string().optional().describe('Specific field to fill/clear'),
  fieldValue: z.unknown().optional().describe('Value to set'),
  validateOnly: z.boolean().optional().describe('Validate without saving'),
}));

export type FormActionParams = z.infer<typeof FormActionParamsSchema>;

/**
 * Data Action Parameters
 */
export const DataActionParamsSchema = lazySchema(() => z.object({
  recordIds: z.array(z.string()).optional().describe('Record IDs to select/operate on'),
  filters: z.record(z.string(), z.unknown()).optional().describe('Filter for bulk operations'),
  updateData: z.record(z.string(), z.unknown()).optional().describe('Data for bulk update'),
  exportFormat: z.enum(['csv', 'xlsx', 'pdf', 'json']).optional(),
}));

export type DataActionParams = z.infer<typeof DataActionParamsSchema>;

/**
 * Workflow Action Parameters
 */
export const WorkflowActionParamsSchema = lazySchema(() => z.object({
  flowName: z.string().optional().describe('Flow/workflow name'),
  approvalProcessName: z.string().optional().describe('Approval process name'),
  webhookUrl: z.string().optional().describe('Webhook URL'),
  reportName: z.string().optional().describe('Report name'),
  emailTemplate: z.string().optional().describe('Email template'),
  recipients: z.array(z.string()).optional().describe('Email recipients'),
  subject: z.string().optional().describe('Email subject'),
  message: z.string().optional().describe('Notification/email message'),
  taskData: z.record(z.string(), z.unknown()).optional().describe('Task creation data'),
  scheduleTime: z.string().optional().describe('Schedule time (ISO 8601)'),
  contextData: z.record(z.string(), z.unknown()).optional().describe('Additional context data'),
}));

export type WorkflowActionParams = z.infer<typeof WorkflowActionParamsSchema>;

/**
 * Component Action Parameters
 */
export const ComponentActionParamsSchema = lazySchema(() => z.object({
  componentId: z.string().optional().describe('Component ID'),
  modalConfig: z.object({
    title: z.string().optional(),
    content: z.unknown().optional(),
    size: z.enum(['small', 'medium', 'large', 'fullscreen']).optional(),
  }).optional(),
  notificationConfig: z.object({
    type: z.enum(['info', 'success', 'warning', 'error']).optional(),
    message: z.string(),
    duration: z.number().optional().describe('Duration in ms'),
  }).optional(),
  sidebarConfig: z.object({
    position: z.enum(['left', 'right']).optional(),
    width: z.string().optional(),
    content: z.unknown().optional(),
  }).optional(),
}));

export type ComponentActionParams = z.infer<typeof ComponentActionParamsSchema>;

// ==========================================
// Agent Action Schema
// ==========================================

/**
 * Agent UI Action Schema
 * Complete definition of an AI agent's UI action
 */
export const AgentActionSchema = lazySchema(() => z.object({
  /**
   * Action identifier (generated)
   */
  id: z.string().optional().describe('Unique action ID'),
  
  /**
   * Action type
   */
  type: UIActionTypeSchema.describe('Type of UI action to perform'),
  
  /**
   * Action parameters (discriminated union based on type)
   */
  params: z.union([
    NavigationActionParamsSchema,
    ViewActionParamsSchema,
    FormActionParamsSchema,
    DataActionParamsSchema,
    WorkflowActionParamsSchema,
    ComponentActionParamsSchema,
  ]).describe('Action-specific parameters'),
  
  /**
   * Confirmation requirement
   */
  requireConfirmation: z.boolean().default(false).describe('Require user confirmation before executing'),
  
  /**
   * Confirmation message
   */
  confirmationMessage: z.string().optional().describe('Message to show in confirmation dialog'),
  
  /**
   * Success message
   */
  successMessage: z.string().optional().describe('Message to show on success'),
  
  /**
   * Error handling
   */
  onError: z.enum(['retry', 'skip', 'abort']).default('abort').describe('Error handling strategy'),
  
  /**
   * Execution metadata
   */
  metadata: z.object({
    intent: z.string().optional().describe('Original user intent/query'),
    confidence: z.number().min(0).max(1).optional().describe('Confidence score (0-1)'),
    agentName: z.string().optional().describe('Agent that generated this action'),
    timestamp: z.string().datetime().optional().describe('Generation timestamp (ISO 8601)'),
  }).optional(),
}));

/**
 * Agent Action Typed Schemas
 * Bind params to specific action types for type safety
 */
export const NavigationAgentActionSchema = lazySchema(() => AgentActionSchema.extend({
  type: NavigationActionTypeSchema,
  params: NavigationActionParamsSchema,
}));

export const ViewAgentActionSchema = lazySchema(() => AgentActionSchema.extend({
  type: ViewActionTypeSchema,
  params: ViewActionParamsSchema,
}));

export const FormAgentActionSchema = lazySchema(() => AgentActionSchema.extend({
  type: FormActionTypeSchema,
  params: FormActionParamsSchema,
}));

export const DataAgentActionSchema = lazySchema(() => AgentActionSchema.extend({
  type: DataActionTypeSchema,
  params: DataActionParamsSchema,
}));

export const WorkflowAgentActionSchema = lazySchema(() => AgentActionSchema.extend({
  type: WorkflowActionTypeSchema,
  params: WorkflowActionParamsSchema,
}));

export const ComponentAgentActionSchema = lazySchema(() => AgentActionSchema.extend({
  type: ComponentActionTypeSchema,
  params: ComponentActionParamsSchema,
}));

/**
 * Typed Agent Action Union
 * Replaces the generic AgentActionSchema for stricter typing where possible
 */
export const TypedAgentActionSchema = lazySchema(() => z.union([
  NavigationAgentActionSchema,
  ViewAgentActionSchema,
  FormAgentActionSchema,
  DataAgentActionSchema,
  WorkflowAgentActionSchema,
  ComponentAgentActionSchema,
]));

export type AgentAction = z.infer<typeof TypedAgentActionSchema>;

/**
 * Agent Action Sequence Schema
 * Multiple actions to be executed in sequence
 */
export const AgentActionSequenceSchema = lazySchema(() => z.object({
  /**
   * Sequence identifier
   */
  id: z.string().optional().describe('Unique sequence ID'),
  
  /**
   * Actions to execute
   */
  actions: z.array(AgentActionSchema).describe('Ordered list of actions'),
  
  /**
   * Execution mode
   */
  mode: z.enum(['sequential', 'parallel']).default('sequential').describe('Execution mode'),
  
  /**
   * Stop on first error
   */
  stopOnError: z.boolean().default(true).describe('Stop sequence on first error'),
  
  /**
   * Transaction mode (all-or-nothing)
   */
  atomic: z.boolean().default(false).describe('Transaction mode (all-or-nothing)'),

  startTime: z.string().datetime().optional().describe('Execution start time (ISO 8601)'),

  endTime: z.string().datetime().optional().describe('Execution end time (ISO 8601)'),
  /**
   * Metadata
   */
  metadata: z.object({
    intent: z.string().optional().describe('Original user intent'),
    confidence: z.number().min(0).max(1).optional().describe('Overall confidence score'),
    agentName: z.string().optional().describe('Agent that generated this sequence'),
  }).optional(),
}));

export type AgentActionSequence = z.infer<typeof AgentActionSequenceSchema>;

/**
 * Agent Action Result Schema
 * Result of executing an agent action
 */
export const AgentActionResultSchema = lazySchema(() => z.object({
  /**
   * Action ID
   */
  actionId: z.string().describe('ID of the executed action'),
  
  /**
   * Execution status
   */
  status: z.enum(['success', 'error', 'cancelled', 'pending']).describe('Execution status'),
  
  /**
   * Result data
   */
  data: z.unknown().optional().describe('Action result data'),
  
  /**
   * Error information
   */
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }).optional().describe('Error details if status is "error"'),
  
  /**
   * Execution metadata
   */
  metadata: z.object({
    startTime: z.string().optional().describe('Execution start time (ISO 8601)'),
    endTime: z.string().optional().describe('Execution end time (ISO 8601)'),
    duration: z.number().optional().describe('Execution duration in ms'),
  }).optional(),
}));

export type AgentActionResult = z.infer<typeof AgentActionResultSchema>;

/**
 * Agent Action Sequence Result Schema
 * Result of executing an action sequence
 */
export const AgentActionSequenceResultSchema = lazySchema(() => z.object({
  /**
   * Sequence ID
   */
  sequenceId: z.string().describe('ID of the executed sequence'),
  
  /**
   * Overall status
   */
  status: z.enum(['success', 'partial_success', 'error', 'cancelled']).describe('Overall execution status'),
  
  /**
   * Individual action results
   */
  results: z.array(AgentActionResultSchema).describe('Results for each action'),
  
  /**
   * Summary
   */
  summary: z.object({
    total: z.number().describe('Total number of actions'),
    successful: z.number().describe('Number of successful actions'),
    failed: z.number().describe('Number of failed actions'),
    cancelled: z.number().describe('Number of cancelled actions'),
  }),
  
  /**
   * Execution metadata
   */
  metadata: z.object({
    startTime: z.string().optional(),
    endTime: z.string().optional(),
    totalDuration: z.number().optional().describe('Total execution time in ms'),
  }).optional(),
}));

export type AgentActionSequenceResult = z.infer<typeof AgentActionSequenceResultSchema>;

// ==========================================
// Helper Schemas
// ==========================================

/**
 * Intent to Action Mapping Schema
 * Maps natural language intent patterns to UI actions
 */
export const IntentActionMappingSchema = lazySchema(() => z.object({
  /**
   * Intent pattern (regex or exact match)
   */
  intent: z.string().describe('Intent pattern (e.g., "open_new_record_form")'),
  
  /**
   * Intent examples (for training)
   */
  examples: z.array(z.string()).optional().describe('Example user queries'),
  
  /**
   * Action template
   */
  actionTemplate: AgentActionSchema.describe('Action to execute'),
  
  /**
   * Parameter extraction rules
   */
  paramExtraction: z.record(z.string(), z.object({
    type: z.enum(['entity', 'slot', 'context']),
    required: z.boolean().default(false),
    default: z.unknown().optional(),
  })).optional().describe('Rules for extracting parameters from user input'),
  
  /**
   * Confidence threshold
   */
  minConfidence: z.number().min(0).max(1).default(0.7).describe('Minimum confidence to execute'),
}));

export type IntentActionMapping = z.infer<typeof IntentActionMappingSchema>;
