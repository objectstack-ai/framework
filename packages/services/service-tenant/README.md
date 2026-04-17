# @objectstack/service-tenant

Multi-tenant context management and routing service for ObjectStack.

## Overview

This service provides tenant identification and context resolution for multi-tenant ObjectStack deployments. It supports multiple identification strategies and manages tenant-specific database routing.

## Features

- **Multiple Identification Sources**: Subdomain, custom domain, HTTP headers, JWT claims, session
- **UUID-Based Tenant Naming**: Immutable tenant identifiers (not organization slugs)
- **Tenant Context Caching**: Performance optimization for frequently accessed tenants
- **Flexible Configuration**: Priority-based identification source ordering

## Installation

```bash
pnpm add @objectstack/service-tenant
```

## Usage

### Basic Setup

```typescript
import { createTenantPlugin } from '@objectstack/service-tenant';
import { ObjectKernel } from '@objectstack/core';

const kernel = new ObjectKernel();

// Create tenant plugin
const tenantPlugin = createTenantPlugin({
  enabled: true,
  identificationSources: ['header', 'custom_domain', 'jwt_claim'],
  tenantHeaderName: 'X-Tenant-ID',
  customDomainMapping: {
    'app.acme.com': '550e8400-e29b-41d4-a716-446655440000',
  },
});

await kernel.use(tenantPlugin);
await kernel.bootstrap();
```

### Resolving Tenant Context

```typescript
import { TenantContextService } from '@objectstack/service-tenant';

const service = kernel.getService<TenantContextService>('tenant');

const context = await service.resolveTenantContext({
  hostname: 'app.acme.com',
  headers: {
    'X-Tenant-ID': '550e8400-e29b-41d4-a716-446655440000',
  },
  jwt: {
    organizationId: 'org-123',
  },
});

console.log(context);
// {
//   tenantId: '550e8400-e29b-41d4-a716-446655440000',
//   organizationId: 'org-123',
//   databaseUrl: 'libsql://550e8400-e29b-41d4-a716-446655440000.turso.io',
//   plan: 'pro'
// }
```

## Architecture

### Tenant Identification Flow

```
Request → TenantContextService → Identification Sources (in order)
                                  ↓
                           1. Subdomain
                           2. Custom Domain
                           3. HTTP Header
                           4. JWT Claim
                           5. Session
                           6. Default Tenant
                                  ↓
                           Tenant Context
```

### UUID-Based Naming

Tenant databases use UUID naming instead of organization slugs:

- **Why**: Organization slugs can be modified, UUIDs are immutable
- **Format**: `{uuid}.turso.io` (e.g., `550e8400-e29b-41d4-a716-446655440000.turso.io`)
- **Benefit**: Stable database URLs regardless of organization name changes

## Configuration

### TenantRoutingConfig

```typescript
interface TenantRoutingConfig {
  // Enable multi-tenant mode
  enabled: boolean;

  // Identification strategy (in order of precedence)
  identificationSources: TenantIdentificationSource[];

  // Default tenant ID (for single-tenant or fallback)
  defaultTenantId?: string;

  // Subdomain pattern for tenant extraction
  subdomainPattern?: string;

  // Custom domain to tenant ID mapping
  customDomainMapping?: Record<string, string>;

  // Header name for tenant ID
  tenantHeaderName: string; // Default: 'X-Tenant-ID'

  // JWT claim name for organization ID
  jwtOrganizationClaim: string; // Default: 'organizationId'
}
```

## Testing

```bash
# Run tests
pnpm test

# Run tests in watch mode
pnpm test:watch
```

## License

Apache-2.0
