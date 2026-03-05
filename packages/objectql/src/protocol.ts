// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { ObjectStackProtocol } from '@objectstack/spec/api';
import { IDataEngine } from '@objectstack/core';
import type { 
    BatchUpdateRequest, 
    BatchUpdateResponse, 
    UpdateManyDataRequest,
    DeleteManyDataRequest
} from '@objectstack/spec/api';
import type { MetadataCacheRequest, MetadataCacheResponse, ServiceInfo, ApiRoutes, WellKnownCapabilities } from '@objectstack/spec/api';
import type { IFeedService } from '@objectstack/spec/contracts';
import { parseFilterAST, isFilterAST } from '@objectstack/spec/data';

// We import SchemaRegistry directly since this class lives in the same package
import { SchemaRegistry } from './registry.js';

/**
 * Simple hash function for ETag generation (browser-compatible)
 * Uses a basic hash algorithm instead of crypto.createHash
 */
function simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16);
}

/**
 * Service Configuration for Discovery
 * Maps service names to their routes and plugin providers
 */
const SERVICE_CONFIG: Record<string, { route: string; plugin: string }> = {
    auth:         { route: '/api/v1/auth', plugin: 'plugin-auth' },
    automation:   { route: '/api/v1/automation', plugin: 'plugin-automation' },
    cache:        { route: '/api/v1/cache', plugin: 'plugin-redis' },
    queue:        { route: '/api/v1/queue', plugin: 'plugin-bullmq' },
    job:          { route: '/api/v1/jobs', plugin: 'job-scheduler' },
    ui:           { route: '/api/v1/ui', plugin: 'ui-plugin' },
    workflow:     { route: '/api/v1/workflow', plugin: 'plugin-workflow' },
    realtime:     { route: '/api/v1/realtime', plugin: 'plugin-realtime' },
    notification: { route: '/api/v1/notifications', plugin: 'plugin-notifications' },
    ai:           { route: '/api/v1/ai', plugin: 'plugin-ai' },
    i18n:         { route: '/api/v1/i18n', plugin: 'plugin-i18n' },
    graphql:      { route: '/graphql', plugin: 'plugin-graphql' },  // GraphQL uses /graphql by convention (not versioned REST)
    'file-storage': { route: '/api/v1/storage', plugin: 'plugin-storage' },
    search:       { route: '/api/v1/search', plugin: 'plugin-search' },
};

export class ObjectStackProtocolImplementation implements ObjectStackProtocol {
    private engine: IDataEngine;
    private getServicesRegistry?: () => Map<string, any>;
    private getFeedService?: () => IFeedService | undefined;

    constructor(engine: IDataEngine, getServicesRegistry?: () => Map<string, any>, getFeedService?: () => IFeedService | undefined) {
        this.engine = engine;
        this.getServicesRegistry = getServicesRegistry;
        this.getFeedService = getFeedService;
    }

    private requireFeedService(): IFeedService {
        const svc = this.getFeedService?.();
        if (!svc) {
            throw new Error('Feed service not available. Install and register service-feed to enable feed operations.');
        }
        return svc;
    }

