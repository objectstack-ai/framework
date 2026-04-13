// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { z } from 'zod';
import { FieldType } from '../data/field.zod';

/**
 * GraphQL Protocol Support
 * 
 * GraphQL is a query language for APIs and a runtime for executing those queries.
 * It provides a complete and understandable description of the data in your API,
 * gives clients the power to ask for exactly what they need, and enables powerful
 * developer tools.
 * 
 * ## Overview
 * 
 * GraphQL provides:
 * - Type-safe schema definition
 * - Precise data fetching (no over/under-fetching)
 * - Introspection and documentation
 * - Real-time subscriptions
 * - Batched queries with DataLoader
 * 
 * ## Use Cases
 * 
 * 1. **Modern API Development**
 *    - Mobile and web applications
 *    - Microservices federation
 *    - Real-time dashboards
 * 
 * 2. **Data Aggregation**
 *    - Multi-source data integration
 *    - Complex nested queries
 *    - Efficient data loading
 * 
 * 3. **Developer Experience**
 *    - Self-documenting API
 *    - Type safety and validation
 *    - GraphQL playground
 * 
 * @see https://graphql.org/
 * @see https://spec.graphql.org/
 * 
 * @example GraphQL Query
 * ```graphql
 * query GetCustomer($id: ID!) {
 *   customer(id: $id) {
 *     id
 *     name
 *     email
 *     orders(limit: 10, status: "active") {
 *       id
 *       total
 *       items {
 *         product {
 *           name
 *           price
 *         }
 *       }
 *     }
 *   }
 * }
 * ```
 * 
 * @example GraphQL Mutation
 * ```graphql
 * mutation CreateOrder($input: CreateOrderInput!) {
 *   createOrder(input: $input) {
 *     id
 *     orderNumber
 *     status
 *   }
 * }
 * ```
 */

// ==========================================
// 1. GraphQL Type System
// ==========================================

/**
 * GraphQL Scalar Types
 * 
 * Built-in scalar types in GraphQL plus custom scalars.
 */
export const GraphQLScalarType = z.enum([
  // Built-in GraphQL Scalars
  'ID',
  'String',
  'Int',
  'Float',
  'Boolean',
  
  // Extended Scalars (common custom types)
  'DateTime',
  'Date',
  'Time',
  'JSON',
  'JSONObject',
  'Upload',
  'URL',
  'Email',
  'PhoneNumber',
  'Currency',
  'Decimal',
  'BigInt',
  'Long',
  'UUID',
  'Base64',
  'Void',
]);

export type GraphQLScalarType = z.infer<typeof GraphQLScalarType>;

/**
 * GraphQL Type Configuration
 * 
 * Configuration for generating GraphQL types from Object definitions.
 */
export const GraphQLTypeConfigSchema = z.object({
  /** Type name in GraphQL schema */
  name: z.string().describe('GraphQL type name (PascalCase recommended)'),
  
  /** Source Object name */
  object: z.string().describe('Source ObjectQL object name'),
  
  /** Description for GraphQL schema documentation */
  description: z.string().optional().describe('Type description'),
  
  /** Fields to include/exclude */
  fields: z.object({
    /** Include only these fields (allow list) */
    include: z.array(z.string()).optional().describe('Fields to include'),
    
    /** Exclude these fields (deny list) */
    exclude: z.array(z.string()).optional().describe('Fields to exclude (e.g., sensitive fields)'),
    
    /** Custom field mappings */
    mappings: z.record(z.string(), z.object({
      graphqlName: z.string().optional().describe('Custom GraphQL field name'),
      graphqlType: z.string().optional().describe('Override GraphQL type'),
      description: z.string().optional().describe('Field description'),
      deprecationReason: z.string().optional().describe('Why field is deprecated'),
      nullable: z.boolean().optional().describe('Override nullable'),
    })).optional().describe('Field-level customizations'),
  }).optional().describe('Field configuration'),
  
  /** Interfaces this type implements */
  interfaces: z.array(z.string()).optional().describe('GraphQL interface names'),
  
  /** Whether this is an interface definition */
  isInterface: z.boolean().optional().default(false).describe('Define as GraphQL interface'),
  
  /** Custom directives */
  directives: z.array(z.object({
    name: z.string().describe('Directive name'),
    args: z.record(z.string(), z.unknown()).optional().describe('Directive arguments'),
  })).optional().describe('GraphQL directives'),
});

export type GraphQLTypeConfig = z.infer<typeof GraphQLTypeConfigSchema>;
export type GraphQLTypeConfigInput = z.input<typeof GraphQLTypeConfigSchema>;

// ==========================================
// 2. Query Generation Configuration
// ==========================================

/**
 * GraphQL Query Configuration
 * 
 * Configuration for auto-generating query fields from Objects.
 */
