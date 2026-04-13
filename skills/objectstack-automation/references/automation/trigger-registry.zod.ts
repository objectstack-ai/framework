// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { z } from 'zod';

/**
 * Trigger Registry Protocol
 * 
 * Lightweight automation triggers for simple integrations.
 * Inspired by Zapier, n8n, and Workato connector architectures.
 * 
 * ## When to use Trigger Registry vs. Integration Connector?
 * 
 * **Use `automation/trigger-registry.zod.ts` when:**
 * - Building simple automation triggers (e.g., "when Slack message received, create task")
 * - No complex authentication needed (simple API keys, basic auth)
 * - Lightweight, single-purpose integrations
 * - Quick setup with minimal configuration
 * - Webhook-based or polling triggers for automation workflows
 * 
 * **Use `integration/connector.zod.ts` when:**
 * - Building enterprise-grade connectors (e.g., Salesforce, SAP, Oracle)
 * - Complex OAuth2/SAML authentication required
 * - Bidirectional sync with field mapping and transformations
 * - Webhook management and rate limiting required
 * - Full CRUD operations and data synchronization
 * 
 * ## Use Cases
 * 
 * 1. **Simple Automation Triggers**
 *    - Slack notifications on record updates
 *    - Twilio SMS on workflow events
 *    - SendGrid email templates
 * 
 * 2. **Lightweight Operations**
 *    - Single-action integrations (send, notify, log)
 *    - No bidirectional sync required
 *    - Webhook receivers for incoming events
 * 
 * 3. **Quick Integrations**
 *    - Payment webhooks (Stripe, PayPal)
 *    - Communication triggers (Twilio, SendGrid, Slack)
 *    - Simple API calls to third-party services
 * 
 * @see https://zapier.com/developer/documentation/v2/
 * @see https://docs.n8n.io/integrations/creating-nodes/
 * @see ../../integration/connector.zod.ts for enterprise connectors
 * 
 * @example
 * ```typescript
 * const slackNotifier: Connector = {
 *   id: 'slack_notify',
 *   name: 'Slack Notification',
 *   category: 'communication',
 *   authentication: {
 *     type: 'apiKey',
 *     fields: [{ name: 'webhook_url', label: 'Webhook URL', type: 'url' }]
 *   },
 *   operations: [
 *     { id: 'send_message', name: 'Send Message', type: 'action' }
 *   ]
 * }
 * ```
 */

/**
 * Connector Category
 */
export const ConnectorCategorySchema = z.enum([
  'crm',           // Customer Relationship Management
  'payment',       // Payment processors
  'communication', // Email, SMS, Chat
  'storage',       // File storage
  'analytics',     // Analytics platforms
  'database',      // Databases
  'marketing',     // Marketing automation
  'accounting',    // Accounting software
  'hr',            // Human resources
  'productivity',  // Productivity tools
  'ecommerce',     // E-commerce platforms
  'support',       // Customer support
  'devtools',      // Developer tools
  'social',        // Social media
  'other',         // Other category
]);

export type ConnectorCategory = z.infer<typeof ConnectorCategorySchema>;

/**
 * Authentication Type
 */
export const AuthenticationTypeSchema = z.enum([
  'none',          // No authentication
  'apiKey',        // API key
  'basic',         // Basic auth (username/password)
  'bearer',        // Bearer token
  'oauth1',        // OAuth 1.0
  'oauth2',        // OAuth 2.0
  'custom',        // Custom authentication
]);

export type AuthenticationType = z.infer<typeof AuthenticationTypeSchema>;

/**
 * Authentication Field Schema
 */
export const AuthFieldSchema = z.object({
  /**
   * Field name (machine name)
   */
  name: z.string()
    .regex(/^[a-z_][a-z0-9_]*$/)
    .describe('Field name (snake_case)'),

  /**
   * Field label
   */
  label: z.string().describe('Field label'),

  /**
   * Field type
   */
  type: z.enum(['text', 'password', 'url', 'select'])
    .default('text')
    .describe('Field type'),

  /**
   * Field description
   */
  description: z.string().optional().describe('Field description'),

  /**
   * Whether field is required
   */
  required: z.boolean().default(true).describe('Required field'),

  /**
   * Default value
   */
  default: z.string().optional().describe('Default value'),

  /**
   * Options for select fields
   */
  options: z.array(z.object({
    label: z.string(),
    value: z.string(),
  })).optional().describe('Select field options'),

  /**
   * Placeholder text
   */
  placeholder: z.string().optional().describe('Placeholder text'),
});

export type AuthField = z.infer<typeof AuthFieldSchema>;

/**
 * OAuth 2.0 Configuration
 */
export const OAuth2ConfigSchema = z.object({
  /**
   * Authorization URL
   */
  authorizationUrl: z.string().url().describe('Authorization endpoint URL'),

  /**
   * Token URL
   */
  tokenUrl: z.string().url().describe('Token endpoint URL'),

  /**
   * Scopes to request
   */
  scopes: z.array(z.string()).optional().describe('OAuth scopes'),

  /**
   * Client ID field name
   */
  clientIdField: z.string().default('client_id').describe('Client ID field name'),

  /**
   * Client secret field name
   */
  clientSecretField: z.string().default('client_secret').describe('Client secret field name'),
});

