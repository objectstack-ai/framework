// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * INotificationService - Notification Service Contract
 * 
 * Defines the interface for sending notifications in ObjectStack.
 * Concrete implementations (Email, Push, SMS, Slack, etc.)
 * should implement this interface.
 * 
 * Follows Dependency Inversion Principle - plugins depend on this interface,
 * not on concrete notification provider implementations.
 * 
 * Aligned with CoreServiceName 'notification' in core-services.zod.ts.
 */

/**
 * Supported notification delivery channels
 *
 * ⚠️ PARTIALLY ENFORCED — mirrors `NotificationChannelSchema`
 * (system/notification.zod.ts); the delivery channels actually registered by
 * `service-messaging` are `inbox`, `email`, and `sms` only (#3197). Messages
 * addressed to an unregistered channel are dead-lettered, not delivered.
 */
export type NotificationChannel = 'email' | 'sms' | 'push' | 'in-app' | 'slack' | 'teams' | 'webhook';

/**
 * A notification message to be sent
 */
export interface NotificationMessage {
    /** Notification channel to use */
    channel: NotificationChannel;
    /** Recipient identifier (email, phone, user ID, etc.) */
    to: string | string[];
    /** Notification subject/title */
    subject?: string;
    /** Notification body content */
    body: string;
    /** Template identifier (if using a pre-defined template) */
    templateId?: string;
    /** Template variable values */
    templateData?: Record<string, unknown>;
    /** Additional metadata */
    metadata?: Record<string, unknown>;
}

/**
 * Result of sending a notification
 */
export interface NotificationResult {
    /** Whether the notification was sent successfully */
    success: boolean;
    /** Unique identifier for tracking */
    messageId?: string;
    /** Error message if sending failed */
    error?: string;
}

export interface INotificationService {
    /**
     * Send a notification
     * @param message - The notification message to send
     * @returns Result indicating success or failure
     */
    send(message: NotificationMessage): Promise<NotificationResult>;

    /**
     * Send multiple notifications in a batch
     * @param messages - Array of notification messages
     * @returns Array of results for each message
     */
    sendBatch?(messages: NotificationMessage[]): Promise<NotificationResult[]>;

    /**
     * List available notification channels
     * @returns Array of supported channel names
     */
    getChannels?(): NotificationChannel[];
}
