// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type {
  TenantContext,
  TenantIdentificationSource,
  TenantRoutingConfig,
} from '@objectstack/spec/cloud';

/**
 * Tenant Context Service
 *
 * Manages tenant identification and context resolution from HTTP requests.
 * Supports multiple identification strategies:
 * - Subdomain extraction (e.g., acme.objectstack.app)
 * - Custom domain mapping
 * - HTTP headers (X-Tenant-ID)
 * - JWT claims (organizationId)
 * - Session data
 */
export class TenantContextService {
  private config: TenantRoutingConfig;
  private tenantCache = new Map<string, TenantContext>();

  constructor(config: TenantRoutingConfig) {
    this.config = config;
  }

  /**
   * Extract tenant context from request
   *
   * @param request - HTTP request object with headers, hostname, etc.
   * @returns Tenant context or null if multi-tenant is disabled
   */
  async resolveTenantContext(request: {
    hostname?: string;
    headers?: Record<string, string | string[] | undefined>;
    session?: { organizationId?: string };
    jwt?: Record<string, unknown>;
  }): Promise<TenantContext | null> {
    if (!this.config.enabled) {
      return null;
    }

    // Try each identification source in order of precedence
    for (const source of this.config.identificationSources) {
      const tenantId = await this.extractTenantId(request, source);
      if (tenantId) {
        return this.getTenantContextById(tenantId, source);
      }
    }

    // Fallback to default tenant if configured
    if (this.config.defaultTenantId) {
      return this.getTenantContextById(this.config.defaultTenantId, 'default');
    }

    return null;
  }

  /**
   * Extract tenant ID from request using specific identification source
   */
  private async extractTenantId(
    request: {
      hostname?: string;
      headers?: Record<string, string | string[] | undefined>;
      session?: { organizationId?: string };
      jwt?: Record<string, unknown>;
    },
    source: TenantIdentificationSource,
  ): Promise<string | null> {
    switch (source) {
      case 'subdomain':
        return this.extractFromSubdomain(request.hostname);

      case 'custom_domain':
        return this.extractFromCustomDomain(request.hostname);

      case 'header':
        return this.extractFromHeader(request.headers);

      case 'jwt_claim':
        return this.extractFromJWT(request.jwt);

      case 'session':
        return this.extractFromSession(request.session);

      case 'default':
        return this.config.defaultTenantId || null;

      default:
        return null;
    }
  }

  /**
   * Extract tenant from subdomain
   * Example: "acme.objectstack.app" -> resolve to tenant with org slug "acme"
   */
  private extractFromSubdomain(hostname?: string): string | null {
    if (!hostname || !this.config.subdomainPattern) {
      return null;
    }

    // Extract tenant slug from subdomain
    // Pattern: "{tenant}.objectstack.app"
    const parts = hostname.split('.');
    if (parts.length < 2) {
      return null;
    }

    void parts[0];
    return null;
  }

  /**
   * Extract tenant from custom domain mapping
   * Example: "app.acme.com" -> "550e8400-e29b-41d4-a716-446655440000"
   */
  private extractFromCustomDomain(hostname?: string): string | null {
    if (!hostname || !this.config.customDomainMapping) {
      return null;
    }

    return this.config.customDomainMapping[hostname] || null;
  }

  /**
   * Extract tenant from HTTP header
   */
  private extractFromHeader(headers?: Record<string, string | string[] | undefined>): string | null {
    if (!headers) {
      return null;
    }

    const headerValue = headers[this.config.tenantHeaderName];
    if (typeof headerValue === 'string') {
      return headerValue;
    }

    if (Array.isArray(headerValue) && headerValue.length > 0) {
      return headerValue[0];
    }

    return null;
  }

  /**
   * Extract tenant from JWT claim
   */
  private extractFromJWT(jwt?: Record<string, unknown>): string | null {
    if (!jwt) {
      return null;
    }

    const organizationId = jwt[this.config.jwtOrganizationClaim];
    if (typeof organizationId === 'string') {
      // In real implementation, lookup tenant ID by organization ID
      // For now, return the organization ID as tenant ID
      return organizationId;
    }

    return null;
  }

  /**
   * Extract tenant from session
   */
  private extractFromSession(session?: { organizationId?: string }): string | null {
    if (!session?.organizationId) {
      return null;
    }

    // In real implementation, lookup tenant ID by organization ID
    // For now, return the organization ID as tenant ID
    return session.organizationId;
  }

  /**
   * Get tenant context by ID
   * In real implementation, this would query the global database
   * for tenant registry information
   */
  private async getTenantContextById(
    tenantId: string,
    _source: TenantIdentificationSource,
  ): Promise<TenantContext | null> {
    // Check cache first
    const cached = this.tenantCache.get(tenantId);
    if (cached) {
      return cached;
    }

    // In real implementation, query global database for tenant info
    // For now, return a minimal context
    const context: TenantContext = {
      tenantId,
      organizationId: tenantId, // Placeholder
      databaseUrl: `libsql://${tenantId}.turso.io`,
      plan: 'free',
    };

    // Cache the context
    this.tenantCache.set(tenantId, context);

    return context;
  }

  /**
   * Clear tenant cache
   */
  clearCache(): void {
    this.tenantCache.clear();
  }

  /**
   * Invalidate specific tenant from cache
   */
  invalidateTenant(tenantId: string): void {
    this.tenantCache.delete(tenantId);
  }
}
