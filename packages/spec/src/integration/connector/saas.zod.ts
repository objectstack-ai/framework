// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { z } from 'zod';
import {
  ConnectorSchema,
  FieldMappingSchema,
} from '../connector.zod';

/**
 * SaaS Connector Protocol Template
 * 
 * Specialized connector for SaaS applications (Salesforce, HubSpot, Stripe, etc.)
 * Extends the base connector with SaaS-specific features like OAuth flows,
 * object type discovery, and API version management.
 */

/**
 * SaaS Provider Types
 */
import { lazySchema } from '../../shared/lazy-schema';
export const SaasProviderSchema = lazySchema(() => z.enum([
  'salesforce',
  'hubspot',
  'stripe',
  'shopify',
  'zendesk',
  'intercom',
  'mailchimp',
  'slack',
  'microsoft_dynamics',
  'servicenow',
  'netsuite',
  'custom',
]).describe('SaaS provider type'));

export type SaasProvider = z.infer<typeof SaasProviderSchema>;

/**
 * API Version Configuration
 */
export const ApiVersionConfigSchema = lazySchema(() => z.object({
  version: z.string().describe('API version (e.g., "v2", "2023-10-01")'),
  isDefault: z.boolean().default(false).describe('Is this the default version'),
  deprecationDate: z.string().optional().describe('API version deprecation date (ISO 8601)'),
  sunsetDate: z.string().optional().describe('API version sunset date (ISO 8601)'),
}));

export type ApiVersionConfig = z.infer<typeof ApiVersionConfigSchema>;

/**
 * SaaS Object Type Schema
 * Represents a syncable entity in the SaaS system (e.g., Account, Contact, Deal)
 */
export const SaasObjectTypeSchema = lazySchema(() => z.object({
  name: z.string().regex(/^[a-z_][a-z0-9_]*$/).describe('Object type name (snake_case)'),
  label: z.string().describe('Display label'),
  apiName: z.string().describe('API name in external system'),
  enabled: z.boolean().default(true).describe('Enable sync for this object'),
  supportsCreate: z.boolean().default(true).describe('Supports record creation'),
  supportsUpdate: z.boolean().default(true).describe('Supports record updates'),
  supportsDelete: z.boolean().default(true).describe('Supports record deletion'),
  fieldMappings: z.array(FieldMappingSchema).optional().describe('Object-specific field mappings'),
}));

export type SaasObjectType = z.infer<typeof SaasObjectTypeSchema>;

/**
 * SaaS Connector Configuration Schema
 */
export const SaasConnectorSchema = lazySchema(() => ConnectorSchema.extend({
  type: z.literal('saas'),
  
  /**
   * SaaS provider
   */
  provider: SaasProviderSchema.describe('SaaS provider type'),
  
  /**
   * Base URL for API requests
   */
  baseUrl: z.string().url().describe('API base URL'),
  
  /**
   * API version configuration
   */
  apiVersion: ApiVersionConfigSchema.optional().describe('API version configuration'),
  
  /**
   * Supported object types to sync
   */
  objectTypes: z.array(SaasObjectTypeSchema).describe('Syncable object types'),
  
  /**
   * OAuth-specific settings
   */
  oauthSettings: z.object({
    scopes: z.array(z.string()).describe('Required OAuth scopes'),
    refreshTokenUrl: z.string().url().optional().describe('Token refresh endpoint'),
    revokeTokenUrl: z.string().url().optional().describe('Token revocation endpoint'),
    autoRefresh: z.boolean().default(true).describe('Automatically refresh expired tokens'),
  }).optional().describe('OAuth-specific configuration'),
  
  /**
   * Pagination settings
   */
  paginationConfig: z.object({
    type: z.enum(['cursor', 'offset', 'page']).default('cursor').describe('Pagination type'),
    defaultPageSize: z.number().min(1).max(1000).default(100).describe('Default page size'),
    maxPageSize: z.number().min(1).max(10000).default(1000).describe('Maximum page size'),
  }).optional().describe('Pagination configuration'),
  
  /**
   * Sandbox/test environment settings
   */
  sandboxConfig: z.object({
    enabled: z.boolean().default(false).describe('Use sandbox environment'),
    baseUrl: z.string().url().optional().describe('Sandbox API base URL'),
  }).optional().describe('Sandbox environment configuration'),
  
  /**
   * Custom request headers
   */
  customHeaders: z.record(z.string(), z.string()).optional().describe('Custom HTTP headers for all requests'),
}));