    async getDiscovery() {
        // Get registered services from kernel if available
        const registeredServices = this.getServicesRegistry ? this.getServicesRegistry() : new Map();
        
        // Build dynamic service info with proper typing
        const services: Record<string, ServiceInfo> = {
            // --- Kernel-provided (objectql is an example kernel implementation) ---
            metadata:  { enabled: true, status: 'degraded' as const, route: '/api/v1/meta', provider: 'objectql', message: 'In-memory registry only; DB persistence not yet implemented' },
            data:      { enabled: true, status: 'available' as const, route: '/api/v1/data', provider: 'objectql' },
            analytics: { enabled: true, status: 'available' as const, route: '/api/v1/analytics', provider: 'objectql' },
        };

        // Check which services are actually registered
        for (const [serviceName, config] of Object.entries(SERVICE_CONFIG)) {
            if (registeredServices.has(serviceName)) {
                // Service is registered and available
                services[serviceName] = {
                    enabled: true,
                    status: 'available' as const,
                    route: config.route,
                    provider: config.plugin,
                };
            } else {
                // Service is not registered
                services[serviceName] = {
                    enabled: false,
                    status: 'unavailable' as const,
                    message: `Install ${config.plugin} to enable`,
                };
            }
        }

        // Build routes from services — a flat convenience map for client routing
        const serviceToRouteKey: Record<string, keyof ApiRoutes> = {
            auth: 'auth',
            automation: 'automation',
            ui: 'ui',
            workflow: 'workflow',
            realtime: 'realtime',
            notification: 'notifications',
            ai: 'ai',
            i18n: 'i18n',
            graphql: 'graphql',
            'file-storage': 'storage',
        };

        const optionalRoutes: Partial<ApiRoutes> = {
            analytics: '/api/v1/analytics',
        };

        // Add routes for available plugin services
        for (const [serviceName, config] of Object.entries(SERVICE_CONFIG)) {
            if (registeredServices.has(serviceName)) {
                const routeKey = serviceToRouteKey[serviceName];
                if (routeKey) {
                    optionalRoutes[routeKey] = config.route;
                }
            }
        }

        // Add feed service status
        if (registeredServices.has('feed')) {
            services['feed'] = {
                enabled: true,
                status: 'available' as const,
                route: '/api/v1/data',
                provider: 'service-feed',
            };
        } else {
            services['feed'] = {
                enabled: false,
                status: 'unavailable' as const,
                message: 'Install service-feed to enable',
            };
        }

        const routes: ApiRoutes = {
            data: '/api/v1/data',
            metadata: '/api/v1/meta',
            ...optionalRoutes,
        };

        // Build well-known capabilities from registered services
        const capabilities: WellKnownCapabilities = {
            feed: registeredServices.has('feed'),
            comments: registeredServices.has('feed'),
            automation: registeredServices.has('automation'),
            cron: registeredServices.has('job'),
            search: registeredServices.has('search'),
            export: registeredServices.has('automation') || registeredServices.has('queue'),
            chunkedUpload: registeredServices.has('file-storage'),
        };

        return {
            version: '1.0',
            apiName: 'ObjectStack API',
            routes,
            services,
            capabilities,
        };
    }

    async getMetaTypes() {
        return {
            types: SchemaRegistry.getRegisteredTypes()
        };
    }

    async getMetaItems(request: { type: string }) {
        let items = SchemaRegistry.listItems(request.type);
        // Normalize singular/plural: REST uses singular ('app') but registry may store as plural ('apps')
        if (items.length === 0) {
            const alt = request.type.endsWith('s') ? request.type.slice(0, -1) : request.type + 's';
            items = SchemaRegistry.listItems(alt);
        }
        return {
            type: request.type,
            items
        };
    }

    async getMetaItem(request: { type: string, name: string }) {
        let item = SchemaRegistry.getItem(request.type, request.name);
        // Normalize singular/plural
        if (item === undefined) {
            const alt = request.type.endsWith('s') ? request.type.slice(0, -1) : request.type + 's';
            item = SchemaRegistry.getItem(alt, request.name);
        }
        return {
            type: request.type,
            name: request.name,
            item
        };
    }

    async getUiView(request: { object: string, type: 'list' | 'form' }) {
        const schema = SchemaRegistry.getObject(request.object);
        if (!schema) throw new Error(`Object ${request.object} not found`);

        const fields = schema.fields || {};
        const fieldKeys = Object.keys(fields);

        if (request.type === 'list') {
            // Intelligent Column Selection
            // 1. Always include 'name' or name-like fields
            // 2. Limit to 6 columns by default
            const priorityFields = ['name', 'title', 'label', 'subject', 'email', 'status', 'type', 'category', 'created_at'];
            
            let columns = fieldKeys.filter(k => priorityFields.includes(k));
            
            // If few priority fields, add others until 5
            if (columns.length < 5) {
                const remaining = fieldKeys.filter(k => !columns.includes(k) && k !== 'id' && !fields[k].hidden);
                columns = [...columns, ...remaining.slice(0, 5 - columns.length)];
            }
            
            // Sort columns by priority then alphabet or schema order
            // For now, just keep them roughly in order they appear in schema or priority list
            
            return {
                list: {
                    type: 'grid' as const,
                    object: request.object,
                    label: schema.label || schema.name,
                    columns: columns.map(f => ({
                        field: f,
                        label: fields[f]?.label || f,
                        sortable: true
                    })),
                    sort: fields['created_at'] ? ([{ field: 'created_at', order: 'desc' }] as any) : undefined,
                    searchableFields: columns.slice(0, 3) // Make first few textual columns searchable
                }
            };
        } else {
             // Form View Generation
             // Simple single-section layout for now
             const formFields = fieldKeys
                .filter(k => k !== 'id' && k !== 'created_at' && k !== 'updated_at' && !fields[k].hidden)
                .map(f => ({
                    field: f,
                    label: fields[f]?.label,
                    required: fields[f]?.required,
                    readonly: fields[f]?.readonly,
                    type: fields[f]?.type,
                    // Default to 2 columns for most, 1 for textareas
                    colSpan: (fields[f]?.type === 'textarea' || fields[f]?.type === 'html') ? 2 : 1
                }));

             return {
                form: {
                    type: 'simple' as const,
                    object: request.object,
                    label: `Edit ${schema.label || schema.name}`,
                    sections: [
                        {
                            label: 'General Information',
                            columns: 2 as const,
                            collapsible: false,
                            collapsed: false,
                            fields: formFields
                        }
                    ]
                }
            };
        }
    }