export const GraphQLQueryConfigSchema = z.object({
  /** Query name */
  name: z.string().describe('Query field name (camelCase recommended)'),
  
  /** Source Object */
  object: z.string().describe('Source ObjectQL object name'),
  
  /** Query type: single record or list */
  type: z.enum(['get', 'list', 'search']).describe('Query type'),
  
  /** Description */
  description: z.string().optional().describe('Query description'),
  
  /** Input arguments */
  args: z.record(z.string(), z.object({
    type: z.string().describe('GraphQL type (e.g., "ID!", "String", "Int")'),
    description: z.string().optional().describe('Argument description'),
    defaultValue: z.unknown().optional().describe('Default value'),
  })).optional().describe('Query arguments'),
  
  /** Filtering configuration */
  filtering: z.object({
    enabled: z.boolean().default(true).describe('Allow filtering'),
    fields: z.array(z.string()).optional().describe('Filterable fields'),
    operators: z.array(z.enum([
      'eq', 'ne', 'gt', 'gte', 'lt', 'lte',
      'in', 'notIn', 'contains', 'startsWith', 'endsWith',
      'isNull', 'isNotNull',
    ])).optional().describe('Allowed filter operators'),
  }).optional().describe('Filtering capabilities'),
  
  /** Sorting configuration */
  sorting: z.object({
    enabled: z.boolean().default(true).describe('Allow sorting'),
    fields: z.array(z.string()).optional().describe('Sortable fields'),
    defaultSort: z.object({
      field: z.string(),
      direction: z.enum(['ASC', 'DESC']),
    }).optional().describe('Default sort order'),
  }).optional().describe('Sorting capabilities'),
  
  /** Pagination configuration */
  pagination: z.object({
    enabled: z.boolean().default(true).describe('Enable pagination'),
    type: z.enum(['offset', 'cursor', 'relay']).default('offset').describe('Pagination style'),
    defaultLimit: z.number().int().min(1).default(20).describe('Default page size'),
    maxLimit: z.number().int().min(1).default(100).describe('Maximum page size'),
    cursors: z.object({
      field: z.string().default('id').describe('Field to use for cursor pagination'),
    }).optional(),
  }).optional().describe('Pagination configuration'),
  
  /** Field selection */
  fields: z.object({
    /** Always include these fields */
    required: z.array(z.string()).optional().describe('Required fields (always returned)'),
    
    /** Allow selecting these fields */
    selectable: z.array(z.string()).optional().describe('Selectable fields'),
  }).optional().describe('Field selection configuration'),
  
  /** Authorization */
  authRequired: z.boolean().default(true).describe('Require authentication'),
  permissions: z.array(z.string()).optional().describe('Required permissions'),
  
  /** Caching */
  cache: z.object({
    enabled: z.boolean().default(false).describe('Enable caching'),
    ttl: z.number().int().min(0).optional().describe('Cache TTL in seconds'),
    key: z.string().optional().describe('Cache key template'),
  }).optional().describe('Query caching'),
});

export type GraphQLQueryConfig = z.infer<typeof GraphQLQueryConfigSchema>;
export type GraphQLQueryConfigInput = z.input<typeof GraphQLQueryConfigSchema>;

// ==========================================
// 3. Mutation Generation Configuration
// ==========================================

/**
 * GraphQL Mutation Configuration
 * 
 * Configuration for auto-generating mutation fields from Objects.
 */
export const GraphQLMutationConfigSchema = z.object({
  /** Mutation name */
  name: z.string().describe('Mutation field name (camelCase recommended)'),
  
  /** Source Object */
  object: z.string().describe('Source ObjectQL object name'),
  
  /** Mutation type */
  type: z.enum(['create', 'update', 'delete', 'upsert', 'custom']).describe('Mutation type'),
  
  /** Description */
  description: z.string().optional().describe('Mutation description'),
  
  /** Input type configuration */
  input: z.object({
    /** Input type name */
    typeName: z.string().optional().describe('Custom input type name'),
    
    /** Fields to include in input */
    fields: z.object({
      include: z.array(z.string()).optional().describe('Fields to include'),
      exclude: z.array(z.string()).optional().describe('Fields to exclude'),
      required: z.array(z.string()).optional().describe('Required input fields'),
    }).optional().describe('Input field configuration'),
    
    /** Validation */
    validation: z.object({
      enabled: z.boolean().default(true).describe('Enable input validation'),
      rules: z.array(z.string()).optional().describe('Custom validation rules'),
    }).optional().describe('Input validation'),
  }).optional().describe('Input configuration'),
  
  /** Return type configuration */
  output: z.object({
    /** Type of output */
    type: z.enum(['object', 'payload', 'boolean', 'custom']).default('object').describe('Output type'),
    
    /** Include success/error envelope */
    includeEnvelope: z.boolean().optional().default(false).describe('Wrap in success/error payload'),
    
    /** Custom output type */
    customType: z.string().optional().describe('Custom output type name'),
  }).optional().describe('Output configuration'),
  
  /** Transaction handling */
  transaction: z.object({
    enabled: z.boolean().default(true).describe('Use database transaction'),
    isolationLevel: z.enum(['read_uncommitted', 'read_committed', 'repeatable_read', 'serializable']).optional().describe('Transaction isolation level'),
  }).optional().describe('Transaction configuration'),
  
  /** Authorization */
  authRequired: z.boolean().default(true).describe('Require authentication'),
  permissions: z.array(z.string()).optional().describe('Required permissions'),
  
  /** Hooks */
  hooks: z.object({
    before: z.array(z.string()).optional().describe('Pre-mutation hooks'),
    after: z.array(z.string()).optional().describe('Post-mutation hooks'),
  }).optional().describe('Lifecycle hooks'),
});