export type SaasConnector = z.infer<typeof SaasConnectorSchema>;
export type SaaSConnector = SaasConnector; // Alias for alternative capitalization

// ============================================================================
// Helper Functions & Examples
// ============================================================================

/**
 * Example: Salesforce Connector Configuration
 */
export const salesforceConnectorExample = {
  name: 'salesforce_production',
  label: 'Salesforce Production',
  type: 'saas',
  provider: 'salesforce',
  baseUrl: 'https://example.my.salesforce.com',
  apiVersion: {
    version: 'v59.0',
    isDefault: true,
  },
  authentication: {
    type: 'oauth2',
    clientId: '${SALESFORCE_CLIENT_ID}',
    clientSecret: '${SALESFORCE_CLIENT_SECRET}',
    authorizationUrl: 'https://login.salesforce.com/services/oauth2/authorize',
    tokenUrl: 'https://login.salesforce.com/services/oauth2/token',
    grantType: 'authorization_code',
    scopes: ['api', 'refresh_token', 'offline_access'],
  },
  objectTypes: [
    {
      name: 'account',
      label: 'Account',
      apiName: 'Account',
      enabled: true,
      supportsCreate: true,
      supportsUpdate: true,
      supportsDelete: true,
    },
    {
      name: 'contact',
      label: 'Contact',
      apiName: 'Contact',
      enabled: true,
      supportsCreate: true,
      supportsUpdate: true,
      supportsDelete: true,
    },
  ],
  syncConfig: {
    strategy: 'incremental',
    direction: 'bidirectional',
    schedule: '0 */6 * * *', // Every 6 hours
    realtimeSync: true,
    conflictResolution: 'latest_wins',
    batchSize: 200,
    deleteMode: 'soft_delete',
  },
  rateLimitConfig: {
    strategy: 'token_bucket',
    maxRequests: 100,
    windowSeconds: 20,
    respectUpstreamLimits: true,
  },
  retryConfig: {
    strategy: 'exponential_backoff',
    maxAttempts: 3,
    initialDelayMs: 1000,
    maxDelayMs: 30000,
    backoffMultiplier: 2,
    retryableStatusCodes: [408, 429, 500, 502, 503, 504],
    retryOnNetworkError: true,
    jitter: true,
  },
  status: 'active',
  enabled: true,
};

/**
 * Example: HubSpot Connector Configuration
 */
export const hubspotConnectorExample = {
  name: 'hubspot_crm',
  label: 'HubSpot CRM',
  type: 'saas',
  provider: 'hubspot',
  baseUrl: 'https://api.hubapi.com',
  authentication: {
    type: 'api_key',
    apiKey: '${HUBSPOT_API_KEY}',
    headerName: 'Authorization',
  },
  objectTypes: [
    {
      name: 'company',
      label: 'Company',
      apiName: 'companies',
      enabled: true,
      supportsCreate: true,
      supportsUpdate: true,
      supportsDelete: true,
    },
    {
      name: 'deal',
      label: 'Deal',
      apiName: 'deals',
      enabled: true,
      supportsCreate: true,
      supportsUpdate: true,
      supportsDelete: true,
    },
  ],
  syncConfig: {
    strategy: 'incremental',
    direction: 'import',
    schedule: '0 */4 * * *', // Every 4 hours
    conflictResolution: 'source_wins',
    batchSize: 100,
  },
  rateLimitConfig: {
    strategy: 'token_bucket',
    maxRequests: 100,
    windowSeconds: 10,
  },
  status: 'active',
  enabled: true,
};