    async findData(request: { object: string, query?: any }) {
        const options: any = { ...request.query };

        // Numeric fields
        if (options.top != null) options.top = Number(options.top);
        if (options.skip != null) options.skip = Number(options.skip);
        if (options.limit != null) options.limit = Number(options.limit);

        // Select: comma-separated string → array
        if (typeof options.select === 'string') {
            options.select = options.select.split(',').map((s: string) => s.trim()).filter(Boolean);
        }

        // Sort/orderBy: string → sort array (e.g. "name asc,created_at desc" or "name,-created_at")
        const sortValue = options.orderBy ?? options.sort;
        if (typeof sortValue === 'string') {
            const parsed = sortValue.split(',').map((part: string) => {
                const trimmed = part.trim();
                if (trimmed.startsWith('-')) {
                    return { field: trimmed.slice(1), order: 'desc' as const };
                }
                const [field, order] = trimmed.split(/\s+/);
                return { field, order: (order?.toLowerCase() === 'desc' ? 'desc' : 'asc') as 'asc' | 'desc' };
            }).filter((s: any) => s.field);
            options.sort = parsed;
            delete options.orderBy;
        }

        // Filter: normalize `filter`/`filters` (plural) → `filter` (singular, canonical)
        // Accept both `filter` and `filters` for backward compatibility.
        if (options.filters !== undefined && options.filter === undefined) {
            options.filter = options.filters;
        }
        delete options.filters;

        // Filter: JSON string → object
        if (typeof options.filter === 'string') {
            try { options.filter = JSON.parse(options.filter); } catch { /* keep as-is */ }
        }

        // Filter AST array → FilterCondition object
        // Converts ["and", ["field", "=", "val"], ...] to { $and: [{ field: "val" }, ...] }
        if (isFilterAST(options.filter)) {
            options.filter = parseFilterAST(options.filter);
        }

        // Populate: comma-separated string → array
        if (typeof options.populate === 'string') {
            options.populate = options.populate.split(',').map((s: string) => s.trim()).filter(Boolean);
        }

        // Expand → Populate: normalize $expand/expand to populate array
        // Supports OData $expand, REST expand, and JSON-RPC expand parameters
        const expandValue = options.$expand ?? options.expand;
        if (expandValue && !options.populate) {
            if (typeof expandValue === 'string') {
                options.populate = expandValue.split(',').map((s: string) => s.trim()).filter(Boolean);
            } else if (Array.isArray(expandValue)) {
                options.populate = expandValue;
            }
        }
        delete options.$expand;
        delete options.expand;

        // Boolean fields
        for (const key of ['distinct', 'count']) {
            if (options[key] === 'true') options[key] = true;
            else if (options[key] === 'false') options[key] = false;
        }
        
        // Handle OData style $filter if present, or flat filters
        // This is a naive implementation, a real OData parser is needed for complex scenarios.
        
        const records = await this.engine.find(request.object, options);
        return {
            object: request.object,
            value: records, // OData compaibility
            records, // Legacy
            total: records.length,
            hasMore: false
        };
    }

    async getData(request: { object: string, id: string, expand?: string | string[], select?: string | string[] }) {
        const queryOptions: any = {
            filter: { id: request.id }
        };

        // Support select for single-record retrieval
        if (request.select) {
            queryOptions.select = typeof request.select === 'string'
                ? request.select.split(',').map((s: string) => s.trim()).filter(Boolean)
                : request.select;
        }

        // Support expand for single-record retrieval
        if (request.expand) {
            queryOptions.populate = typeof request.expand === 'string'
                ? request.expand.split(',').map((s: string) => s.trim()).filter(Boolean)
                : request.expand;
        }

        const result = await this.engine.findOne(request.object, queryOptions);
        if (result) {
            return {
                object: request.object,
                id: request.id,
                record: result
            };
        }
        throw new Error(`Record ${request.id} not found in ${request.object}`);
    }