export type GraphQLMutationConfig = z.infer<typeof GraphQLMutationConfigSchema>;
export type GraphQLMutationConfigInput = z.input<typeof GraphQLMutationConfigSchema>;

// ==========================================
// 4. Subscription Configuration
// ==========================================

/**
 * GraphQL Subscription Configuration
 * 
 * Configuration for real-time GraphQL subscriptions.
 */
export const GraphQLSubscriptionConfigSchema = z.object({
  /** Subscription name */
  name: z.string().describe('Subscription field name (camelCase recommended)'),
  
  /** Source Object */
  object: z.string().describe('Source ObjectQL object name'),
  
  /** Subscription trigger events */
  events: z.array(z.enum(['created', 'updated', 'deleted', 'custom'])).describe('Events to subscribe to'),
  
  /** Description */
  description: z.string().optional().describe('Subscription description'),
  
  /** Filtering */
  filter: z.object({
    enabled: z.boolean().default(true).describe('Allow filtering subscriptions'),
    fields: z.array(z.string()).optional().describe('Filterable fields'),
  }).optional().describe('Subscription filtering'),
  
  /** Payload configuration */
  payload: z.object({
    /** Include the modified entity */
    includeEntity: z.boolean().default(true).describe('Include entity in payload'),
    
    /** Include previous values (for updates) */
    includePreviousValues: z.boolean().optional().default(false).describe('Include previous field values'),
    
    /** Include mutation metadata */
    includeMeta: z.boolean().optional().default(true).describe('Include metadata (timestamp, user, etc.)'),
  }).optional().describe('Payload configuration'),
  
  /** Authorization */
  authRequired: z.boolean().default(true).describe('Require authentication'),
  permissions: z.array(z.string()).optional().describe('Required permissions'),
  
  /** Rate limiting for subscriptions */
  rateLimit: z.object({
    enabled: z.boolean().default(true).describe('Enable rate limiting'),
    maxSubscriptionsPerUser: z.number().int().min(1).default(10).describe('Max concurrent subscriptions per user'),
    throttleMs: z.number().int().min(0).optional().describe('Throttle interval in milliseconds'),
  }).optional().describe('Subscription rate limiting'),
});

export type GraphQLSubscriptionConfig = z.infer<typeof GraphQLSubscriptionConfigSchema>;
export type GraphQLSubscriptionConfigInput = z.input<typeof GraphQLSubscriptionConfigSchema>;

// ==========================================
// 5. Resolver Configuration
// ==========================================

/**
 * GraphQL Resolver Configuration
 * 
 * Configuration for custom resolver logic.
 */
export const GraphQLResolverConfigSchema = z.object({
  /** Field path (e.g., "Query.users", "Mutation.createUser") */
  path: z.string().describe('Resolver path (Type.field)'),
  
  /** Resolver implementation type */
  type: z.enum(['datasource', 'computed', 'script', 'proxy']).describe('Resolver implementation type'),
  
  /** Implementation details */
  implementation: z.object({
    /** For datasource type */
    datasource: z.string().optional().describe('Datasource ID'),
    query: z.string().optional().describe('Query/SQL to execute'),
    
    /** For computed type */
    expression: z.string().optional().describe('Computation expression'),
    dependencies: z.array(z.string()).optional().describe('Dependent fields'),
    
    /** For script type */
    script: z.string().optional().describe('Script ID or inline code'),
    
    /** For proxy type */
    url: z.string().optional().describe('Proxy URL'),
    method: z.enum(['GET', 'POST', 'PUT', 'DELETE']).optional().describe('HTTP method'),
  }).optional().describe('Implementation configuration'),
  
  /** Caching */
  cache: z.object({
    enabled: z.boolean().default(false).describe('Enable resolver caching'),
    ttl: z.number().int().min(0).optional().describe('Cache TTL in seconds'),
    keyArgs: z.array(z.string()).optional().describe('Arguments to include in cache key'),
  }).optional().describe('Resolver caching'),
});

export type GraphQLResolverConfig = z.infer<typeof GraphQLResolverConfigSchema>;
export type GraphQLResolverConfigInput = z.input<typeof GraphQLResolverConfigSchema>;

// ==========================================
// 6. DataLoader Configuration
// ==========================================

/**
 * GraphQL DataLoader Configuration
 * 
 * Configuration for batching and caching with DataLoader pattern.
 * Prevents N+1 query problems in GraphQL.
 */
