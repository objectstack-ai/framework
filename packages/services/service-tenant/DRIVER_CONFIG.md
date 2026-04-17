# Organization Database Driver Configuration

## Overview

Organizations in ObjectStack can now choose their own database driver, enabling flexible deployment scenarios:

- **Development/Testing**: Use `memory` driver for fast, ephemeral data
- **Production Cloud**: Use `turso` driver for edge-ready cloud deployment
- **Enterprise On-Premise**: Use `sql` driver with PostgreSQL/MySQL/etc.
- **Local Development**: Use `sqlite` driver for file-based storage
- **Custom Solutions**: Use `custom` driver for proprietary implementations

## Supported Drivers

### 1. Turso Driver (Production Cloud)

```typescript
const driverConfig = {
  driver: 'turso',
  databaseUrl: 'libsql://uuid.turso.io',
  authToken: process.env.TURSO_AUTH_TOKEN!,
  region: 'us-east-1', // optional
  syncUrl: 'libsql://sync.turso.io', // optional for embedded replicas
};
```

**Use Cases:**
- Production SaaS deployments
- Edge-ready applications
- Global distribution

### 2. Memory Driver (Development/Testing)

```typescript
const driverConfig = {
  driver: 'memory',
  persistent: false, // data lost on restart
  dataFile: '/tmp/org-dev.db', // optional for persistence
};
```

**Use Cases:**
- Unit testing
- Integration testing
- Rapid prototyping
- Metadata schema development

### 3. SQL Driver (Enterprise)

```typescript
const driverConfig = {
  driver: 'sql',
  dialect: 'postgresql', // or 'mysql', 'mariadb', 'mssql'
  host: 'localhost',
  port: 5432,
  database: 'org_enterprise_001',
  username: 'app_user',
  password: process.env.DB_PASSWORD!,
  ssl: true,
  pool: {
    min: 2,
    max: 10,
  },
};
```

**Use Cases:**
- Enterprise on-premise deployments
- Regulatory/compliance requirements
- Existing PostgreSQL/MySQL infrastructure

### 4. SQLite Driver (Local Development)

```typescript
const driverConfig = {
  driver: 'sqlite',
  filename: '/data/org-local.db',
  readonly: false,
};
```

**Use Cases:**
- Local development
- Embedded applications
- Portable database files

### 5. Custom Driver

```typescript
const driverConfig = {
  driver: 'custom',
  driverName: 'my-custom-driver',
  config: {
    endpoint: 'https://api.custom-db.com',
    apiKey: process.env.CUSTOM_API_KEY!,
    // ... driver-specific config
  },
};
```

**Use Cases:**
- Proprietary database systems
- Third-party integrations
- Specialized storage solutions

## Usage Examples

### Provision Organization with Driver

```typescript
import { TenantProvisioningService } from '@objectstack/service-tenant';

const provisioningService = new TenantProvisioningService({
  controlPlaneDriver: globalDriver,
  defaultStorageLimitMb: 1024,
});

// Production: Turso driver
const result = await provisioningService.provisionTenant({
  organizationId: 'org-prod-001',
  driverConfig: {
    driver: 'turso',
    databaseUrl: 'libsql://550e8400.turso.io',
    authToken: process.env.TURSO_TOKEN!,
  },
  plan: 'pro',
  storageLimitMb: 5120,
});

console.log('Tenant provisioned:', result.tenant.id);
```

### Get Driver for Organization

```typescript
import { TenantContextService } from '@objectstack/service-tenant';

const tenantContext = new TenantContextService({
  enabled: true,
  controlPlaneDriver: globalDriver,
  driverFactoryConfig: {
    driverConstructors: new Map([
      ['turso', TursoDriver],
      ['memory', InMemoryDriver],
      ['sql', SQLDriver],
    ]),
  },
});

// Get driver instance for an organization
const driver = await tenantContext.getDriverForOrganization('org-001');

// Use driver for data operations
const users = await driver.find('user', {
  filter: { status: 'active' },
});
```

### Driver Factory Setup