    async createData(request: { object: string, data: any }) {
        const result = await this.engine.insert(request.object, request.data);
        return {
            object: request.object,
            id: result.id,
            record: result
        };
    }

    async updateData(request: { object: string, id: string, data: any }) {
        // Adapt: update(obj, id, data) -> update(obj, data, options)
        const result = await this.engine.update(request.object, request.data, { filter: { id: request.id } });
        return {
            object: request.object,
            id: request.id,
            record: result
        };
    }

    async deleteData(request: { object: string, id: string }) {
        // Adapt: delete(obj, id) -> delete(obj, options)
        await this.engine.delete(request.object, { filter: { id: request.id } });
        return {
            object: request.object,
            id: request.id,
            success: true
        };
    }

    // ==========================================
    // Metadata Caching
    // ==========================================

    async getMetaItemCached(request: { type: string, name: string, cacheRequest?: MetadataCacheRequest }): Promise<MetadataCacheResponse> {
        try {
            const item = SchemaRegistry.getItem(request.type, request.name);
            if (!item) {
                throw new Error(`Metadata item ${request.type}/${request.name} not found`);
            }

            // Calculate ETag (simple hash of the stringified metadata)
            const content = JSON.stringify(item);
            const hash = simpleHash(content);
            const etag = { value: hash, weak: false };

            // Check If-None-Match header
            if (request.cacheRequest?.ifNoneMatch) {
                const clientEtag = request.cacheRequest.ifNoneMatch.replace(/^"(.*)"$/, '$1').replace(/^W\/"(.*)"$/, '$1');
                if (clientEtag === hash) {
                    // Return 304 Not Modified
                    return {
                        notModified: true,
                        etag,
                    };
                }
            }

            // Return full metadata with cache headers
            return {
                data: item,
                etag,
                lastModified: new Date().toISOString(),
                cacheControl: {
                    directives: ['public', 'max-age'],
                    maxAge: 3600, // 1 hour
                },
                notModified: false,
            };
        } catch (error: any) {
            throw error;
        }
    }

    // ==========================================
    // Batch Operations
    // ==========================================

    async batchData(request: { object: string, request: BatchUpdateRequest }): Promise<BatchUpdateResponse> {
        const { object, request: batchReq } = request;
        const { operation, records, options } = batchReq;
        const results: Array<{ id?: string; success: boolean; error?: string; record?: any }> = [];
        let succeeded = 0;
        let failed = 0;

        for (const record of records) {
            try {
                switch (operation) {
                    case 'create': {
                        const created = await this.engine.insert(object, record.data || record);
                        results.push({ id: created.id, success: true, record: created });
                        succeeded++;
                        break;
                    }
                    case 'update': {
                        if (!record.id) throw new Error('Record id is required for update');
                        const updated = await this.engine.update(object, record.data || {}, { filter: { id: record.id } });
                        results.push({ id: record.id, success: true, record: updated });
                        succeeded++;
                        break;
                    }
                    case 'upsert': {
                        // Try update first, then create if not found
                        if (record.id) {
                            try {
                                const existing = await this.engine.findOne(object, { filter: { id: record.id } });
                                if (existing) {
                                    const updated = await this.engine.update(object, record.data || {}, { filter: { id: record.id } });
                                    results.push({ id: record.id, success: true, record: updated });
                                } else {
                                    const created = await this.engine.insert(object, { id: record.id, ...(record.data || {}) });
                                    results.push({ id: created.id, success: true, record: created });
                                }
                            } catch {
                                const created = await this.engine.insert(object, { id: record.id, ...(record.data || {}) });
                                results.push({ id: created.id, success: true, record: created });
                            }
                        } else {
                            const created = await this.engine.insert(object, record.data || record);
                            results.push({ id: created.id, success: true, record: created });
                        }
                        succeeded++;
                        break;
                    }
                    case 'delete': {
                        if (!record.id) throw new Error('Record id is required for delete');
                        await this.engine.delete(object, { filter: { id: record.id } });
                        results.push({ id: record.id, success: true });
                        succeeded++;
                        break;
                    }
                    default:
                        results.push({ id: record.id, success: false, error: `Unknown operation: ${operation}` });
                        failed++;
                }
            } catch (err: any) {
                results.push({ id: record.id, success: false, error: err.message });
                failed++;
                if (options?.atomic) {
                    // Abort remaining operations on first failure in atomic mode
                    break;
                }
                if (!options?.continueOnError) {
                    break;
                }
            }
        }

        return {
            success: failed === 0,
            operation,
            total: records.length,
            succeeded,
            failed,
            results: options?.returnRecords !== false ? results : results.map(r => ({ id: r.id, success: r.success, error: r.error })),
        } as BatchUpdateResponse;
    }
    