export const GraphQLDataLoaderConfigSchema = z.object({
  /** Loader name */
  name: z.string().describe('DataLoader name'),
  
  /** Source Object or datasource */
  source: z.string().describe('Source object or datasource'),
  
  /** Batch function configuration */
  batchFunction: z.object({
    /** Type of batch operation */
    type: z.enum(['findByIds', 'query', 'script', 'custom']).describe('Batch function type'),
    
    /** For findByIds */
    keyField: z.string().optional().describe('Field to batch on (e.g., "id")'),
    
    /** For query */
    query: z.string().optional().describe('Query template'),
    
    /** For script */
    script: z.string().optional().describe('Script ID'),
    
    /** Maximum batch size */
    maxBatchSize: z.number().int().min(1).optional().default(100).describe('Maximum batch size'),
  }).describe('Batch function configuration'),
  
  /** Caching */
  cache: z.object({
    enabled: z.boolean().default(true).describe('Enable per-request caching'),
    
    /** Cache key function */
    keyFn: z.string().optional().describe('Custom cache key function'),
  }).optional().describe('DataLoader caching'),
  
  /** Options */
  options: z.object({
    /** Batch multiple requests in single tick */
    batch: z.boolean().default(true).describe('Enable batching'),
    
    /** Cache loaded values */
    cache: z.boolean().default(true).describe('Enable caching'),
    
    /** Maximum cache size */
    maxCacheSize: z.number().int().min(0).optional().describe('Max cache entries'),
  }).optional().describe('DataLoader options'),
});

export type GraphQLDataLoaderConfig = z.infer<typeof GraphQLDataLoaderConfigSchema>;
export type GraphQLDataLoaderConfigInput = z.input<typeof GraphQLDataLoaderConfigSchema>;

// ==========================================
// 7. GraphQL Directive Schema
// ==========================================

/**
 * GraphQL Directive Location
 * 
 * Where a directive can be used in the schema.
 */
export const GraphQLDirectiveLocation = z.enum([
  // Executable Directive Locations
  'QUERY',
  'MUTATION',
  'SUBSCRIPTION',
  'FIELD',
  'FRAGMENT_DEFINITION',
  'FRAGMENT_SPREAD',
  'INLINE_FRAGMENT',
  'VARIABLE_DEFINITION',
  
  // Type System Directive Locations
  'SCHEMA',
  'SCALAR',
  'OBJECT',
  'FIELD_DEFINITION',
  'ARGUMENT_DEFINITION',
  'INTERFACE',
  'UNION',
  'ENUM',
  'ENUM_VALUE',
  'INPUT_OBJECT',
  'INPUT_FIELD_DEFINITION',
]);

export type GraphQLDirectiveLocation = z.infer<typeof GraphQLDirectiveLocation>;

/**
 * GraphQL Directive Configuration
 * 
 * Custom directives for schema metadata and behavior.
 */
export const GraphQLDirectiveConfigSchema = z.object({
  /** Directive name */
  name: z.string().regex(/^[a-z][a-zA-Z0-9]*$/).describe('Directive name (camelCase)'),
  
  /** Description */
  description: z.string().optional().describe('Directive description'),
  
  /** Where directive can be used */
  locations: z.array(GraphQLDirectiveLocation).describe('Directive locations'),
  
  /** Arguments */
  args: z.record(z.string(), z.object({
    type: z.string().describe('Argument type'),
    description: z.string().optional().describe('Argument description'),
    defaultValue: z.unknown().optional().describe('Default value'),
  })).optional().describe('Directive arguments'),
  
  /** Is repeatable */
  repeatable: z.boolean().optional().default(false).describe('Can be applied multiple times'),
  
  /** Implementation */
  implementation: z.object({
    /** Directive behavior type */
    type: z.enum(['auth', 'validation', 'transform', 'cache', 'deprecation', 'custom']).describe('Directive type'),
    
    /** Handler function */
    handler: z.string().optional().describe('Handler function name or script'),
  }).optional().describe('Directive implementation'),
});

export type GraphQLDirectiveConfig = z.infer<typeof GraphQLDirectiveConfigSchema>;
export type GraphQLDirectiveConfigInput = z.input<typeof GraphQLDirectiveConfigSchema>;

// ==========================================
// 8. GraphQL Security - Query Depth Limiting
// ==========================================

/**
 * Query Depth Limiting Configuration
 * 
 * Prevents deeply nested queries that could cause performance issues.
 */
export const GraphQLQueryDepthLimitSchema = z.object({
  /** Enable depth limiting */
  enabled: z.boolean().default(true).describe('Enable query depth limiting'),
  
  /** Maximum allowed depth */
  maxDepth: z.number().int().min(1).default(10).describe('Maximum query depth'),
  
  /** Fields to ignore in depth calculation */
  ignoreFields: z.array(z.string()).optional().describe('Fields excluded from depth calculation'),
  
  /** Callback on depth exceeded */
  onDepthExceeded: z.enum(['reject', 'log', 'warn']).default('reject').describe('Action when depth exceeded'),
  
  /** Custom error message */
  errorMessage: z.string().optional().describe('Custom error message for depth violations'),
});