```typescript
import { DriverFactory } from '@objectstack/service-tenant';
import { TursoDriver } from '@objectstack/driver-turso';
import { InMemoryDriver } from '@objectstack/driver-memory';
import { SQLDriver } from '@objectstack/driver-sql';

const factory = new DriverFactory({
  driverConstructors: new Map([
    ['turso', TursoDriver],
    ['memory', InMemoryDriver],
    ['sql', SQLDriver],
  ]),
});

// Create driver from config
const driver = await factory.create(driverConfig);
```

## Migration Guide

### From Hardcoded Turso to Flexible Drivers

**Before:**
```typescript
const tenant = {
  id: 'uuid',
  organizationId: 'org-001',
  databaseName: 'uuid',
  databaseUrl: 'libsql://uuid.turso.io',
  authToken: 'encrypted-token',
  region: 'us-east-1',
  // ...
};
```

**After:**
```typescript
const tenant = {
  id: 'uuid',
  organizationId: 'org-001',
  driverConfig: {
    driver: 'turso',
    databaseUrl: 'libsql://uuid.turso.io',
    authToken: 'encrypted-token',
    region: 'us-east-1',
  },
  // ...
};
```

### Updating Control Plane Schema

The `sys_tenant_database` object now uses `driver_config` instead of separate fields:

```sql
-- Old schema (deprecated)
database_name TEXT
database_url TEXT
auth_token TEXT
region TEXT

-- New schema
driver_config TEXT -- JSON-serialized DriverConfig
```

## Best Practices

### 1. Development Setup
```typescript
// Use memory driver for fast tests
const devConfig = {
  driver: 'memory',
  persistent: false,
};
```

### 2. Staging Environment
```typescript
// Use SQLite for staging
const stagingConfig = {
  driver: 'sqlite',
  filename: '/data/staging.db',
};
```

### 3. Production Multi-Region
```typescript
// Use Turso with regional endpoints
const prodConfig = {
  driver: 'turso',
  databaseUrl: 'libsql://org-us-east.turso.io',
  authToken: process.env.TURSO_TOKEN!,
  region: 'us-east-1',
};
```

### 4. Enterprise Compliance
```typescript
// Use on-premise PostgreSQL
const enterpriseConfig = {
  driver: 'sql',
  dialect: 'postgresql',
  host: 'internal-db.company.com',
  database: 'org_data',
  ssl: true,
};
```

## Architecture Benefits

1. **Flexibility**: Choose the right storage for each use case
2. **Development Speed**: Use memory driver for rapid iteration
3. **Cost Optimization**: Scale storage based on needs
4. **Compliance**: Meet data residency requirements
5. **Future-Proof**: Easy to add new driver types

## Type Safety

All driver configurations are type-safe using discriminated unions:

```typescript
type DriverConfig =
  | TursoDriverConfig
  | MemoryDriverConfig
  | SQLDriverConfig
  | SQLiteDriverConfig
  | CustomDriverConfig;

// TypeScript knows which fields are available
if (config.driver === 'turso') {
  console.log(config.databaseUrl); // ✅ OK
  console.log(config.host); // ❌ Error: Property 'host' does not exist
}
```

## Testing

```typescript
import { describe, it, expect } from 'vitest';
import { TenantProvisioningService } from '@objectstack/service-tenant';

describe('Multi-Driver Support', () => {
  it('should provision with memory driver', async () => {
    const service = new TenantProvisioningService();

    const result = await service.provisionTenant({
      organizationId: 'test-org',
      driverConfig: {
        driver: 'memory',
        persistent: false,
      },
    });

    expect(result.tenant.driverConfig.driver).toBe('memory');
  });
});
```

## Troubleshooting

### Driver Constructor Not Registered

```typescript
// Error: "Turso driver constructor not registered"

// Solution: Register constructor in factory
const factory = new DriverFactory({
  driverConstructors: new Map([
    ['turso', TursoDriver], // Add this
  ]),
});
```

### Cache Issues

```typescript
// Clear driver cache if needed
factory.clearCache();

// Or invalidate specific driver
factory.invalidateDriver('turso:libsql://uuid.turso.io');
```

## Further Reading

- [Turso Driver Documentation](../driver-turso/README.md)
- [Memory Driver Documentation](../driver-memory/README.md)
- [SQL Driver Documentation](../driver-sql/README.md)
- [Multi-Tenant Architecture](../../docs/MULTI_TENANT.md)
