// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * IQueueService - Message Queue Service Contract
 * 
 * Defines the interface for asynchronous message queue operations in ObjectStack.
 * Concrete implementations (BullMQ, Redis Pub/Sub, Kafka, etc.)
 * should implement this interface.
 * 
 * Follows Dependency Inversion Principle - plugins depend on this interface,
 * not on concrete queue implementations.
 * 
 * Aligned with CoreServiceName 'queue' in core-services.zod.ts.
 */

/**
 * Backoff policy for failed message retries.
 */
export interface QueueBackoffPolicy {
    /** Backoff strategy */
    type: 'fixed' | 'exponential';
    /** Base delay in milliseconds */
    delayMs: number;
    /** Maximum delay cap in milliseconds (exponential only) */
    maxDelayMs?: number;
}

/**
 * Options for publishing a message to a queue
 */
export interface QueuePublishOptions {
    /** Delay before the message becomes available (in milliseconds) */
    delay?: number;
    /** Message priority (lower = higher priority) */
    priority?: number;
    /** Number of retry attempts on failure (legacy — prefer maxAttempts) */
    retries?: number;
    /** Maximum total delivery attempts before DLQ (default: 3) */
    maxAttempts?: number;
    /** Backoff policy between retries */
    backoff?: QueueBackoffPolicy;
    /**
     * Idempotency key — if a non-completed message with the same
     * (queue, idempotencyKey) exists within the dedup window, the publish
     * is suppressed and the existing message id is returned.
     */
    idempotencyKey?: string;
    /** ISO 8601 datetime — schedule message for future delivery */
    scheduledFor?: string;
    /** Arbitrary metadata (org_id, tenant_id, source record) for observability */
    metadata?: Record<string, unknown>;
}

/**
 * A persisted queue message including lifecycle bookkeeping.
 * Returned from `listFailed` and admin endpoints.
 */
export interface QueueMessageRecord<T = unknown> {
    id: string;
    queue: string;
    data: T;
    status: 'pending' | 'running' | 'completed' | 'failed' | 'dlq';
    attempts: number;
    maxAttempts: number;
    scheduledFor?: string;
    lockedBy?: string;
    lockedUntil?: string;
    lastError?: string;
    idempotencyKey?: string;
    metadata?: Record<string, unknown>;
    createdAt: string;
    updatedAt?: string;
    completedAt?: string;
}

/**
 * A message received from a queue
 */
export interface QueueMessage<T = unknown> {
    /** Unique message identifier */
    id: string;
    /** The message payload */
    data: T;
    /** Number of times this message has been attempted */
    attempts: number;
    /** Timestamp when the message was published */
    timestamp: number;
}

/**
 * Handler function for processing queue messages
 */
export type QueueHandler<T = unknown> = (message: QueueMessage<T>) => Promise<void>;

export interface IQueueService {
    /**
     * Publish a message to a named queue
     * @param queue - Queue name
     * @param data - Message payload
     * @param options - Publish options (delay, priority, retries)
     * @returns The message identifier
     */
    publish<T = unknown>(queue: string, data: T, options?: QueuePublishOptions): Promise<string>;

    /**
     * Subscribe to messages from a named queue
     * @param queue - Queue name
     * @param handler - Message handler function
     */
    subscribe<T = unknown>(queue: string, handler: QueueHandler<T>): Promise<void>;

    /**
     * Unsubscribe from a named queue
     * @param queue - Queue name
     */
    unsubscribe(queue: string): Promise<void>;

    /**
     * Get the number of messages waiting in a queue
     * @param queue - Queue name
     * @returns Number of pending messages
     */
    getQueueSize?(queue: string): Promise<number>;

    /**
     * Purge all messages from a queue
     * @param queue - Queue name
     */
    purge?(queue: string): Promise<void>;

    /**
     * List messages currently in the dead-letter state.
     * @param queue - Optional queue filter; omit for cross-queue listing
     * @param options - Pagination / limit
     */
    listFailed?(
        queue?: string,
        options?: { limit?: number; offset?: number },
    ): Promise<QueueMessageRecord[]>;

    /**
     * Move a DLQ message back to pending so a worker re-processes it.
     * Resets `attempts` and clears `lastError`. Throws if the message
     * does not exist or is not in 'dlq' status.
     */
    replay?(messageId: string): Promise<void>;

    /**
     * Permanently remove a message in the 'dlq' or 'failed' state.
     */
    purgeFailed?(messageId: string): Promise<void>;
}