export type GraphQLQueryDepthLimit = z.infer<typeof GraphQLQueryDepthLimitSchema>;
export type GraphQLQueryDepthLimitInput = z.input<typeof GraphQLQueryDepthLimitSchema>;

// ==========================================
// 9. GraphQL Security - Query Complexity
// ==========================================

/**
 * Query Complexity Calculation Configuration
 * 
 * Assigns complexity scores to fields and limits total query complexity.
 * Prevents expensive queries from overloading the server.
 */
export const GraphQLQueryComplexitySchema = z.object({
  /** Enable complexity limiting */
  enabled: z.boolean().default(true).describe('Enable query complexity limiting'),
  
  /** Maximum allowed complexity score */
  maxComplexity: z.number().int().min(1).default(1000).describe('Maximum query complexity'),
  
  /** Default field complexity */
  defaultFieldComplexity: z.number().int().min(0).default(1).describe('Default complexity per field'),
  
  /** Field-specific complexity scores */
  fieldComplexity: z.record(z.string(), z.union([
    z.number().int().min(0),
    z.object({
      /** Base complexity */
      base: z.number().int().min(0).describe('Base complexity'),
      
      /** Multiplier based on arguments */
      multiplier: z.string().optional().describe('Argument multiplier (e.g., "limit")'),
      
      /** Custom complexity calculation */
      calculator: z.string().optional().describe('Custom calculator function'),
    }),
  ])).optional().describe('Per-field complexity configuration'),
  
  /** List multiplier */
  listMultiplier: z.number().min(0).default(10).describe('Multiplier for list fields'),
  
  /** Callback on complexity exceeded */
  onComplexityExceeded: z.enum(['reject', 'log', 'warn']).default('reject').describe('Action when complexity exceeded'),
  
  /** Custom error message */
  errorMessage: z.string().optional().describe('Custom error message for complexity violations'),
});

export type GraphQLQueryComplexity = z.infer<typeof GraphQLQueryComplexitySchema>;
export type GraphQLQueryComplexityInput = z.input<typeof GraphQLQueryComplexitySchema>;

// ==========================================
// 10. GraphQL Security - Rate Limiting
// ==========================================

/**
 * GraphQL Rate Limiting Configuration
 * 
 * Rate limiting for GraphQL operations.
 */
export const GraphQLRateLimitSchema = z.object({
  /** Enable rate limiting */
  enabled: z.boolean().default(true).describe('Enable rate limiting'),
  
  /** Rate limit strategy */
  strategy: z.enum(['token_bucket', 'fixed_window', 'sliding_window', 'cost_based']).default('token_bucket').describe('Rate limiting strategy'),
  
  /** Global rate limits */
  global: z.object({
    /** Requests per time window */
    maxRequests: z.number().int().min(1).default(1000).describe('Maximum requests per window'),
    
    /** Time window in milliseconds */
    windowMs: z.number().int().min(1000).default(60000).describe('Time window in milliseconds'),
  }).optional().describe('Global rate limits'),
  
  /** Per-user rate limits */
  perUser: z.object({
    /** Requests per time window */
    maxRequests: z.number().int().min(1).default(100).describe('Maximum requests per user per window'),
    
    /** Time window in milliseconds */
    windowMs: z.number().int().min(1000).default(60000).describe('Time window in milliseconds'),
  }).optional().describe('Per-user rate limits'),
  
  /** Cost-based rate limiting */
  costBased: z.object({
    /** Enable cost-based limiting */
    enabled: z.boolean().default(false).describe('Enable cost-based rate limiting'),
    
    /** Maximum cost per time window */
    maxCost: z.number().int().min(1).default(10000).describe('Maximum cost per window'),
    
    /** Time window in milliseconds */
    windowMs: z.number().int().min(1000).default(60000).describe('Time window in milliseconds'),
    
    /** Use complexity as cost */
    useComplexityAsCost: z.boolean().default(true).describe('Use query complexity as cost'),
  }).optional().describe('Cost-based rate limiting'),
  
  /** Operation-specific limits */
  operations: z.record(z.string(), z.object({
    maxRequests: z.number().int().min(1).describe('Max requests for this operation'),
    windowMs: z.number().int().min(1000).describe('Time window'),
  })).optional().describe('Per-operation rate limits'),
  
  /** Callback on limit exceeded */
  onLimitExceeded: z.enum(['reject', 'queue', 'log']).default('reject').describe('Action when rate limit exceeded'),
  
  /** Custom error message */
  errorMessage: z.string().optional().describe('Custom error message for rate limit violations'),
  
  /** Headers to include in response */
  includeHeaders: z.boolean().default(true).describe('Include rate limit headers in response'),
});

export type GraphQLRateLimit = z.infer<typeof GraphQLRateLimitSchema>;
export type GraphQLRateLimitInput = z.input<typeof GraphQLRateLimitSchema>;

// ==========================================
// 11. GraphQL Security - Persisted Queries
// ==========================================

