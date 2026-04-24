// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { z } from 'zod';

/**
 * Email Template Schema
 * 
 * Defines the structure and content of email notifications.
 * Supports variables for personalization and file attachments.
 * 
 * @example
 * ```json
 * {
 *   "id": "welcome-email",
 *   "subject": "Welcome to {{company_name}}",
 *   "body": "<h1>Welcome {{user_name}}!</h1>",
 *   "bodyType": "html",
 *   "variables": ["company_name", "user_name"],
 *   "attachments": [
 *     {
 *       "name": "guide.pdf",
 *       "url": "https://example.com/guide.pdf"
 *     }
 *   ]
 * }
 * ```
 */
import { lazySchema } from '../shared/lazy-schema';
export const EmailTemplateSchema = lazySchema(() => z.object({
  /**
   * Unique identifier for the email template
   */
  id: z.string().describe('Template identifier'),

  /**
   * Email subject line (supports variable interpolation)
   */
  subject: z.string().describe('Email subject'),

  /**
   * Email body content
   */
  body: z.string().describe('Email body content'),

  /**
   * Content type of the email body
   * @default 'html'
   */
  bodyType: z.enum(['text', 'html', 'markdown']).optional().default('html').describe('Body content type'),

  /**
   * List of template variables for dynamic content
   */
  variables: z.array(z.string()).optional().describe('Template variables'),

  /**
   * File attachments to include with the email
   */
  attachments: z.array(z.object({
    name: z.string().describe('Attachment filename'),
    url: z.string().url().describe('Attachment URL'),
  })).optional().describe('Email attachments'),
}));

/**
 * SMS Template Schema
 * 
 * Defines the structure of SMS text message notifications.
 * Includes character limits and variable support.
 * 
 * @example
 * ```json
 * {
 *   "id": "verification-sms",
 *   "message": "Your code is {{code}}",
 *   "maxLength": 160,
 *   "variables": ["code"]
 * }
 * ```
 */
export const SMSTemplateSchema = lazySchema(() => z.object({
  /**
   * Unique identifier for the SMS template
   */
  id: z.string().describe('Template identifier'),

  /**
   * SMS message content (supports variable interpolation)
   */
  message: z.string().describe('SMS message content'),

  /**
   * Maximum character length for the SMS
   * @default 160
   */
  maxLength: z.number().optional().default(160).describe('Maximum message length'),

  /**
   * List of template variables for dynamic content
   */
  variables: z.array(z.string()).optional().describe('Template variables'),
}));

/**
 * Push Notification Schema
 * 
 * Defines mobile and web push notification structure.
 * Supports rich notifications with actions and badges.
 * 
 * @example
 * ```json
 * {
 *   "title": "New Message",
 *   "body": "You have a new message from John",
 *   "icon": "https://example.com/icon.png",
 *   "badge": 5,
 *   "data": {"messageId": "msg_123"},
 *   "actions": [
 *     {"action": "view", "title": "View"},
 *     {"action": "dismiss", "title": "Dismiss"}
 *   ]
 * }
 * ```
 */
export const PushNotificationSchema = lazySchema(() => z.object({
  /**
   * Notification title
   */
  title: z.string().describe('Notification title'),

  /**
   * Notification body text
   */
  body: z.string().describe('Notification body'),

  /**
   * Icon URL to display with notification
   */
  icon: z.string().url().optional().describe('Notification icon URL'),

  /**
   * Badge count to display on app icon
   */
  badge: z.number().optional().describe('Badge count'),

  /**
   * Custom data payload
   */
  data: z.record(z.string(), z.unknown()).optional().describe('Custom data'),

  /**
   * Action buttons for the notification
   */
  actions: z.array(z.object({
    action: z.string().describe('Action identifier'),
    title: z.string().describe('Action button title'),
  })).optional().describe('Notification actions'),
}));

/**
 * In-App Notification Schema
 * 
 * Defines in-application notification banners and toasts.
 * Includes severity levels and auto-dismiss settings.
 * 
 * @example
 * ```json
 * {
 *   "title": "System Update",
 *   "message": "New features are now available",
 *   "type": "info",
 *   "actionUrl": "/updates",
 *   "dismissible": true,
 *   "expiresAt": 1704067200000
 * }
 * ```
 */
export const InAppNotificationSchema = lazySchema(() => z.object({
  /**
   * Notification title
   */
  title: z.string().describe('Notification title'),

  /**
   * Notification message content
   */
  message: z.string().describe('Notification message'),

  /**
   * Notification severity type
   */
  type: z.enum(['info', 'success', 'warning', 'error']).describe('Notification type'),

  /**
   * Optional URL to navigate to when clicked
   */
  actionUrl: z.string().optional().describe('Action URL'),

  /**
   * Whether the notification can be dismissed by the user
   * @default true
   */
  dismissible: z.boolean().optional().default(true).describe('User dismissible'),

  /**
   * Timestamp when notification expires (Unix milliseconds)
   */
  expiresAt: z.number().optional().describe('Expiration timestamp'),
}));