export type OAuth2Config = z.infer<typeof OAuth2ConfigSchema>;

/**
 * Authentication Configuration
 */
export const AuthenticationSchema = z.object({
  /**
   * Authentication type
   */
  type: AuthenticationTypeSchema.describe('Authentication type'),

  /**
   * Authentication fields
   * Configuration fields needed for this auth type
   */
  fields: z.array(AuthFieldSchema).optional().describe('Authentication fields'),

  /**
   * OAuth 2.0 configuration (when type is oauth2)
   */
  oauth2: OAuth2ConfigSchema.optional().describe('OAuth 2.0 configuration'),

  /**
   * Test authentication instructions
   */
  test: z.object({
    url: z.string().optional().describe('Test endpoint URL'),
    method: z.enum(['GET', 'POST', 'PUT', 'DELETE']).default('GET').describe('HTTP method'),
  }).optional().describe('Authentication test configuration'),
});

export type Authentication = z.infer<typeof AuthenticationSchema>;

/**
 * Connector Operation Type
 */
export const OperationTypeSchema = z.enum([
  'read',    // Read/query data
  'write',   // Create/update data
  'delete',  // Delete data
  'search',  // Search operation
  'trigger', // Webhook/polling trigger
  'action',  // Custom action
]);

export type OperationType = z.infer<typeof OperationTypeSchema>;

/**
 * Operation Parameter Schema
 */
export const OperationParameterSchema = z.object({
  /**
   * Parameter name
   */
  name: z.string().describe('Parameter name'),

  /**
   * Parameter label
   */
  label: z.string().describe('Parameter label'),

  /**
   * Parameter description
   */
  description: z.string().optional().describe('Parameter description'),

  /**
   * Parameter type
   */
  type: z.enum(['string', 'number', 'boolean', 'array', 'object', 'date', 'file'])
    .describe('Parameter type'),

  /**
   * Whether parameter is required
   */
  required: z.boolean().default(false).describe('Required parameter'),

  /**
   * Default value
   */
  default: z.unknown().optional().describe('Default value'),

  /**
   * Validation schema
   */
  validation: z.record(z.string(), z.unknown()).optional().describe('Validation rules'),

  /**
   * Dynamic options function
   */
  dynamicOptions: z.string().optional().describe('Function to load dynamic options'),
});

export type OperationParameter = z.infer<typeof OperationParameterSchema>;

/**
 * Connector Operation Schema
 */
export const ConnectorOperationSchema = z.object({
  /**
   * Operation identifier
   */
  id: z.string()
    .regex(/^[a-z_][a-z0-9_]*$/)
    .describe('Operation ID (snake_case)'),

  /**
   * Operation name
   */
  name: z.string().describe('Operation name'),

  /**
   * Operation description
   */
  description: z.string().optional().describe('Operation description'),

  /**
   * Operation type
   */
  type: OperationTypeSchema.describe('Operation type'),

  /**
   * Input parameters
   */
  inputSchema: z.array(OperationParameterSchema)
    .optional()
    .describe('Input parameters'),

  /**
   * Output schema
   */
  outputSchema: z.record(z.string(), z.unknown())
    .optional()
    .describe('Output schema'),

  /**
   * Sample output for documentation
   */
  sampleOutput: z.unknown().optional().describe('Sample output'),

  /**
   * Whether operation supports pagination
   */
  supportsPagination: z.boolean().default(false).describe('Supports pagination'),

  /**
   * Whether operation supports filtering
   */
  supportsFiltering: z.boolean().default(false).describe('Supports filtering'),
});

export type ConnectorOperation = z.infer<typeof ConnectorOperationSchema>;

/**
 * Connector Trigger Schema
 * 
 * Triggers are special operations that watch for events and initiate workflows.
 */
export const ConnectorTriggerSchema = z.object({
  /**
   * Trigger identifier
   */
  id: z.string()
    .regex(/^[a-z_][a-z0-9_]*$/)
    .describe('Trigger ID (snake_case)'),

  /**
   * Trigger name
   */
  name: z.string().describe('Trigger name'),

  /**
   * Trigger description
   */
  description: z.string().optional().describe('Trigger description'),

  /**
   * Trigger type
   */
  type: z.enum(['webhook', 'polling', 'stream'])
    .describe('Trigger mechanism'),

  /**
   * Trigger configuration
   */
  config: z.record(z.string(), z.unknown())
    .optional()
    .describe('Trigger configuration'),

  /**
   * Output schema
   */
  outputSchema: z.record(z.string(), z.unknown())
    .optional()
    .describe('Event payload schema'),

  /**
   * Polling interval (for polling triggers)
   * In milliseconds
   */
  pollingIntervalMs: z.number().int().min(1000)
    .optional()
    .describe('Polling interval in ms'),
});

export type ConnectorTrigger = z.infer<typeof ConnectorTriggerSchema>;

