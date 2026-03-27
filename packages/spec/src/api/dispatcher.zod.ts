// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { z } from 'zod';
import { CoreServiceName, ServiceCriticalitySchema } from '../system/core-services.zod';

/**
 * # HttpDispatcher Protocol
 * 
 * Defines how the ObjectStack HttpDispatcher routes incoming API requests
 * to the correct kernel service based on URL prefix matching.
 * 
 * The dispatcher is the central routing component that:
 * 1. Matches incoming request URLs against registered route prefixes
 * 2. Delegates to the corresponding CoreService implementation
 * 3. Returns 503 Service Unavailable when a service is not registered
 * 4. Supports dynamic route registration from plugins via contributes.routes
 * 
 * Architecture alignment:
 * - Kubernetes: API server aggregation layer
 * - Eclipse: Extension registry routing
 * - VS Code: Command palette routing
 */

// ============================================================================
// Route Definition
// ============================================================================

/**
 * Dispatcher Route Schema
 * Maps a URL prefix to a kernel service.
 * 
 * @example
 * {
 *   "prefix": "/api/v1/data",
 *   "service": "data",
 *   "authRequired": true,
 *   "criticality": "required"
 * }
 */
export const DispatcherRouteSchema = z.object({
  /**
   * URL path prefix for routing.
   * Incoming requests matching this prefix are routed to the target service.
   * Must start with '/'.
   */
  prefix: z.string().regex(/^\//).describe('URL path prefix for routing (e.g. /api/v1/data)'),
  
  /**
   * Target core service name.
   * The service that handles requests matching this prefix.
   */
  service: CoreServiceName.describe('Target core service name'),
  
  /**
   * Whether requests to this route require authentication.
   * Discovery endpoint is typically public; most others require auth.
   * @default true
   */
  authRequired: z.boolean().default(true).describe('Whether authentication is required'),
  
  /**
   * Service criticality level.
   * Determines behavior when the service is unavailable:
   * - required: return 500 Internal Server Error
   * - core: return 503 with degraded notice
   * - optional: return 503 Service Unavailable
   * @default 'optional'
   */
  criticality: ServiceCriticalitySchema.default('optional')
    .describe('Service criticality level for unavailability handling'),
  
  /**
   * Required permissions for accessing this route namespace.
   * Applied as a baseline before individual endpoint permission checks.
   */
  permissions: z.array(z.string()).optional()
    .describe('Required permissions for this route namespace'),
});

export type DispatcherRoute = z.infer<typeof DispatcherRouteSchema>;
export type DispatcherRouteInput = z.input<typeof DispatcherRouteSchema>;

// ============================================================================
// Dispatcher Configuration
// ============================================================================

/**
 * Dispatcher Configuration Schema
 * Complete configuration for the HttpDispatcher routing table.
 * 
 * @example
 * {
 *   "routes": [
 *     { "prefix": "/api/v1/discovery", "service": "metadata", "authRequired": false },
 *     { "prefix": "/api/v1/meta", "service": "metadata" },
 *     { "prefix": "/api/v1/data", "service": "data", "criticality": "required" },
 *     { "prefix": "/api/v1/auth", "service": "auth", "criticality": "required" },
 *     { "prefix": "/api/v1/ai", "service": "ai" }
 *   ],
 *   "fallback": "404"
 * }
 */
export const DispatcherConfigSchema = z.object({
  /**
   * Registered route mappings.
   * Routes are matched by longest-prefix-first strategy.
   */
  routes: z.array(DispatcherRouteSchema).describe('Route-to-service mappings'),
  
  /**
   * Behavior when no route matches the request.
   * - 404: Return 404 Not Found (default)
   * - proxy: Forward to a configured proxy target
   * - custom: Delegate to a custom handler
   * @default '404'
   */
  fallback: z.enum(['404', 'proxy', 'custom']).default('404')
    .describe('Behavior when no route matches'),
  
  /**
   * Proxy target URL for fallback: 'proxy' mode.
   */
  proxyTarget: z.string().url().optional()
    .describe('Proxy target URL when fallback is "proxy"'),
});

export type DispatcherConfig = z.infer<typeof DispatcherConfigSchema>;
export type DispatcherConfigInput = z.input<typeof DispatcherConfigSchema>;

// ============================================================================
// Default Route Table
// ============================================================================

/**
 * Default route table for the ObjectStack HttpDispatcher.
 * Maps all Protocol namespaces to their corresponding services.
 * 
 * This is the recommended baseline configuration. Plugins can extend
 * this table by declaring routes in their manifest's contributes.routes.
 */
export const DEFAULT_DISPATCHER_ROUTES: DispatcherRouteInput[] = [
  // Discovery (public)
  { prefix: '/api/v1/discovery', service: 'metadata', authRequired: false, criticality: 'required' },
  
  // Required Services
  { prefix: '/api/v1/meta',     service: 'metadata',  criticality: 'required' },
  { prefix: '/api/v1/data',     service: 'data',      criticality: 'required' },
  { prefix: '/api/v1/auth',     service: 'auth',      criticality: 'required' },
  
  // Optional Services (plugin-provided)
  { prefix: '/api/v1/packages',      service: 'metadata' },
  { prefix: '/api/v1/ui',            service: 'ui' }, // @deprecated — use /api/v1/meta/view and /api/v1/meta/dashboard instead
  { prefix: '/api/v1/workflow',      service: 'workflow' },
  { prefix: '/api/v1/analytics',     service: 'analytics' },
  { prefix: '/api/v1/automation',    service: 'automation' },
  { prefix: '/api/v1/storage',       service: 'file-storage' },
  { prefix: '/api/v1/feed',          service: 'data' },
  { prefix: '/api/v1/i18n',          service: 'i18n' },
  { prefix: '/api/v1/notifications', service: 'notification' },
  { prefix: '/api/v1/realtime',      service: 'realtime' },
  { prefix: '/api/v1/ai',            service: 'ai' },
];
