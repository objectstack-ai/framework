// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { z } from 'zod';
import { HttpMethod, CorsConfigSchema, RateLimitConfigSchema, StaticMountSchema } from '../shared/http.zod';

/**
 * HTTP Server Protocol
 * 
 * Defines the runtime HTTP server configuration and capabilities.
 * Provides abstractions for HTTP server implementations (Express, Fastify, Hono, etc.)
 * 
 * Architecture alignment:
 * - Kubernetes: Service and Ingress resources
 * - AWS: API Gateway configuration
 * - Spring Boot: Application properties
 */

// ==========================================
// Server Configuration
// ==========================================

/**
 * HTTP Server Configuration Schema
 * Core configuration for HTTP server instances
 * 
 * @example
 * {
 *   "port": 3000,
 *   "host": "0.0.0.0",
 *   "cors": {
 *     "enabled": true,
 *     "origins": ["http://localhost:3000"]
 *   },
 *   "compression": true,
 *   "requestTimeout": 30000
 * }
 */
import { lazySchema } from '../shared/lazy-schema';
export const HttpServerConfigSchema = lazySchema(() => z.object({
  /**
   * Server port number
   */
  port: z.number().int().min(1).max(65535).default(3000).describe('Port number to listen on'),
  
  /**
   * Server host address
   */
  host: z.string().default('0.0.0.0').describe('Host address to bind to'),
  
  /**
   * CORS configuration
   */
  cors: CorsConfigSchema.optional().describe('CORS configuration'),
  
  /**
   * Request handling options
   */
  requestTimeout: z.number().int().default(30000).describe('Request timeout in milliseconds'),
  bodyLimit: z.string().default('10mb').describe('Maximum request body size'),
  
  /**
   * Compression settings
   */
  compression: z.boolean().default(true).describe('Enable response compression'),
  
  /**
   * Security headers
   */
  security: z.object({
    helmet: z.boolean().default(true).describe('Enable security headers via helmet'),
    rateLimit: RateLimitConfigSchema.optional().describe('Global rate limiting configuration'),
  }).optional().describe('Security configuration'),
  
  /**
   * Static file serving
   */
  static: z.array(StaticMountSchema).optional().describe('Static file serving configuration'),
  
  /**
   * Trust proxy settings
   */
  trustProxy: z.boolean().default(false).describe('Trust X-Forwarded-* headers'),
}));

export type HttpServerConfig = z.infer<typeof HttpServerConfigSchema>;
export type HttpServerConfigInput = z.input<typeof HttpServerConfigSchema>;

// ==========================================
// Route Registration
// ==========================================

/**
 * Route Handler Metadata Schema
 * Metadata for route handlers used in registration
 */
export const RouteHandlerMetadataSchema = lazySchema(() => z.object({
  /**
   * HTTP method
   */
  method: HttpMethod.describe('HTTP method'),
  
  /**
   * URL path pattern (supports parameters like /api/users/:id)
   */
  path: z.string().describe('URL path pattern'),
  
  /**
   * Handler function name or identifier
   */
  handler: z.string().describe('Handler identifier or name'),
  
  /**
   * Route metadata
   */
  metadata: z.object({
    summary: z.string().optional().describe('Route summary for documentation'),
    description: z.string().optional().describe('Route description'),
    tags: z.array(z.string()).optional().describe('Tags for grouping'),
    operationId: z.string().optional().describe('Unique operation identifier'),
  }).optional(),
  
  /**
   * Security requirements
   */
  security: z.object({
    authRequired: z.boolean().default(true).describe('Require authentication'),
    permissions: z.array(z.string()).optional().describe('Required permissions'),
    rateLimit: z.string().optional().describe('Rate limit policy override'),
  }).optional(),
}));

export type RouteHandlerMetadata = z.infer<typeof RouteHandlerMetadataSchema>;
export type RouteHandlerMetadataInput = z.input<typeof RouteHandlerMetadataSchema>;

// ==========================================
// Middleware Configuration
// ==========================================

/**
 * Middleware Type Enum
 */
export const MiddlewareType = z.enum([
  'authentication',  // Authentication middleware
  'authorization',   // Authorization/permission checks
  'logging',         // Request/response logging
  'validation',      // Input validation
  'transformation',  // Request/response transformation
  'error',          // Error handling
  'custom',         // Custom middleware
]);

export type MiddlewareType = z.infer<typeof MiddlewareType>;

/**
 * Middleware Configuration Schema
 * Defines middleware execution order and configuration
 * 
 * @example
 * {
 *   "name": "auth_middleware",
 *   "type": "authentication",
 *   "enabled": true,
 *   "order": 10,
 *   "config": {
 *     "jwtSecret": "secret",
 *     "excludePaths": ["/health", "/metrics"]
 *   }
 * }
 */
