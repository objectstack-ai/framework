// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { z } from 'zod';
import {
  ConnectorSchema,
} from '../connector.zod';

/**
 * Message Queue Connector Protocol Template
 * 
 * Specialized connector for message queue systems (RabbitMQ, Kafka, SQS, etc.)
 * Extends the base connector with message queue-specific features like topics,
 * consumer groups, and message acknowledgment patterns.
 */

/**
 * Message Queue Provider Types
 */
import { lazySchema } from '../../shared/lazy-schema';
export const MessageQueueProviderSchema = lazySchema(() => z.enum([
  'rabbitmq',              // RabbitMQ
  'kafka',                 // Apache Kafka
  'redis_pubsub',          // Redis Pub/Sub
  'redis_streams',         // Redis Streams
  'aws_sqs',               // Amazon SQS
  'aws_sns',               // Amazon SNS
  'google_pubsub',         // Google Cloud Pub/Sub
  'azure_service_bus',     // Azure Service Bus
  'azure_event_hubs',      // Azure Event Hubs
  'nats',                  // NATS
  'pulsar',                // Apache Pulsar
  'activemq',              // Apache ActiveMQ
  'custom',                // Custom message queue
]).describe('Message queue provider type'));

export type MessageQueueProvider = z.infer<typeof MessageQueueProviderSchema>;

/**
 * Message Format
 */
export const MessageFormatSchema = lazySchema(() => z.enum([
  'json',
  'xml',
  'protobuf',
  'avro',
  'text',
  'binary',
]).describe('Message format/serialization'));

export type MessageFormat = z.infer<typeof MessageFormatSchema>;

/**
 * Message Acknowledgment Mode
 */
export const AckModeSchema = lazySchema(() => z.enum([
  'auto',               // Auto-acknowledge
  'manual',             // Manual acknowledge after processing
  'client',             // Client-controlled acknowledge
]).describe('Message acknowledgment mode'));

export type AckMode = z.infer<typeof AckModeSchema>;

/**
 * Delivery Guarantee
 */
export const DeliveryGuaranteeSchema = lazySchema(() => z.enum([
  'at_most_once',       // Fire and forget
  'at_least_once',      // May deliver duplicates
  'exactly_once',       // Guaranteed exactly once delivery
]).describe('Message delivery guarantee'));

export type DeliveryGuarantee = z.infer<typeof DeliveryGuaranteeSchema>;

/**
 * Consumer Configuration
 */
export const ConsumerConfigSchema = lazySchema(() => z.object({
  enabled: z.boolean().optional().default(true).describe('Enable consumer'),
  
  consumerGroup: z.string().optional().describe('Consumer group ID'),
  
  concurrency: z.number().min(1).max(100).optional().default(1).describe('Number of concurrent consumers'),
  
  prefetchCount: z.number().min(1).max(1000).optional().default(10).describe('Prefetch count'),
  
  ackMode: AckModeSchema.optional().default('manual'),
  
  autoCommit: z.boolean().optional().default(false).describe('Auto-commit offsets'),
  
  autoCommitIntervalMs: z.number().min(100).optional().default(5000).describe('Auto-commit interval in ms'),
  
  sessionTimeoutMs: z.number().min(1000).optional().default(30000).describe('Session timeout in ms'),
  
  rebalanceTimeoutMs: z.number().min(1000).optional().describe('Rebalance timeout in ms'),
}));

export type ConsumerConfig = z.infer<typeof ConsumerConfigSchema>;

/**
 * Producer Configuration
 */
