// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { z } from 'zod';
import { I18nLabelSchema, AriaPropsSchema } from './i18n.zod';

/**
 * Notification Type Schema
 * Defines the visual presentation style of the notification.
 */
import { lazySchema } from '../shared/lazy-schema';
export const NotificationTypeSchema = lazySchema(() => z.enum([
  'toast',
  'snackbar',
  'banner',
  'alert',
  'inline',
]).describe('Notification presentation style'));

export type NotificationType = z.infer<typeof NotificationTypeSchema>;

/**
 * Notification Severity Schema
 * Indicates the urgency and visual treatment of the notification.
 */
export const NotificationSeveritySchema = lazySchema(() => z.enum([
  'info',
  'success',
  'warning',
  'error',
]).describe('Notification severity level'));

export type NotificationSeverity = z.infer<typeof NotificationSeveritySchema>;

/**
 * Notification Position Schema
 * Screen position for rendering notifications.
 */
export const NotificationPositionSchema = lazySchema(() => z.enum([
  'top_left',
  'top_center',
  'top_right',
  'bottom_left',
  'bottom_center',
  'bottom_right',
]).describe('Screen position for notification placement'));

export type NotificationPosition = z.infer<typeof NotificationPositionSchema>;

/**
 * Notification Action Schema
 * Defines an interactive action button within a notification.
 */
export const NotificationActionSchema = lazySchema(() => z.object({
  label: I18nLabelSchema.describe('Action button label'),
  action: z.string().describe('Action identifier to execute'),
  variant: z.enum(['primary', 'secondary', 'link']).default('primary')
    .describe('Button variant style'),
}).describe('Notification action button'));

export type NotificationAction = z.infer<typeof NotificationActionSchema>;

/**
 * Notification Schema
 * Defines a single notification instance with content, behavior, and positioning.
 */
export const NotificationSchema = lazySchema(() => z.object({
  type: NotificationTypeSchema.default('toast').describe('Notification presentation style'),
  severity: NotificationSeveritySchema.default('info').describe('Notification severity level'),
  title: I18nLabelSchema.optional().describe('Notification title'),
  message: I18nLabelSchema.describe('Notification message body'),
  icon: z.string().optional().describe('Icon name override'),
  duration: z.number().optional().describe('Auto-dismiss duration in ms, omit for persistent'),
  dismissible: z.boolean().default(true).describe('Allow user to dismiss the notification'),
  actions: z.array(NotificationActionSchema).optional().describe('Action buttons'),
  position: NotificationPositionSchema.optional().describe('Override default position'),
}).merge(AriaPropsSchema.partial()).describe('Notification instance definition'));

export type Notification = z.infer<typeof NotificationSchema>;

/**
 * Notification Config Schema
 * Top-level notification system configuration.
 */
export const NotificationConfigSchema = lazySchema(() => z.object({
  defaultPosition: NotificationPositionSchema.default('top_right')
    .describe('Default screen position for notifications'),
  defaultDuration: z.number().default(5000)
    .describe('Default auto-dismiss duration in ms'),
  maxVisible: z.number().default(5)
    .describe('Maximum number of notifications visible at once'),
  stackDirection: z.enum(['up', 'down']).default('down')
    .describe('Stack direction for multiple notifications'),
  pauseOnHover: z.boolean().default(true)
    .describe('Pause auto-dismiss timer on hover'),
}).describe('Global notification system configuration'));

export type NotificationConfig = z.infer<typeof NotificationConfigSchema>;
