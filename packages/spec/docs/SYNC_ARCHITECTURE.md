# Data Synchronization Architecture

ObjectStack implements a **3-layer architecture** for data synchronization and integration, designed to serve different audiences and use cases.

## Overview

| Level | Protocol | File | Audience | Use Case | Complexity |
|-------|----------|------|----------|----------|------------|
| **L1: Simple Sync** | `DataSyncConfig` | `automation/sync.zod.ts` | Business users | Sync Salesforce to Google Sheets | ⭐ Simple |
| **L2: ETL Pipeline** | `ETLPipeline` | `automation/etl.zod.ts` | Data engineers | Aggregate 10 sources to data warehouse | ⭐⭐ Moderate |
| **L3: Enterprise Connector** | `Connector` | `integration/connector.zod.ts` | System integrators | Full SAP integration with advanced features | ⭐⭐⭐ Advanced |

---

## Level 1: Simple Sync

**File:** `packages/spec/src/automation/sync.zod.ts`  
**Audience:** Business users, citizen developers  
**Complexity:** ⭐ Simple

### Purpose

Simple, user-friendly synchronization between two systems. Designed for business users who need straightforward data sync without writing code.

### Key Features

- ✅ Bidirectional or unidirectional sync (push/pull)
- ✅ Simple field mappings (name mapping only)
- ✅ Basic filters
- ✅ Scheduled or real-time sync
- ❌ NO complex transformations (use ETL for that)
- ❌ NO multi-source joins (use ETL for that)

### Use Cases

1. **CRM Integration** - Sync contacts between ObjectStack and Salesforce
2. **Marketing Automation** - Push leads to HubSpot
3. **Data Export** - Sync orders to Google Sheets for reporting

### Example

```typescript
import { DataSyncConfig } from '@objectstack/spec/automation';

const salesforceContactSync: DataSyncConfig = {
  name: 'salesforce_contact_sync',
  label: 'Salesforce Contact Sync',
  
  // Source: ObjectStack
  source: {
    object: 'contact',
    filters: { status: 'active' }
  },
  
  // Destination: Salesforce
  destination: {
    connectorInstanceId: 'salesforce_production',
    externalResource: 'Contact',
    operation: 'upsert',
    mapping: {
      first_name: 'FirstName',
      last_name: 'LastName',
      email: 'Email',
      phone: 'Phone'
    },
    matchKey: ['email']
  },
  
  direction: 'bidirectional',
  syncMode: 'incremental',
  conflictResolution: 'latest_wins',
  schedule: '0 * * * *', // Hourly
  enabled: true
};
```

### Best Practices

- Use for **single-source to single-destination** sync
- Keep mappings **simple** (field renaming only)
- Use **incremental mode** for large datasets
- Set appropriate **conflict resolution** strategy

---

## Level 2: ETL Pipeline

**File:** `packages/spec/src/automation/etl.zod.ts`  
**Audience:** Data engineers, analytics teams  
**Complexity:** ⭐⭐ Moderate

### Purpose

Advanced data pipelines for complex transformations, multi-source aggregation, and data warehouse population.

### Key Features

- ✅ Multi-source, multi-stage pipelines
- ✅ Complex transformations (join, aggregate, filter, custom SQL)
- ✅ Data normalization and deduplication
- ✅ Split/merge operations
- ✅ Incremental extraction with change data capture (CDC)
- ✅ Data quality validation

### Use Cases

1. **Data Warehouse Population** - Aggregate data from 10+ sources into Snowflake
2. **Business Intelligence** - Transform operational data for analytics
3. **Data Migration** - Move data from legacy systems to modern platforms
4. **Master Data Management** - Consolidate customer data from multiple systems

### Example

```typescript
import { ETLPipeline } from '@objectstack/spec/automation';

const dataWarehousePipeline: ETLPipeline = {
  name: 'customer_360_pipeline',
  label: 'Customer 360 Data Warehouse Pipeline',
  
  // Extract from Salesforce
  source: {
    type: 'api',
    connector: 'salesforce',
    config: {
      object: 'Account'
    },
    incremental: {
      enabled: true,
      cursorField: 'LastModifiedDate'
    }
  },
  
  // Transform: Join with support tickets, aggregate metrics
  transformations: [
    {
      type: 'join',
      config: {
        source: 'zendesk',
        joinKey: 'email',
        joinType: 'left'
      }
    },
    {
      type: 'aggregate',
      config: {
        groupBy: ['customer_id'],
        metrics: {
          total_tickets: 'COUNT(ticket_id)',
          avg_satisfaction: 'AVG(satisfaction_score)'
        }
      }
    },
    {
      type: 'filter',
      config: {
        condition: 'annual_revenue > 100000'
      }
    }
  ],
  
  // Load to Snowflake
  destination: {
    type: 'warehouse',
    connector: 'snowflake',
    config: {
      database: 'analytics',
      schema: 'customer_360',
      table: 'customers'
    },
    writeMode: 'upsert',
    primaryKey: ['customer_id']
  },
  
  syncMode: 'incremental',
  schedule: '0 2 * * *', // Daily at 2 AM
  enabled: true
};
```