/**
 * Persisted Queries Configuration
 * 
 * Only allow pre-registered queries to execute (allow list approach).
 * Improves security and performance.
 */
export const GraphQLPersistedQuerySchema = z.object({
  /** Enable persisted queries */
  enabled: z.boolean().default(false).describe('Enable persisted queries'),
  
  /** Enforcement mode */
  mode: z.enum(['optional', 'required']).default('optional').describe('Persisted query mode (optional: allow both, required: only persisted)'),
  
  /** Query store configuration */
  store: z.object({
    /** Store type */
    type: z.enum(['memory', 'redis', 'database', 'file']).default('memory').describe('Query store type'),
    
    /** Store connection string */
    connection: z.string().optional().describe('Store connection string or path'),
    
    /** TTL for cached queries */
    ttl: z.number().int().min(0).optional().describe('TTL in seconds for stored queries'),
  }).optional().describe('Query store configuration'),
  
  /** Automatic Persisted Queries (APQ) */
  apq: z.object({
    /** Enable APQ */
    enabled: z.boolean().default(true).describe('Enable Automatic Persisted Queries'),
    
    /** Hash algorithm */
    hashAlgorithm: z.enum(['sha256', 'sha1', 'md5']).default('sha256').describe('Hash algorithm for query IDs'),
    
    /** Cache control */
    cache: z.object({
      /** Cache TTL */
      ttl: z.number().int().min(0).default(3600).describe('Cache TTL in seconds'),
      
      /** Max cache size */
      maxSize: z.number().int().min(1).optional().describe('Maximum number of cached queries'),
    }).optional().describe('APQ cache configuration'),
  }).optional().describe('Automatic Persisted Queries configuration'),
  
  /** Query allow list */
  allowlist: z.object({
    /** Enable allow list mode */
    enabled: z.boolean().default(false).describe('Enable query allow list (reject queries not in list)'),
    
    /** Allowed query IDs */
    queries: z.array(z.object({
      id: z.string().describe('Query ID or hash'),
      operation: z.string().optional().describe('Operation name'),
      query: z.string().optional().describe('Query string'),
    })).optional().describe('Allowed queries'),
    
    /** External allow list source */
    source: z.string().optional().describe('External allow list source (file path or URL)'),
  }).optional().describe('Query allow list configuration'),
  
  /** Security */
  security: z.object({
    /** Maximum query size */
    maxQuerySize: z.number().int().min(1).optional().describe('Maximum query string size in bytes'),
    
    /** Reject introspection in production */
    rejectIntrospection: z.boolean().default(false).describe('Reject introspection queries'),
  }).optional().describe('Security configuration'),
});

export type GraphQLPersistedQuery = z.infer<typeof GraphQLPersistedQuerySchema>;
export type GraphQLPersistedQueryInput = z.input<typeof GraphQLPersistedQuerySchema>;

// ==========================================
// 12. GraphQL Federation
// ==========================================

/**
 * Federation Entity Key Definition
 * 
 * Defines how entities are uniquely identified across subgraphs.
 * Corresponds to the `@key` directive in Apollo Federation.
 * 
 * @see https://www.apollographql.com/docs/federation/entities
 */
export const FederationEntityKeySchema = z.object({
  /** Fields composing the key (e.g., "id" or "sku packageId") */
  fields: z.string().describe('Selection set of fields composing the entity key'),

  /** Whether this key can be used for resolution across subgraphs */
  resolvable: z.boolean().optional().default(true).describe('Whether entities can be resolved from this subgraph'),
});

export type FederationEntityKey = z.infer<typeof FederationEntityKeySchema>;

/**
 * Federation External Field
 * 
 * Marks a field as owned by another subgraph (`@external`).
 */
export const FederationExternalFieldSchema = z.object({
  /** Field name */
  field: z.string().describe('Field name marked as external'),

  /** The subgraph that owns this field */
  ownerSubgraph: z.string().optional().describe('Subgraph that owns this field'),
});

export type FederationExternalField = z.infer<typeof FederationExternalFieldSchema>;

/**
 * Federation Requires Directive
 * 
 * Specifies fields that must be fetched from other subgraphs
 * before resolving a computed field.
 * Corresponds to the `@requires` directive in Apollo Federation.
 */
export const FederationRequiresSchema = z.object({
  /** The field that has this requirement */
  field: z.string().describe('Field with the requirement'),

  /** Selection set of external fields required for resolution */
  fields: z.string().describe('Selection set of required fields (e.g., "price weight")'),
});

export type FederationRequires = z.infer<typeof FederationRequiresSchema>;

/**
 * Federation Provides Directive
 * 
 * Indicates that a field resolution provides additional fields
 * of a returned entity type.
 * Corresponds to the `@provides` directive in Apollo Federation.
 */
export const FederationProvidesSchema = z.object({
  /** The field that provides additional data */
  field: z.string().describe('Field that provides additional entity fields'),

  /** Selection set of fields provided during resolution */
  fields: z.string().describe('Selection set of provided fields (e.g., "name price")'),
});