export const ProducerConfigSchema = lazySchema(() => z.object({
  enabled: z.boolean().optional().default(true).describe('Enable producer'),
  
  acks: z.enum(['0', '1', 'all']).optional().default('all').describe('Acknowledgment level'),
  
  compressionType: z.enum(['none', 'gzip', 'snappy', 'lz4', 'zstd']).optional().default('none').describe('Compression type'),
  
  batchSize: z.number().min(1).optional().default(16384).describe('Batch size in bytes'),
  
  lingerMs: z.number().min(0).optional().default(0).describe('Linger time in ms'),
  
  maxInFlightRequests: z.number().min(1).optional().default(5).describe('Max in-flight requests'),
  
  idempotence: z.boolean().optional().default(true).describe('Enable idempotent producer'),
  
  transactional: z.boolean().optional().default(false).describe('Enable transactional producer'),
  
  transactionTimeoutMs: z.number().min(1000).optional().describe('Transaction timeout in ms'),
}));

export type ProducerConfig = z.infer<typeof ProducerConfigSchema>;

/**
 * Dead Letter Queue Configuration
 */
export const DlqConfigSchema = lazySchema(() => z.object({
  enabled: z.boolean().optional().default(false).describe('Enable DLQ'),
  
  queueName: z.string().describe('Dead letter queue/topic name'),
  
  maxRetries: z.number().min(0).max(100).optional().default(3).describe('Max retries before DLQ'),
  
  retryDelayMs: z.number().min(0).optional().default(60000).describe('Retry delay in ms'),
}));

export type DlqConfig = z.infer<typeof DlqConfigSchema>;

/**
 * Topic/Queue Configuration
 */
export const TopicQueueSchema = lazySchema(() => z.object({
  name: z.string().regex(/^[a-z_][a-z0-9_]*$/).describe('Topic/queue identifier in ObjectStack (snake_case)'),
  label: z.string().describe('Display label'),
  topicName: z.string().describe('Actual topic/queue name in message queue system'),
  enabled: z.boolean().optional().default(true).describe('Enable sync for this topic/queue'),
  
  /**
   * Consumer or Producer
   */
  mode: z.enum(['consumer', 'producer', 'both']).optional().default('both').describe('Consumer, producer, or both'),
  
  /**
   * Message format
   */
  messageFormat: MessageFormatSchema.optional().default('json'),
  
  /**
   * Partition/shard configuration
   */
  partitions: z.number().min(1).optional().describe('Number of partitions (for Kafka)'),
  
  /**
   * Replication factor
   */
  replicationFactor: z.number().min(1).optional().describe('Replication factor (for Kafka)'),
  
  /**
   * Consumer configuration
   */
  consumerConfig: ConsumerConfigSchema.optional().describe('Consumer-specific configuration'),
  
  /**
   * Producer configuration
   */
  producerConfig: ProducerConfigSchema.optional().describe('Producer-specific configuration'),
  
  /**
   * Dead letter queue configuration
   */
  dlqConfig: DlqConfigSchema.optional().describe('Dead letter queue configuration'),
  
  /**
   * Message routing key (for RabbitMQ)
   */
  routingKey: z.string().optional().describe('Routing key pattern'),
  
  /**
   * Message filter
   */
  messageFilter: z.object({
    headers: z.record(z.string(), z.string()).optional().describe('Filter by message headers'),
    attributes: z.record(z.string(), z.unknown()).optional().describe('Filter by message attributes'),
  }).optional().describe('Message filter criteria'),
}));

export type TopicQueue = z.infer<typeof TopicQueueSchema>;

/**
 * Message Queue Connector Configuration Schema
 */