### Transformation Types

| Type | Description | Example |
|------|-------------|---------|
| `map` | Field mapping/renaming | `{ 'old_name': 'new_name' }` |
| `filter` | Row filtering | `status == "active"` |
| `aggregate` | Aggregation/grouping | `SUM(revenue) BY customer_id` |
| `join` | Join with other data | `LEFT JOIN orders ON customer_id` |
| `script` | Custom JavaScript/Python | `return row.price * 1.1` |
| `lookup` | Enrich with reference data | Lookup country from zip code |
| `split` | Split one record into many | Split line items from order |
| `merge` | Merge multiple records | Deduplicate customers |
| `normalize` | Data normalization | Phone number formatting |
| `deduplicate` | Remove duplicates | Based on email |

### Best Practices

- Use **incremental sync** with cursor fields for large datasets
- Add **data quality checks** in transformation pipeline
- Monitor **pipeline performance** and optimize slow transformations
- Use **staging tables** for complex multi-stage pipelines
- Configure **alerting** for pipeline failures

---

## Level 3: Enterprise Connector

**File:** `packages/spec/src/integration/connector.zod.ts`  
**Audience:** System integrators, enterprise architects  
**Complexity:** ⭐⭐⭐ Advanced

### Purpose

Complete, production-grade integration with external systems. Includes authentication, security, webhooks, rate limiting, and full lifecycle management.

### Key Features

- ✅ **Authentication**: OAuth2, JWT, SAML, API Key, Basic Auth
- ✅ **Webhooks**: Bidirectional event notifications
- ✅ **Rate Limiting**: Token bucket, leaky bucket algorithms
- ✅ **Retry Policies**: Exponential backoff, circuit breaker
- ✅ **Field Mapping**: With transformations and data type conversion
- ✅ **Conflict Resolution**: Multiple strategies
- ✅ **Security**: Signature verification, encryption
- ✅ **Monitoring**: Health checks, metrics, logging

### Use Cases

1. **Enterprise SAP Integration** - Full bidirectional sync with complex business logic
2. **Financial System Integration** - PCI-compliant payment processor connector
3. **Identity Provider Sync** - SAML/OIDC integration with Okta/Auth0
4. **IoT Platform Integration** - Real-time data streaming from sensors

### Example

```typescript
import { Connector } from '@objectstack/spec/integration';

const sapConnector: Connector = {
  name: 'sap_erp_connector',
  label: 'SAP ERP Integration',
  type: 'saas',
  description: 'Enterprise-grade SAP ERP integration',
  
  // OAuth2 Authentication
  authentication: {
    type: 'oauth2',
    authorizationUrl: 'https://sap.example.com/oauth/authorize',
    tokenUrl: 'https://sap.example.com/oauth/token',
    clientId: process.env.SAP_CLIENT_ID!,
    clientSecret: process.env.SAP_CLIENT_SECRET!,
    scopes: ['read:orders', 'write:orders']
  },
  
  // Data Sync Configuration
  syncConfig: {
    strategy: 'incremental',
    direction: 'bidirectional',
    schedule: '*/15 * * * *', // Every 15 minutes
    realtimeSync: true,
    timestampField: 'updated_at',
    conflictResolution: 'latest_wins',
    batchSize: 1000,
    deleteMode: 'soft_delete'
  },
  
  // Field Mappings with Transformations
  fieldMappings: [
    {
      sourceField: 'customer_number',
      targetField: 'customer_id',
      dataType: 'string',
      required: true,
      syncMode: 'bidirectional'
    },
    {
      sourceField: 'order_value',
      targetField: 'order_total',
      dataType: 'number',
      transform: {
        type: 'custom',
        function: 'value => parseFloat(value) / 100' // Convert cents to dollars
      },
      syncMode: 'bidirectional'
    }
  ],
  
  // Webhooks for Real-time Events
  webhooks: [
    {
      name: 'order_created_webhook',
      url: 'https://api.objectstack.com/webhooks/sap/orders',
      events: ['record.created', 'record.updated'],
      secret: process.env.WEBHOOK_SECRET!,
      signatureAlgorithm: 'hmac_sha256',
      retryPolicy: {
        maxRetries: 3,
        backoffStrategy: 'exponential',
        initialDelayMs: 1000
      },
      timeoutMs: 30000,
      isActive: true
    }
  ],
  
  // Rate Limiting
  rateLimitConfig: {
    strategy: 'token_bucket',
    maxRequests: 100,
    windowSeconds: 60,
    burstCapacity: 150,
    respectUpstreamLimits: true
  },
  
  // Retry Configuration
  retryConfig: {
    strategy: 'exponential_backoff',
    maxAttempts: 5,
    initialDelayMs: 1000,
    maxDelayMs: 60000,
    backoffMultiplier: 2,
    retryableStatusCodes: [408, 429, 500, 502, 503, 504],
    retryOnNetworkError: true,
    jitter: true
  },
  
  connectionTimeoutMs: 30000,
  requestTimeoutMs: 60000,
  status: 'active',
  enabled: true
};
```