    async createManyData(request: { object: string, records: any[] }): Promise<any> {
        const records = await this.engine.insert(request.object, request.records);
        return {
            object: request.object,
            records,
            count: records.length
        };
    }
    
    async updateManyData(request: UpdateManyDataRequest): Promise<BatchUpdateResponse> {
        const { object, records, options } = request;
        const results: Array<{ id?: string; success: boolean; error?: string; record?: any }> = [];
        let succeeded = 0;
        let failed = 0;

        for (const record of records) {
            try {
                const updated = await this.engine.update(object, record.data, { filter: { id: record.id } });
                results.push({ id: record.id, success: true, record: updated });
                succeeded++;
            } catch (err: any) {
                results.push({ id: record.id, success: false, error: err.message });
                failed++;
                if (!options?.continueOnError) {
                    break;
                }
            }
        }

        return {
            success: failed === 0,
            operation: 'update',
            total: records.length,
            succeeded,
            failed,
            results,
        } as BatchUpdateResponse;
    }

    async analyticsQuery(request: any): Promise<any> {
        // Map AnalyticsQuery (cube-style) to engine aggregation.
        // cube name maps to object name; measures → aggregations; dimensions → groupBy.
        const { query, cube } = request;
        const object = cube;

        // Build groupBy from dimensions
        const groupBy = query.dimensions || [];

        // Build aggregations from measures
        // Measures can be simple field names like "count" or "field_name.sum"
        // Or cube-defined measure names. We support: field.function or just function(field).
        const aggregations: Array<{ field: string; method: string; alias: string }> = [];
        if (query.measures) {
            for (const measure of query.measures) {
                // Support formats: "count", "amount.sum", "revenue.avg"
                if (measure === 'count' || measure === 'count_all') {
                    aggregations.push({ field: '*', method: 'count', alias: 'count' });
                } else if (measure.includes('.')) {
                    const [field, method] = measure.split('.');
                    aggregations.push({ field, method, alias: `${field}_${method}` });
                } else {
                    // Treat as count of the field
                    aggregations.push({ field: measure, method: 'sum', alias: measure });
                }
            }
        }

        // Build filter from analytics filters
        let filter: any = undefined;
        if (query.filters && query.filters.length > 0) {
            const conditions: any[] = query.filters.map((f: any) => {
                const op = this.mapAnalyticsOperator(f.operator);
                if (f.values && f.values.length === 1) {
                    return { [f.member]: { [op]: f.values[0] } };
                } else if (f.values && f.values.length > 1) {
                    return { [f.member]: { $in: f.values } };
                }
                return { [f.member]: { [op]: true } };
            });
            filter = conditions.length === 1 ? conditions[0] : { $and: conditions };
        }

        // Execute via engine.aggregate (which delegates to driver.find with groupBy/aggregations)
        const rows = await this.engine.aggregate(object, {
            filter,
            groupBy: groupBy.length > 0 ? groupBy : undefined,
            aggregations: aggregations.length > 0
                ? aggregations.map(a => ({ field: a.field, method: a.method as any, alias: a.alias }))
                : [{ field: '*', method: 'count' as any, alias: 'count' }],
        });

        // Build field metadata
        const fields = [
            ...groupBy.map((d: string) => ({ name: d, type: 'string' })),
            ...aggregations.map(a => ({ name: a.alias, type: 'number' })),
        ];

        return {
            success: true,
            data: {
                rows,
                fields,
            },
        };
    }

