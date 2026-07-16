// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * IGraphQLService - GraphQL Service Contract
 *
 * Defines the interface for GraphQL schema and query execution in ObjectStack.
 * Concrete implementations (Apollo, Yoga, Mercurius, etc.)
 * should implement this interface.
 *
 * Follows Dependency Inversion Principle - plugins depend on this interface,
 * not on concrete GraphQL server implementations.
 *
 * Aligned with CoreServiceName 'graphql' in core-services.zod.ts.
 */

/**
 * A GraphQL execution request
 */
export interface GraphQLRequest {
    /** GraphQL query or mutation string */
    query: string;
    /** Operation name (when document contains multiple operations) */
    operationName?: string;
    /** Variables for the operation */
    variables?: Record<string, unknown>;
}

/**
 * A GraphQL execution response
 */
export interface GraphQLResponse {
    /** Query result data */
    data?: Record<string, unknown> | null;
    /** Errors encountered during execution */
    errors?: Array<{
        message: string;
        locations?: Array<{ line: number; column: number }>;
        path?: Array<string | number>;
        extensions?: Record<string, unknown>;
    }>;
}

export interface IGraphQLService {
    /**
     * Execute a GraphQL query or mutation
     *
     * ⚠️ Identity admission (ADR-0096 D1, #2992): `context` carries the
     * caller's resolved `ExecutionContext`. An implementation that resolves
     * objects through the data engine (ObjectQL) MUST forward it on every
     * engine call as `options.context` — the security middleware falls OPEN
     * on a missing principal, so executing resolvers context-less silently
     * grants full authority (no RLS/FLS/CRUD/tenant scoping). The dispatcher's
     * `/graphql` entry point threads the caller identity for exactly this
     * purpose; dropping it here is a defect, never an authorization.
     *
     * @param request - The GraphQL request
     * @param context - The caller's execution context (auth user / principal)
     * @returns GraphQL response with data and/or errors
     */
    execute(request: GraphQLRequest, context?: Record<string, unknown>): Promise<GraphQLResponse>;

    /**
     * Handle an incoming HTTP request for GraphQL
     * @param request - Standard Request object
     * @returns Standard Response object
     */
    handleRequest?(request: Request): Promise<Response>;

    /**
     * Get the current GraphQL schema as SDL string
     * @returns SDL schema string
     */
    getSchema?(): string;
}