export type FederationProvides = z.infer<typeof FederationProvidesSchema>;

/**
 * Federation Entity Configuration
 * 
 * Configures a type as a federated entity that can be referenced
 * and extended across multiple subgraphs.
 */
export const FederationEntitySchema = z.object({
  /** Type/Object name */
  typeName: z.string().describe('GraphQL type name for this entity'),

  /** Entity keys (`@key` directive) */
  keys: z.array(FederationEntityKeySchema).min(1).describe('Entity key definitions'),

  /** External fields (`@external`) */
  externalFields: z.array(FederationExternalFieldSchema).optional().describe('Fields owned by other subgraphs'),

  /** Requires directives (`@requires`) */
  requires: z.array(FederationRequiresSchema).optional().describe('Required external fields for computed fields'),

  /** Provides directives (`@provides`) */
  provides: z.array(FederationProvidesSchema).optional().describe('Fields provided during resolution'),

  /** Whether this subgraph owns this entity */
  owner: z.boolean().optional().default(false).describe('Whether this subgraph is the owner of this entity'),
});

export type FederationEntity = z.infer<typeof FederationEntitySchema>;

/**
 * Subgraph Configuration
 * 
 * Configuration for an individual subgraph in a federated architecture.
 */
export const SubgraphConfigSchema = z.object({
  /** Subgraph name */
  name: z.string().describe('Unique subgraph identifier'),

  /** Subgraph URL */
  url: z.string().describe('Subgraph endpoint URL'),

  /** Schema source */
  schemaSource: z.enum(['introspection', 'file', 'registry']).default('introspection').describe('How to obtain the subgraph schema'),

  /** Schema file path (when schemaSource is "file") */
  schemaPath: z.string().optional().describe('Path to schema file (SDL format)'),

  /** Federated entities defined by this subgraph */
  entities: z.array(FederationEntitySchema).optional().describe('Entity definitions for this subgraph'),

  /** Health check endpoint */
  healthCheck: z.object({
    enabled: z.boolean().default(true).describe('Enable health checking'),
    path: z.string().default('/health').describe('Health check endpoint path'),
    intervalMs: z.number().int().min(1000).default(30000).describe('Health check interval in milliseconds'),
  }).optional().describe('Subgraph health check configuration'),

  /** Request headers to forward */
  forwardHeaders: z.array(z.string()).optional().describe('HTTP headers to forward to this subgraph'),
});

export type SubgraphConfig = z.infer<typeof SubgraphConfigSchema>;
export type SubgraphConfigInput = z.input<typeof SubgraphConfigSchema>;

/**
 * Federation Gateway Configuration
 * 
 * Root-level gateway configuration for Apollo Federation or similar.
 * Manages query planning, routing, and composition across subgraphs.
 */
export const FederationGatewaySchema = z.object({
  /** Enable federation mode */
  enabled: z.boolean().default(false).describe('Enable GraphQL Federation gateway mode'),

  /** Federation specification version */
  version: z.enum(['v1', 'v2']).default('v2').describe('Federation specification version'),

  /** Registered subgraphs */
  subgraphs: z.array(SubgraphConfigSchema).describe('Subgraph configurations'),

  /** Service discovery */
  serviceDiscovery: z.object({
    /** Discovery mode */
    type: z.enum(['static', 'dns', 'consul', 'kubernetes']).default('static').describe('Service discovery method'),

    /** Poll interval for dynamic discovery */
    pollIntervalMs: z.number().int().min(1000).optional().describe('Discovery poll interval in milliseconds'),

    /** Kubernetes namespace (when type is "kubernetes") */
    namespace: z.string().optional().describe('Kubernetes namespace for subgraph discovery'),
  }).optional().describe('Service discovery configuration'),

  /** Query planning */
  queryPlanning: z.object({
    /** Execution strategy */
    strategy: z.enum(['parallel', 'sequential', 'adaptive']).default('parallel').describe('Query execution strategy across subgraphs'),

    /** Maximum query depth across subgraphs */
    maxDepth: z.number().int().min(1).optional().describe('Max query depth in federated execution'),

    /** Dry-run mode for debugging query plans */
    dryRun: z.boolean().optional().default(false).describe('Log query plans without executing'),
  }).optional().describe('Query planning configuration'),

  /** Schema composition settings */
  composition: z.object({
    /** How schema conflicts are resolved */
    conflictResolution: z.enum(['error', 'first_wins', 'last_wins']).default('error').describe('Strategy for resolving schema conflicts'),

    /** Whether to validate composed schema */
    validate: z.boolean().default(true).describe('Validate composed supergraph schema'),
  }).optional().describe('Schema composition configuration'),

  /** Gateway-level error handling */
  errorHandling: z.object({
    /** Whether to include subgraph names in errors */
    includeSubgraphName: z.boolean().default(false).describe('Include subgraph name in error responses'),

    /** Partial error behavior */
    partialErrors: z.enum(['propagate', 'nullify', 'reject']).default('propagate').describe('Behavior when a subgraph returns partial errors'),
  }).optional().describe('Error handling configuration'),
});