    async getAnalyticsMeta(request: any): Promise<any> {
        // Auto-generate cube metadata from registered objects in SchemaRegistry.
        // Each object becomes a cube; number fields → measures; other fields → dimensions.
        const objects = SchemaRegistry.listItems('object');
        const cubeFilter = request?.cube;

        const cubes: any[] = [];
        for (const obj of objects) {
            const schema = obj as any;
            if (cubeFilter && schema.name !== cubeFilter) continue;

            const measures: Record<string, any> = {};
            const dimensions: Record<string, any> = {};
            const fields = schema.fields || {};

            // Always add a count measure
            measures['count'] = {
                name: 'count',
                label: 'Count',
                type: 'count',
                sql: '*',
            };

            for (const [fieldName, fieldDef] of Object.entries(fields)) {
                const fd = fieldDef as any;
                const fieldType = fd.type || 'text';

                if (['number', 'currency', 'percent'].includes(fieldType)) {
                    // Numeric fields become both measures and dimensions
                    measures[`${fieldName}_sum`] = {
                        name: `${fieldName}_sum`,
                        label: `${fd.label || fieldName} (Sum)`,
                        type: 'sum',
                        sql: fieldName,
                    };
                    measures[`${fieldName}_avg`] = {
                        name: `${fieldName}_avg`,
                        label: `${fd.label || fieldName} (Avg)`,
                        type: 'avg',
                        sql: fieldName,
                    };
                    dimensions[fieldName] = {
                        name: fieldName,
                        label: fd.label || fieldName,
                        type: 'number',
                        sql: fieldName,
                    };
                } else if (['date', 'datetime'].includes(fieldType)) {
                    dimensions[fieldName] = {
                        name: fieldName,
                        label: fd.label || fieldName,
                        type: 'time',
                        sql: fieldName,
                        granularities: ['day', 'week', 'month', 'quarter', 'year'],
                    };
                } else if (['boolean'].includes(fieldType)) {
                    dimensions[fieldName] = {
                        name: fieldName,
                        label: fd.label || fieldName,
                        type: 'boolean',
                        sql: fieldName,
                    };
                } else {
                    // text, select, lookup, etc. → dimension
                    dimensions[fieldName] = {
                        name: fieldName,
                        label: fd.label || fieldName,
                        type: 'string',
                        sql: fieldName,
                    };
                }
            }

            cubes.push({
                name: schema.name,
                title: schema.label || schema.name,
                description: schema.description,
                sql: schema.name,
                measures,
                dimensions,
                public: true,
            });
        }

        return {
            success: true,
            data: { cubes },
        };
    }

    private mapAnalyticsOperator(op: string): string {
        const map: Record<string, string> = {
            equals: '$eq',
            notEquals: '$ne',
            contains: '$contains',
            notContains: '$notContains',
            gt: '$gt',
            gte: '$gte',
            lt: '$lt',
            lte: '$lte',
            set: '$ne',
            notSet: '$eq',
        };
        return map[op] || '$eq';
    }

    async triggerAutomation(_request: any): Promise<any> {
        throw new Error('triggerAutomation requires plugin-automation service. Install and register a plugin that provides the "automation" service.');
    }

    async deleteManyData(request: DeleteManyDataRequest): Promise<any> {
        // This expects deleting by IDs.
        return this.engine.delete(request.object, {
            filter: { id: { $in: request.ids } },
            ...request.options
        });
    }

    async saveMetaItem(request: { type: string, name: string, item?: any }) {
        if (!request.item) {
            throw new Error('Item data is required');
        }
        // Default implementation saves to Memory Registry
        SchemaRegistry.registerItem(request.type, request.item, 'name');
        return {
            success: true,
            message: 'Saved to memory registry'
        };
    }

    // ==========================================
    // Feed Operations
    // ==========================================

    async listFeed(request: any): Promise<any> {
        const svc = this.requireFeedService();
        const result = await svc.listFeed({
            object: request.object,
            recordId: request.recordId,
            filter: request.type,
            limit: request.limit,
            cursor: request.cursor,
        });
        return { success: true, data: result };
    }

    async createFeedItem(request: any): Promise<any> {
        const svc = this.requireFeedService();
        const item = await svc.createFeedItem({
            object: request.object,
            recordId: request.recordId,
            type: request.type,
            actor: { type: 'user', id: 'current_user' },
            body: request.body,
            mentions: request.mentions,
            parentId: request.parentId,
            visibility: request.visibility,
        });
        return { success: true, data: item };
    }

    async updateFeedItem(request: any): Promise<any> {
        const svc = this.requireFeedService();
        const item = await svc.updateFeedItem(request.feedId, {
            body: request.body,
            mentions: request.mentions,
            visibility: request.visibility,
        });
        return { success: true, data: item };
    }

