// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { z } from 'zod';

/**
 * SHARED CONNECTOR AUTHENTICATION SCHEMAS
 * These schemas are used by connectors and integrations for external auth.
 * They define "How we authenticate TO other systems", not "How users authenticate TO us".
 */

/**
 * OAuth2 Authentication Schema
 */
import { lazySchema } from './lazy-schema';
export const ConnectorOAuth2Schema = lazySchema(() => z.object({
  type: z.literal('oauth2'),
  authorizationUrl: z.string().url().describe('OAuth2 authorization endpoint'),
  tokenUrl: z.string().url().describe('OAuth2 token endpoint'),
  clientId: z.string().describe('OAuth2 client ID'),
  clientSecret: z.string().describe('OAuth2 client secret (typically from ENV)'),
  scopes: z.array(z.string()).optional().describe('Requested OAuth2 scopes'),
  redirectUri: z.string().url().optional().describe('OAuth2 redirect URI'),
  refreshToken: z.string().optional().describe('Refresh token for token renewal'),
  tokenExpiry: z.number().optional().describe('Token expiry timestamp'),
}));

/**
 * API Key Authentication Schema
 */
export const ConnectorAPIKeySchema = lazySchema(() => z.object({
  type: z.literal('api-key'),
  key: z.string().describe('API key value'),
  headerName: z.string().default('X-API-Key').describe('HTTP header name for API key'),
  paramName: z.string().optional().describe('Query parameter name (alternative to header)'),
}));

/**
 * Basic Authentication Schema
 */
export const ConnectorBasicAuthSchema = lazySchema(() => z.object({
  type: z.literal('basic'),
  username: z.string().describe('Username'),
  password: z.string().describe('Password'),
}));

/**
 * Bearer Token Authentication Schema
 */
export const ConnectorBearerAuthSchema = lazySchema(() => z.object({
  type: z.literal('bearer'),
  token: z.string().describe('Bearer token'),
}));

/**
 * No Authentication Schema
 */
export const ConnectorNoAuthSchema = lazySchema(() => z.object({
  type: z.literal('none'),
}));

/**
 * Unified Connector Auth Configuration Schema
 */
export const ConnectorAuthConfigSchema = lazySchema(() => z.discriminatedUnion('type', [
  ConnectorOAuth2Schema,
  ConnectorAPIKeySchema,
  ConnectorBasicAuthSchema,
  ConnectorBearerAuthSchema,
  ConnectorNoAuthSchema,
]));

export type ConnectorAuthConfig = z.infer<typeof ConnectorAuthConfigSchema>;
