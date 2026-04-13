// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { z } from 'zod';
import { I18nLabelSchema, AriaPropsSchema } from './i18n.zod';

/**
 * Focus Trap Configuration Schema
 * Constrains keyboard focus within a specific container (e.g., modals, dialogs).
 */
export const FocusTrapConfigSchema = z.object({
  enabled: z.boolean().default(false).describe('Enable focus trapping within this container'),
  initialFocus: z.string().optional().describe('CSS selector for the element to focus on activation'),
  returnFocus: z.boolean().default(true).describe('Return focus to trigger element on deactivation'),
  escapeDeactivates: z.boolean().default(true).describe('Allow Escape key to deactivate the focus trap'),
}).describe('Focus trap configuration for modal-like containers');

export type FocusTrapConfig = z.infer<typeof FocusTrapConfigSchema>;

/**
 * Keyboard Shortcut Schema
 * Defines a single keyboard shortcut binding.
 */
export const KeyboardShortcutSchema = z.object({
  key: z.string().describe('Key combination (e.g., "Ctrl+S", "Alt+N", "Escape")'),
  action: z.string().describe('Action identifier to invoke when shortcut is triggered'),
  description: I18nLabelSchema.optional().describe('Human-readable description of what the shortcut does'),
  scope: z.enum(['global', 'view', 'form', 'modal', 'list']).default('global')
    .describe('Scope in which this shortcut is active'),
}).describe('Keyboard shortcut binding');

export type KeyboardShortcut = z.infer<typeof KeyboardShortcutSchema>;

/**
 * Focus Management Schema
 * Controls tab order, focus visibility, and navigation behavior.
 */
export const FocusManagementSchema = z.object({
  tabOrder: z.enum(['auto', 'manual']).default('auto')
    .describe('Tab order strategy: auto (DOM order) or manual (explicit tabIndex)'),
  skipLinks: z.boolean().default(false).describe('Provide skip-to-content navigation links'),
  focusVisible: z.boolean().default(true).describe('Show visible focus indicators for keyboard users'),
  focusTrap: FocusTrapConfigSchema.optional().describe('Focus trap settings'),
  arrowNavigation: z.boolean().default(false)
    .describe('Enable arrow key navigation between focusable items'),
}).describe('Focus and tab navigation management');

export type FocusManagement = z.infer<typeof FocusManagementSchema>;

/**
 * Keyboard Navigation Configuration Schema
 * Top-level keyboard navigation and shortcut configuration.
 */
export const KeyboardNavigationConfigSchema = z.object({
  shortcuts: z.array(KeyboardShortcutSchema).optional().describe('Registered keyboard shortcuts'),
  focusManagement: FocusManagementSchema.optional().describe('Focus and tab order management'),
  rovingTabindex: z.boolean().default(false)
    .describe('Enable roving tabindex pattern for composite widgets'),
}).merge(AriaPropsSchema.partial()).describe('Keyboard navigation and shortcut configuration');

export type KeyboardNavigationConfig = z.infer<typeof KeyboardNavigationConfigSchema>;