export const MessageQueueConnectorSchema = lazySchema(() => ConnectorSchema.extend({
  type: z.literal('message_queue'),
  
  /**
   * Message queue provider
   */
  provider: MessageQueueProviderSchema.describe('Message queue provider type'),
  
  /**
   * Broker configuration
   */
  brokerConfig: z.object({
    brokers: z.array(z.string()).describe('Broker addresses (host:port)'),
    clientId: z.string().optional().describe('Client ID'),
    connectionTimeoutMs: z.number().min(1000).optional().default(30000).describe('Connection timeout in ms'),
    requestTimeoutMs: z.number().min(1000).optional().default(30000).describe('Request timeout in ms'),
  }).describe('Broker connection configuration'),
  
  /**
   * Topics/queues to sync
   */
  topics: z.array(TopicQueueSchema).describe('Topics/queues to sync'),
  
  /**
   * Delivery guarantee
   */
  deliveryGuarantee: DeliveryGuaranteeSchema.optional().default('at_least_once'),
  
  /**
   * SSL/TLS configuration
   */
  sslConfig: z.object({
    enabled: z.boolean().optional().default(false).describe('Enable SSL/TLS'),
    rejectUnauthorized: z.boolean().optional().default(true).describe('Reject unauthorized certificates'),
    ca: z.string().optional().describe('CA certificate'),
    cert: z.string().optional().describe('Client certificate'),
    key: z.string().optional().describe('Client private key'),
  }).optional().describe('SSL/TLS configuration'),
  
  /**
   * SASL authentication (for Kafka)
   */
  saslConfig: z.object({
    mechanism: z.enum(['plain', 'scram-sha-256', 'scram-sha-512', 'aws']).describe('SASL mechanism'),
    username: z.string().optional().describe('SASL username'),
    password: z.string().optional().describe('SASL password'),
  }).optional().describe('SASL authentication configuration'),
  
  /**
   * Schema registry configuration (for Kafka/Avro)
   */
  schemaRegistry: z.object({
    url: z.string().url().describe('Schema registry URL'),
    auth: z.object({
      username: z.string().optional(),
      password: z.string().optional(),
    }).optional(),
  }).optional().describe('Schema registry configuration'),
  
  /**
   * Message ordering
   */
  preserveOrder: z.boolean().optional().default(true).describe('Preserve message ordering'),
  
  /**
   * Enable metrics
   */
  enableMetrics: z.boolean().optional().default(true).describe('Enable message queue metrics'),
  
  /**
   * Enable distributed tracing
   */
  enableTracing: z.boolean().optional().default(false).describe('Enable distributed tracing'),
}));

export type MessageQueueConnector = z.infer<typeof MessageQueueConnectorSchema>;

// ============================================================================
// Helper Functions & Examples
// ============================================================================

/**
 * Example: Apache Kafka Connector Configuration
 */
export const kafkaConnectorExample = {
  name: 'kafka_production',
  label: 'Production Kafka Cluster',
  type: 'message_queue',
  provider: 'kafka',
  authentication: {
    type: 'none',
  },
  brokerConfig: {
    brokers: ['kafka-1.example.com:9092', 'kafka-2.example.com:9092', 'kafka-3.example.com:9092'],
    clientId: 'objectstack-client',
    connectionTimeoutMs: 30000,
    requestTimeoutMs: 30000,
  },
  topics: [
    {
      name: 'order_events',
      label: 'Order Events',
      topicName: 'orders',
      enabled: true,
      mode: 'consumer',
      messageFormat: 'json',
      partitions: 10,
      replicationFactor: 3,
      consumerConfig: {
        enabled: true,
        consumerGroup: 'objectstack-consumer-group',
        concurrency: 5,
        prefetchCount: 100,
        ackMode: 'manual',
        autoCommit: false,
        sessionTimeoutMs: 30000,
      },
      dlqConfig: {
        enabled: true,
        queueName: 'orders-dlq',
        maxRetries: 3,
        retryDelayMs: 60000,
      },
    },
    {
      name: 'user_activity',
      label: 'User Activity',
      topicName: 'user-activity',
      enabled: true,
      mode: 'producer',
      messageFormat: 'json',
      partitions: 5,
      replicationFactor: 3,
      producerConfig: {
        enabled: true,
        acks: 'all',
        compressionType: 'snappy',
        batchSize: 16384,
        lingerMs: 10,
        maxInFlightRequests: 5,
        idempotence: true,
      },
    },
  ],
  deliveryGuarantee: 'at_least_once',
  saslConfig: {
    mechanism: 'scram-sha-256',
    username: '${KAFKA_USERNAME}',
    password: '${KAFKA_PASSWORD}',
  },
  sslConfig: {
    enabled: true,
    rejectUnauthorized: true,
  },
  preserveOrder: true,
  enableMetrics: true,
  enableTracing: true,
  status: 'active',
  enabled: true,
};