export type FederationGateway = z.infer<typeof FederationGatewaySchema>;
export type FederationGatewayInput = z.input<typeof FederationGatewaySchema>;

// ==========================================
// 13. Complete GraphQL Configuration
// ==========================================

/**
 * Complete GraphQL Configuration
 * 
 * Root configuration for GraphQL API generation and security.
 */
export const GraphQLConfigSchema = z.object({
  /** Enable GraphQL API */
  enabled: z.boolean().default(true).describe('Enable GraphQL API'),
  
  /** GraphQL endpoint path */
  path: z.string().default('/graphql').describe('GraphQL endpoint path'),
  
  /** GraphQL Playground */
  playground: z.object({
    enabled: z.boolean().default(true).describe('Enable GraphQL Playground'),
    path: z.string().default('/playground').describe('Playground path'),
  }).optional().describe('GraphQL Playground configuration'),
  
  /** Schema generation */
  schema: z.object({
    /** Auto-generate types from Objects */
    autoGenerateTypes: z.boolean().default(true).describe('Auto-generate types from Objects'),
    
    /** Type configurations */
    types: z.array(GraphQLTypeConfigSchema).optional().describe('Type configurations'),
    
    /** Query configurations */
    queries: z.array(GraphQLQueryConfigSchema).optional().describe('Query configurations'),
    
    /** Mutation configurations */
    mutations: z.array(GraphQLMutationConfigSchema).optional().describe('Mutation configurations'),
    
    /** Subscription configurations */
    subscriptions: z.array(GraphQLSubscriptionConfigSchema).optional().describe('Subscription configurations'),
    
    /** Custom resolvers */
    resolvers: z.array(GraphQLResolverConfigSchema).optional().describe('Custom resolver configurations'),
    
    /** Custom directives */
    directives: z.array(GraphQLDirectiveConfigSchema).optional().describe('Custom directive configurations'),
  }).optional().describe('Schema generation configuration'),
  
  /** DataLoader configurations */
  dataLoaders: z.array(GraphQLDataLoaderConfigSchema).optional().describe('DataLoader configurations'),
  
  /** Security configuration */
  security: z.object({
    /** Query depth limiting */
    depthLimit: GraphQLQueryDepthLimitSchema.optional().describe('Query depth limiting'),
    
    /** Query complexity */
    complexity: GraphQLQueryComplexitySchema.optional().describe('Query complexity calculation'),
    
    /** Rate limiting */
    rateLimit: GraphQLRateLimitSchema.optional().describe('Rate limiting'),
    
    /** Persisted queries */
    persistedQueries: GraphQLPersistedQuerySchema.optional().describe('Persisted queries'),
  }).optional().describe('Security configuration'),

  /** Federation configuration */
  federation: FederationGatewaySchema.optional().describe('GraphQL Federation gateway configuration'),
});

export const GraphQLConfig = Object.assign(GraphQLConfigSchema, {
  create: <T extends z.input<typeof GraphQLConfigSchema>>(config: T) => config,
});

export type GraphQLConfig = z.infer<typeof GraphQLConfigSchema>;
export type GraphQLConfigInput = z.input<typeof GraphQLConfigSchema>;

// ==========================================
// Helper Functions
// ==========================================

/**
 * Helper to map ObjectQL field type to GraphQL scalar type
 */
export const mapFieldTypeToGraphQL = (fieldType: z.infer<typeof FieldType>): string => {
  const mapping: Record<string, string> = {
    // Core Text
    'text': 'String',
    'textarea': 'String',
    'email': 'Email',
    'url': 'URL',
    'phone': 'PhoneNumber',
    'password': 'String',
    
    // Rich Content
    'markdown': 'String',
    'html': 'String',
    'richtext': 'String',
    
    // Numbers
    'number': 'Float',
    'currency': 'Currency',
    'percent': 'Float',
    
    // Date & Time
    'date': 'Date',
    'datetime': 'DateTime',
    'time': 'Time',
    
    // Logic
    'boolean': 'Boolean',
    'toggle': 'Boolean',
    
    // Selection
    'select': 'String',
    'multiselect': '[String]',
    'radio': 'String',
    'checkboxes': '[String]',
    
    // Relational
    'lookup': 'ID',
    'master_detail': 'ID',
    'tree': 'ID',
    
    // Media
    'image': 'URL',
    'file': 'URL',
    'avatar': 'URL',
    'video': 'URL',
    'audio': 'URL',
    
    // Calculated
    'formula': 'String',
    'summary': 'Float',
    'autonumber': 'String',
    
    // Enhanced Types
    'location': 'JSONObject',
    'address': 'JSONObject',
    'code': 'String',
    'json': 'JSON',
    'color': 'String',
    'rating': 'Float',
    'slider': 'Float',
    'signature': 'String',
    'qrcode': 'String',
    'progress': 'Float',
    'tags': '[String]',
    
    // AI/ML
    'vector': '[Float]',
  };
  
  return mapping[fieldType] || 'String';
};