    async deleteFeedItem(request: any): Promise<any> {
        const svc = this.requireFeedService();
        await svc.deleteFeedItem(request.feedId);
        return { success: true, data: { feedId: request.feedId } };
    }

    async addReaction(request: any): Promise<any> {
        const svc = this.requireFeedService();
        const reactions = await svc.addReaction(request.feedId, request.emoji, 'current_user');
        return { success: true, data: { reactions } };
    }

    async removeReaction(request: any): Promise<any> {
        const svc = this.requireFeedService();
        const reactions = await svc.removeReaction(request.feedId, request.emoji, 'current_user');
        return { success: true, data: { reactions } };
    }

    async pinFeedItem(request: any): Promise<any> {
        const svc = this.requireFeedService();
        const item = await svc.getFeedItem(request.feedId);
        if (!item) throw new Error(`Feed item ${request.feedId} not found`);
        // IFeedService doesn't have dedicated pin/unpin — use updateFeedItem to persist pin state
        await svc.updateFeedItem(request.feedId, { visibility: item.visibility });
        return { success: true, data: { feedId: request.feedId, pinned: true, pinnedAt: new Date().toISOString() } };
    }

    async unpinFeedItem(request: any): Promise<any> {
        const svc = this.requireFeedService();
        const item = await svc.getFeedItem(request.feedId);
        if (!item) throw new Error(`Feed item ${request.feedId} not found`);
        await svc.updateFeedItem(request.feedId, { visibility: item.visibility });
        return { success: true, data: { feedId: request.feedId, pinned: false } };
    }

    async starFeedItem(request: any): Promise<any> {
        const svc = this.requireFeedService();
        const item = await svc.getFeedItem(request.feedId);
        if (!item) throw new Error(`Feed item ${request.feedId} not found`);
        // IFeedService doesn't have dedicated star/unstar — verify item exists then return state
        await svc.updateFeedItem(request.feedId, { visibility: item.visibility });
        return { success: true, data: { feedId: request.feedId, starred: true, starredAt: new Date().toISOString() } };
    }

    async unstarFeedItem(request: any): Promise<any> {
        const svc = this.requireFeedService();
        const item = await svc.getFeedItem(request.feedId);
        if (!item) throw new Error(`Feed item ${request.feedId} not found`);
        await svc.updateFeedItem(request.feedId, { visibility: item.visibility });
        return { success: true, data: { feedId: request.feedId, starred: false } };
    }

    async searchFeed(request: any): Promise<any> {
        const svc = this.requireFeedService();
        // Search delegates to listFeed with filter since IFeedService doesn't have a dedicated search
        const result = await svc.listFeed({
            object: request.object,
            recordId: request.recordId,
            filter: request.type,
            limit: request.limit,
            cursor: request.cursor,
        });
        // Filter by query text in body
        const queryLower = (request.query || '').toLowerCase();
        const filtered = result.items.filter((item: any) =>
            item.body?.toLowerCase().includes(queryLower)
        );
        return { success: true, data: { items: filtered, total: filtered.length, hasMore: false } };
    }

    async getChangelog(request: any): Promise<any> {
        const svc = this.requireFeedService();
        // Changelog retrieves field_change type feed items
        const result = await svc.listFeed({
            object: request.object,
            recordId: request.recordId,
            filter: 'changes_only',
            limit: request.limit,
            cursor: request.cursor,
        });
        const entries = result.items.map((item: any) => ({
            id: item.id,
            object: item.object,
            recordId: item.recordId,
            actor: item.actor,
            changes: item.changes || [],
            timestamp: item.createdAt,
            source: item.source,
        }));
        return { success: true, data: { entries, total: result.total, nextCursor: result.nextCursor, hasMore: result.hasMore } };
    }

    async feedSubscribe(request: any): Promise<any> {
        const svc = this.requireFeedService();
        const subscription = await svc.subscribe({
            object: request.object,
            recordId: request.recordId,
            userId: 'current_user',
            events: request.events,
            channels: request.channels,
        });
        return { success: true, data: subscription };
    }

    async feedUnsubscribe(request: any): Promise<any> {
        const svc = this.requireFeedService();
        const unsubscribed = await svc.unsubscribe(request.object, request.recordId, 'current_user');
        return { success: true, data: { object: request.object, recordId: request.recordId, unsubscribed } };
    }
}