### Authentication Methods

| Method | Type | Use Case |
|--------|------|----------|
| `oauth2` | OAuth 2.0 | Modern SaaS applications (Salesforce, Google) |
| `jwt` | JSON Web Token | Microservices, API gateways |
| `saml` | SAML 2.0 | Enterprise SSO (Okta, Azure AD) |
| `api-key` | API Key | Simple API authentication |
| `basic` | Basic Auth | Legacy systems, simple authentication |
| `bearer` | Bearer Token | Token-based APIs |
| `none` | No Auth | Public APIs |

### Best Practices

- **Security First**: Always use encrypted credentials and secure storage
- **Rate Limiting**: Respect external API rate limits to avoid throttling
- **Error Handling**: Implement comprehensive retry logic with exponential backoff
- **Monitoring**: Set up health checks and alerting for connector failures
- **Testing**: Test authentication, sync, and webhook flows thoroughly
- **Documentation**: Document field mappings and business logic

---

## Choosing the Right Level

### Decision Matrix

| Question | Answer → Level |
|----------|----------------|
| Do you need complex transformations (joins, aggregations)? | **Yes** → L2 (ETL) |
| Do you need multi-source aggregation? | **Yes** → L2 (ETL) |
| Do you need real-time webhooks? | **Yes** → L3 (Connector) |
| Do you need advanced authentication (OAuth2, SAML)? | **Yes** → L3 (Connector) |
| Do you need rate limiting and retry policies? | **Yes** → L3 (Connector) |
| Is it a simple point-to-point sync? | **Yes** → L1 (Simple Sync) |
| Are you a business user with no coding? | **Yes** → L1 (Simple Sync) |
| Are you building a data warehouse pipeline? | **Yes** → L2 (ETL) |
| Are you integrating with an enterprise system? | **Yes** → L3 (Connector) |

### Common Patterns

#### Pattern 1: CRM Sync (L1)
```
ObjectStack → Simple Sync → Salesforce
```
Use **L1 Simple Sync** for straightforward bidirectional sync.

#### Pattern 2: Analytics Pipeline (L2)
```
Salesforce → ETL → Transform → Snowflake
HubSpot    ↗           ↘ Analytics Dashboard
Stripe     ↗
```
Use **L2 ETL Pipeline** for multi-source data warehousing.

#### Pattern 3: Enterprise Integration (L3)
```
ObjectStack ↔ Enterprise Connector ↔ SAP
                    ↓
               Webhooks, Auth, Rate Limiting
```
Use **L3 Enterprise Connector** for production-grade integrations.

#### Pattern 4: Hybrid Approach
```
External API → L3 Connector → ObjectStack
ObjectStack → L2 ETL → Data Warehouse
ObjectStack → L1 Sync → Google Sheets
```
Combine levels for complex scenarios.

---

## Migration Guide

### From L1 to L2

When your simple sync needs complex transformations:

**Before (L1):**
```typescript
const sync: DataSyncConfig = {
  name: 'order_sync',
  source: { object: 'order' },
  destination: { object: 'analytics_order' }
};
```

**After (L2):**
```typescript
const pipeline: ETLPipeline = {
  name: 'order_analytics_pipeline',
  source: { type: 'object', config: { object: 'order' } },
  transformations: [
    { type: 'aggregate', config: { groupBy: ['customer_id'] } }
  ],
  destination: { type: 'database', config: { table: 'analytics_order' } }
};
```

### From L2 to L3

When your ETL pipeline needs webhooks, advanced auth, or rate limiting:

**Before (L2):**
```typescript
const pipeline: ETLPipeline = {
  source: { type: 'api', connector: 'external_api' }
};
```

**After (L3):**
```typescript
const connector: Connector = {
  authentication: { type: 'oauth2', ... },
  webhooks: [...],
  rateLimitConfig: { ... }
};
```

---

## API Reference

### Level 1: Simple Sync
- [DataSyncConfig Schema](../src/automation/sync.zod.ts)
- [Field Mapping](../src/automation/sync.zod.ts#L97)
- [Sync Execution Result](../src/automation/sync.zod.ts#L380)

### Level 2: ETL Pipeline
- [ETLPipeline Schema](../src/automation/etl.zod.ts)
- [ETL Transformations](../src/automation/etl.zod.ts#L151)
- [ETL Run Result](../src/automation/etl.zod.ts#L316)

### Level 3: Enterprise Connector
- [Connector Schema](../src/integration/connector.zod.ts)
- [Authentication](../src/auth/config.zod.ts)
- [Webhooks](../src/automation/webhook.zod.ts)

---

## Related Documentation

- [Webhook Protocol](./WEBHOOK_PROTOCOL.md)
- [Authentication Guide](./AUTHENTICATION.md)
- [Best Practices](./BEST_PRACTICES.md)