/**
 * Notification Channel Enum
 * 
 * Supported notification delivery channels.
 */
export const NotificationChannelSchema = lazySchema(() => z.enum([
  'email',
  'sms',
  'push',
  'in-app',
  'slack',
  'teams',
  'webhook',
]));

/**
 * Notification Configuration Schema
 * 
 * Unified notification management protocol supporting multiple channels.
 * Includes scheduling, retry policies, and delivery tracking.
 * 
 * @example
 * ```json
 * {
 *   "id": "welcome-notification",
 *   "name": "Welcome Email",
 *   "channel": "email",
 *   "template": {
 *     "id": "tpl-001",
 *     "subject": "Welcome!",
 *     "body": "<h1>Welcome</h1>",
 *     "bodyType": "html"
 *   },
 *   "recipients": {
 *     "to": ["user@example.com"],
 *     "cc": ["admin@example.com"]
 *   },
 *   "schedule": {
 *     "type": "immediate"
 *   },
 *   "retryPolicy": {
 *     "enabled": true,
 *     "maxRetries": 3,
 *     "backoffStrategy": "exponential"
 *   },
 *   "tracking": {
 *     "trackOpens": true,
 *     "trackClicks": true,
 *     "trackDelivery": true
 *   }
 * }
 * ```
 */
export const NotificationConfigSchema = lazySchema(() => z.object({
  /**
   * Unique identifier for this notification configuration
   */
  id: z.string().describe('Notification ID'),

  /**
   * Human-readable name for this notification
   */
  name: z.string().describe('Notification name'),

  /**
   * Delivery channel for the notification
   */
  channel: NotificationChannelSchema.describe('Notification channel'),

  /**
   * Notification template based on channel type
   */
  template: z.union([
    EmailTemplateSchema,
    SMSTemplateSchema,
    PushNotificationSchema,
    InAppNotificationSchema,
  ]).describe('Notification template'),

  /**
   * Recipient configuration
   */
  recipients: z.object({
    /**
     * Primary recipients
     */
    to: z.array(z.string()).describe('Primary recipients'),

    /**
     * CC recipients (email only)
     */
    cc: z.array(z.string()).optional().describe('CC recipients'),

    /**
     * BCC recipients (email only)
     */
    bcc: z.array(z.string()).optional().describe('BCC recipients'),
  }).describe('Recipients'),

  /**
   * Scheduling configuration
   */
  schedule: z.object({
    /**
     * Scheduling type
     */
    type: z.enum(['immediate', 'delayed', 'scheduled']).describe('Schedule type'),

    /**
     * Delay in milliseconds (for delayed type)
     */
    delay: z.number().optional().describe('Delay in milliseconds'),

    /**
     * Scheduled send time (Unix timestamp in milliseconds)
     */
    scheduledAt: z.number().optional().describe('Scheduled timestamp'),
  }).optional().describe('Scheduling'),

  /**
   * Retry policy for failed deliveries
   */
  retryPolicy: z.object({
    /**
     * Enable automatic retries
     * @default true
     */
    enabled: z.boolean().optional().default(true).describe('Enable retries'),

    /**
     * Maximum number of retry attempts
     * @default 3
     */
    maxRetries: z.number().optional().default(3).describe('Max retry attempts'),

    /**
     * Backoff strategy for retries
     */
    backoffStrategy: z.enum(['exponential', 'linear', 'fixed']).describe('Backoff strategy'),
  }).optional().describe('Retry policy'),

  /**
   * Delivery tracking configuration
   */
  tracking: z.object({
    /**
     * Track when emails are opened
     * @default false
     */
    trackOpens: z.boolean().optional().default(false).describe('Track opens'),

    /**
     * Track when links are clicked
     * @default false
     */
    trackClicks: z.boolean().optional().default(false).describe('Track clicks'),

    /**
     * Track delivery status
     * @default true
     */
    trackDelivery: z.boolean().optional().default(true).describe('Track delivery'),
  }).optional().describe('Tracking configuration'),
}));

// Type exports
export type NotificationConfig = z.infer<typeof NotificationConfigSchema>;
export type NotificationChannel = z.infer<typeof NotificationChannelSchema>;
export type EmailTemplate = z.infer<typeof EmailTemplateSchema>;
export type SMSTemplate = z.infer<typeof SMSTemplateSchema>;
export type PushNotification = z.infer<typeof PushNotificationSchema>;
export type InAppNotification = z.infer<typeof InAppNotificationSchema>;