export const MiddlewareConfigSchema = lazySchema(() => z.object({
  /**
   * Middleware identifier
   */
  name: z.string().regex(/^[a-z_][a-z0-9_]*$/).describe('Middleware name (snake_case)'),
  
  /**
   * Middleware type
   */
  type: MiddlewareType.describe('Middleware type'),
  
  /**
   * Enable/disable middleware
   */
  enabled: z.boolean().default(true).describe('Whether middleware is enabled'),
  
  /**
   * Execution order (lower numbers execute first)
   */
  order: z.number().int().default(100).describe('Execution order priority'),
  
  /**
   * Middleware-specific configuration
   */
  config: z.record(z.string(), z.unknown()).optional().describe('Middleware configuration object'),
  
  /**
   * Path patterns to apply middleware to
   */
  paths: z.object({
    include: z.array(z.string()).optional().describe('Include path patterns (glob)'),
    exclude: z.array(z.string()).optional().describe('Exclude path patterns (glob)'),
  }).optional().describe('Path filtering'),
}));

export type MiddlewareConfig = z.infer<typeof MiddlewareConfigSchema>;
export type MiddlewareConfigInput = z.input<typeof MiddlewareConfigSchema>;

// ==========================================
// Server Lifecycle Events
// ==========================================

/**
 * Server Event Type Enum
 */
export const ServerEventType = z.enum([
  'starting',      // Server is starting
  'started',       // Server has started and is listening
  'stopping',      // Server is stopping
  'stopped',       // Server has stopped
  'request',       // Request received
  'response',      // Response sent
  'error',         // Error occurred
]);

export type ServerEventType = z.infer<typeof ServerEventType>;

/**
 * Server Event Schema
 * Events emitted by the HTTP server during lifecycle
 */
export const ServerEventSchema = lazySchema(() => z.object({
  /**
   * Event type
   */
  type: ServerEventType.describe('Event type'),
  
  /**
   * Timestamp
   */
  timestamp: z.string().datetime().describe('Event timestamp (ISO 8601)'),
  
  /**
   * Event payload
   */
  data: z.record(z.string(), z.unknown()).optional().describe('Event-specific data'),
}));

export type ServerEvent = z.infer<typeof ServerEventSchema>;

// ==========================================
// Server Capability Declaration
// ==========================================

/**
 * Server Capabilities Schema
 * Declares what features a server implementation supports
 */
export const ServerCapabilitiesSchema = lazySchema(() => z.object({
  /**
   * Supported HTTP versions
   */
  httpVersions: z.array(z.enum(['1.0', '1.1', '2.0', '3.0'])).default(['1.1']).describe('Supported HTTP versions'),
  
  /**
   * WebSocket support
   */
  websocket: z.boolean().default(false).describe('WebSocket support'),
  
  /**
   * Server-Sent Events support
   */
  sse: z.boolean().default(false).describe('Server-Sent Events support'),
  
  /**
   * HTTP/2 Server Push
   */
  serverPush: z.boolean().default(false).describe('HTTP/2 Server Push support'),
  
  /**
   * Streaming support
   */
  streaming: z.boolean().default(true).describe('Response streaming support'),
  
  /**
   * Middleware support
   */
  middleware: z.boolean().default(true).describe('Middleware chain support'),
  
  /**
   * Route parameterization
   */
  routeParams: z.boolean().default(true).describe('URL parameter support (/users/:id)'),
  
  /**
   * Built-in compression
   */
  compression: z.boolean().default(true).describe('Built-in compression support'),
}));

export type ServerCapabilities = z.infer<typeof ServerCapabilitiesSchema>;
export type ServerCapabilitiesInput = z.input<typeof ServerCapabilitiesSchema>;

// ==========================================
// Server Status & Metrics
// ==========================================

/**
 * Server Status Schema
 * Current operational status of the server
 */
export const ServerStatusSchema = lazySchema(() => z.object({
  /**
   * Server state
   */
  state: z.enum(['stopped', 'starting', 'running', 'stopping', 'error']).describe('Current server state'),
  
  /**
   * Uptime in milliseconds
   */
  uptime: z.number().int().optional().describe('Server uptime in milliseconds'),
  
  /**
   * Server information
   */
  server: z.object({
    port: z.number().int().describe('Listening port'),
    host: z.string().describe('Bound host'),
    url: z.string().optional().describe('Full server URL'),
  }).optional(),
  
  /**
   * Connection metrics
   */
  connections: z.object({
    active: z.number().int().describe('Active connections'),
    total: z.number().int().describe('Total connections handled'),
  }).optional(),
  
  /**
   * Request metrics
   */
  requests: z.object({
    total: z.number().int().describe('Total requests processed'),
    success: z.number().int().describe('Successful requests'),
    errors: z.number().int().describe('Failed requests'),
  }).optional(),
}));

export type ServerStatus = z.infer<typeof ServerStatusSchema>;

// ==========================================
// Helper Functions
// ==========================================

/**
 * Helper to create HTTP server configuration
 */
export const HttpServerConfig = Object.assign(HttpServerConfigSchema, {
  create: <T extends z.input<typeof HttpServerConfigSchema>>(config: T) => config,
});

/**
 * Helper to create middleware configuration
 */
export const MiddlewareConfig = Object.assign(MiddlewareConfigSchema, {
  create: <T extends z.input<typeof MiddlewareConfigSchema>>(config: T) => config,
});