/**
 * Connector Schema
 * 
 * Complete definition of a connector to an external system.
 */
export const ConnectorSchema = z.object({
  /**
   * Connector identifier
   * Must be globally unique
   */
  id: z.string()
    .regex(/^[a-z_][a-z0-9_]*$/)
    .describe('Connector ID (snake_case)'),

  /**
   * Connector name
   */
  name: z.string().describe('Connector name'),

  /**
   * Connector description
   */
  description: z.string().optional().describe('Connector description'),

  /**
   * Connector version (semver)
   */
  version: z.string().optional().describe('Connector version'),

  /**
   * Connector icon URL or name
   */
  icon: z.string().optional().describe('Connector icon'),

  /**
   * Connector category
   */
  category: ConnectorCategorySchema.describe('Connector category'),

  /**
   * Base URL for API calls
   */
  baseUrl: z.string().url().optional().describe('API base URL'),

  /**
   * Authentication configuration
   */
  authentication: AuthenticationSchema.describe('Authentication config'),

  /**
   * Available operations
   */
  operations: z.array(ConnectorOperationSchema)
    .optional()
    .describe('Connector operations'),

  /**
   * Available triggers
   */
  triggers: z.array(ConnectorTriggerSchema)
    .optional()
    .describe('Connector triggers'),

  /**
   * Rate limiting information
   */
  rateLimit: z.object({
    requestsPerSecond: z.number().optional().describe('Max requests per second'),
    requestsPerMinute: z.number().optional().describe('Max requests per minute'),
    requestsPerHour: z.number().optional().describe('Max requests per hour'),
  }).optional().describe('Rate limiting'),

  /**
   * Connector author
   */
  author: z.string().optional().describe('Connector author'),

  /**
   * Documentation URL
   */
  documentation: z.string().url().optional().describe('Documentation URL'),

  /**
   * Homepage URL
   */
  homepage: z.string().url().optional().describe('Homepage URL'),

  /**
   * License
   */
  license: z.string().optional().describe('License (SPDX identifier)'),

  /**
   * Tags for discovery
   */
  tags: z.array(z.string()).optional().describe('Connector tags'),

  /**
   * Whether connector is verified/certified
   */
  verified: z.boolean().default(false).describe('Verified connector'),

  /**
   * Custom metadata
   */
  metadata: z.record(z.string(), z.unknown()).optional().describe('Custom metadata'),
});

export type Connector = z.infer<typeof ConnectorSchema>;

/**
 * Connector Instance Schema
 * 
 * A configured instance of a connector with credentials.
 */
export const ConnectorInstanceSchema = z.object({
  /**
   * Instance ID
   */
  id: z.string().describe('Instance ID'),

  /**
   * Connector ID this instance uses
   */
  connectorId: z.string().describe('Connector ID'),

  /**
   * Instance name
   */
  name: z.string().describe('Instance name'),

  /**
   * Instance description
   */
  description: z.string().optional().describe('Instance description'),

  /**
   * Authentication credentials (encrypted)
   */
  credentials: z.record(z.string(), z.unknown()).describe('Encrypted credentials'),

  /**
   * Additional configuration
   */
  config: z.record(z.string(), z.unknown()).optional().describe('Additional config'),

  /**
   * Whether instance is active
   */
  active: z.boolean().default(true).describe('Instance active status'),

  /**
   * Created timestamp
   */
  createdAt: z.string().datetime().optional().describe('Creation time'),

  /**
   * Last tested timestamp
   */
  lastTestedAt: z.string().datetime().optional().describe('Last test time'),

  /**
   * Test status
   */
  testStatus: z.enum(['unknown', 'success', 'failed'])
    .default('unknown')
    .describe('Connection test status'),
});

export type ConnectorInstance = z.infer<typeof ConnectorInstanceSchema>;

/**
 * Helper factory for creating connectors
 */
export const Connector = {
  /**
   * Create a basic API key connector
   */
  apiKey: (params: {
    id: string;
    name: string;
    category: ConnectorCategory;
    baseUrl: string;
  }): Connector => ({
    id: params.id,
    name: params.name,
    category: params.category,
    baseUrl: params.baseUrl,
    authentication: {
      type: 'apiKey',
      fields: [
        {
          name: 'api_key',
          label: 'API Key',
          type: 'password',
          required: true,
        },
      ],
    },
    verified: false,
  }),

  /**
   * Create an OAuth 2.0 connector
   */
  oauth2: (params: {
    id: string;
    name: string;
    category: ConnectorCategory;
    baseUrl: string;
    authUrl: string;
    tokenUrl: string;
    scopes?: string[];
  }): Connector => ({
    id: params.id,
    name: params.name,
    category: params.category,
    baseUrl: params.baseUrl,
    authentication: {
      type: 'oauth2',
      oauth2: {
        authorizationUrl: params.authUrl,
        tokenUrl: params.tokenUrl,
        clientIdField: 'client_id',
        clientSecretField: 'client_secret',
        scopes: params.scopes,
      },
    },
    verified: false,
  }),
} as const;