/**
 * Example: RabbitMQ Connector Configuration
 */
export const rabbitmqConnectorExample = {
  name: 'rabbitmq_events',
  label: 'RabbitMQ Event Bus',
  type: 'message_queue',
  provider: 'rabbitmq',
  authentication: {
    type: 'basic',
    username: '${RABBITMQ_USERNAME}',
    password: '${RABBITMQ_PASSWORD}',
  },
  brokerConfig: {
    brokers: ['amqp://rabbitmq.example.com:5672'],
    clientId: 'objectstack-rabbitmq-client',
  },
  topics: [
    {
      name: 'notifications',
      label: 'Notifications',
      topicName: 'notifications',
      enabled: true,
      mode: 'both',
      messageFormat: 'json',
      routingKey: 'notification.*',
      consumerConfig: {
        enabled: true,
        prefetchCount: 10,
        ackMode: 'manual',
      },
      producerConfig: {
        enabled: true,
      },
      dlqConfig: {
        enabled: true,
        queueName: 'notifications-dlq',
        maxRetries: 3,
        retryDelayMs: 30000,
      },
    },
  ],
  deliveryGuarantee: 'at_least_once',
  status: 'active',
  enabled: true,
};

/**
 * Example: AWS SQS Connector Configuration
 */
export const sqsConnectorExample = {
  name: 'aws_sqs_queue',
  label: 'AWS SQS Queue',
  type: 'message_queue',
  provider: 'aws_sqs',
  authentication: {
    type: 'api_key',
    apiKey: '${AWS_ACCESS_KEY_ID}:${AWS_SECRET_ACCESS_KEY}',
    headerName: 'Authorization',
  },
  brokerConfig: {
    brokers: ['https://sqs.us-east-1.amazonaws.com'],
  },
  topics: [
    {
      name: 'task_queue',
      label: 'Task Queue',
      topicName: 'task-queue',
      enabled: true,
      mode: 'consumer',
      messageFormat: 'json',
      consumerConfig: {
        enabled: true,
        concurrency: 10,
        prefetchCount: 10,
        ackMode: 'manual',
      },
      dlqConfig: {
        enabled: true,
        queueName: 'task-queue-dlq',
        maxRetries: 3,
        retryDelayMs: 120000,
      },
    },
  ],
  deliveryGuarantee: 'at_least_once',
  retryConfig: {
    strategy: 'exponential_backoff',
    maxAttempts: 3,
    initialDelayMs: 1000,
    maxDelayMs: 60000,
    backoffMultiplier: 2,
  },
  status: 'active',
  enabled: true,
};

/**
 * Example: Google Cloud Pub/Sub Connector Configuration
 */
export const pubsubConnectorExample = {
  name: 'gcp_pubsub',
  label: 'Google Cloud Pub/Sub',
  type: 'message_queue',
  provider: 'google_pubsub',
  authentication: {
    type: 'oauth2',
    clientId: '${GCP_CLIENT_ID}',
    clientSecret: '${GCP_CLIENT_SECRET}',
    authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    grantType: 'client_credentials',
    scopes: ['https://www.googleapis.com/auth/pubsub'],
  },
  brokerConfig: {
    brokers: ['pubsub.googleapis.com'],
  },
  topics: [
    {
      name: 'analytics_events',
      label: 'Analytics Events',
      topicName: 'projects/my-project/topics/analytics-events',
      enabled: true,
      mode: 'both',
      messageFormat: 'json',
      consumerConfig: {
        enabled: true,
        consumerGroup: 'objectstack-subscription',
        concurrency: 5,
        prefetchCount: 100,
        ackMode: 'manual',
      },
    },
  ],
  deliveryGuarantee: 'at_least_once',
  enableMetrics: true,
  status: 'active',
  enabled: true,
};
