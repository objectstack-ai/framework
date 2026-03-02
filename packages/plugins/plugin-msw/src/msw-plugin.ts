// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { http, HttpResponse, passthrough } from 'msw';
import { setupWorker } from 'msw/browser';
import { 
    Plugin, 
    PluginContext, 
    ObjectKernel,
    HttpDispatcher,
    HttpDispatcherResult
} from '@objectstack/runtime';
// import { ObjectStackProtocolImplementation } from '@objectstack/objectql';
import { ObjectStackProtocol } from '@objectstack/spec/api';
import { IDataEngine } from '@objectstack/core';

// Helper for parsing query parameters
function parseQueryParams(url: URL): Record<string, any> {
    const params: Record<string, any> = {};
    const keys = Array.from(new Set(url.searchParams.keys()));

    for (const key of keys) {
        const values = url.searchParams.getAll(key);
        // If single value, use it directly. If multiple, keep as array.
        const rawValue = values.length === 1 ? values[0] : values;
        
        // Helper to parse individual value
        const parseValue = (val: string) => {
            if (val === 'true') return true;
            if (val === 'false') return false;
            if (val === 'null') return null;
            if (val === 'undefined') return undefined;
            
            // Try number (integers only or floats)
            // Safety check: Don't convert if it loses information (like leading zeros)
            const num = Number(val);
            if (!isNaN(num) && val.trim() !== '' && String(num) === val) {
                return num;
            }
            
            // Try JSON
            if ((val.startsWith('{') && val.endsWith('}')) || (val.startsWith('[') && val.endsWith(']'))) {
                try {
                    return JSON.parse(val);
                } catch {}
            }
            
            return val;
        };

        if (Array.isArray(rawValue)) {
            params[key] = rawValue.map(parseValue);
        } else {
            params[key] = parseValue(rawValue as string);
        }
    }
    
    return params;
}

export interface MSWPluginOptions {
    /**
     * Enable MSW in the browser environment
     */
    enableBrowser?: boolean;
    
    /**
     * Custom handlers to add to MSW
     */
    customHandlers?: Array<any>;
    
    /**
     * Base URL for API endpoints
     */
    baseUrl?: string;
    
    /**
     * Whether to log requests
     */
    logRequests?: boolean;
}

/**
 * MSW Plugin for ObjectStack

 * 
 * This plugin enables Mock Service Worker integration for testing and development.
 * It automatically mocks API endpoints using the ObjectStack runtime protocol.
 * 
 * @example
 * ```typescript
 * import { MSWPlugin } from '@objectstack/plugin-msw';
 * 
 * // With ObjectKernel
 * const kernel = new ObjectKernel();
 * kernel.use(new MSWPlugin({
 *   enableBrowser: true,
 *   baseUrl: '/api/v1'
 * }));
 * ```
 */
export class MSWPlugin implements Plugin {
    name = 'com.objectstack.plugin.msw';
    type = 'server';
    version = '0.9.0';
    
    private options: MSWPluginOptions;
    private worker: any;
    private handlers: Array<any> = [];
    private protocol?: ObjectStackProtocol;
    private dispatcher?: HttpDispatcher;

    constructor(options: MSWPluginOptions = {}) {
        this.options = {
            enableBrowser: true,
            baseUrl: '/api/v1',
            logRequests: true,
            ...options
        };
    }

    /**
     * Init phase
     */
    init = async (ctx: PluginContext) => {
        ctx.logger.debug('Initializing MSW plugin', { 
            enableBrowser: this.options.enableBrowser,
            baseUrl: this.options.baseUrl,
            logRequests: this.options.logRequests
        });
        // Protocol will be created in start phase
        ctx.logger.info('MSW plugin initialized');
    }

    /**
     * Start phase
     */
    start = async (ctx: PluginContext) => {
        ctx.logger.debug('Starting MSW plugin');
        
        try {
            // 1. Try to get existing protocol service
            try {
                this.protocol = ctx.getService<ObjectStackProtocol>('protocol');
                ctx.logger.debug('Protocol service found from context');
            } catch (e) {
                // Ignore, will try to create default implementation
            }

            // 2. If not found, try to instantiate default implementation dynamically
            if (!this.protocol) {
                try {
                    const dataEngine = ctx.getService<IDataEngine>('objectql');
                    // Dynamically import ObjectStackProtocolImplementation to avoid hard dependency
                    const { ObjectStackProtocolImplementation } = await import('@objectstack/objectql');
                    this.protocol = new ObjectStackProtocolImplementation(dataEngine);
                    ctx.logger.debug('Protocol implementation created dynamically');
                } catch (e: any) {
                    if (e.code === 'ERR_MODULE_NOT_FOUND') {
                         ctx.logger.warn('Module @objectstack/objectql not found. Protocol not initialized.');
                    } else {
                         throw e;
                    }
                }
            }
        
            if (!this.protocol) {
                // Without a protocol, MSW can't serve data APIs
                ctx.logger.warn('No ObjectStackProtocol service available. MSW will only serve static/custom handlers if configured.');
            }

        } catch (e) {
            ctx.logger.error('Failed to initialize protocol', e as Error);
            throw new Error('[MSWPlugin] Failed to initialize protocol');
        }
        
        this.setupHandlers(ctx);
        await this.startWorker(ctx);
    }

    /**
     * Destroy phase
     */
    async destroy() {
        await this.stopWorker();
    }

    /**
     * Setup MSW handlers
     */
    private setupHandlers(ctx: PluginContext) {
        // Initialize HttpDispatcher
        try {
            this.dispatcher = new HttpDispatcher(ctx.getKernel());
        } catch (e) {
            ctx.logger.warn('[MSWPlugin] Could not initialize HttpDispatcher via Kernel. Falling back to simple handlers.');
        }

        const baseUrl = this.options.baseUrl || '/api/v1';

        // Custom handlers have priority
        this.handlers = [
            ...(this.options.customHandlers || [])
        ];

        // Discovery Endpoint
        this.handlers.push(
            http.get('*/.well-known/objectstack', () => {
                if (this.dispatcher) {
                    return HttpResponse.json({
                        data: this.dispatcher.getDiscoveryInfo(baseUrl)
                    });
                }
                return HttpResponse.json({
                    data: {
                        version: 'v1',
                        apiName: 'ObjectStack API',
                        url: baseUrl,
                        capabilities: {
                            graphql: false,
                            search: false,
                            websockets: false,
                            files: false,
                            analytics: false,
                            hub: false
                        }
                    }
                });
            })
        );

        if (this.dispatcher) {
            const dispatcher = this.dispatcher;
            
            // Catch-all handler for ObjectStack Runtime
            // We use a wildcard to capture all methods and paths under baseUrl
            const catchAll = async ({ request, params }: any) => {
                const url = new URL(request.url);
                // Calculate path relative to API prefix
                // e.g. /api/v1/data/contacts -> /data/contacts
                let path = url.pathname;
                if (path.startsWith(baseUrl)) {
                    path = path.slice(baseUrl.length);
                }
                
                if (this.options.logRequests) {
                    // eslint-disable-next-line no-console
                    console.log(`[MSW] Intercepted: ${request.method} ${url.pathname}`, { path });
                }
                
                // Parse Body if present
                let body: any = undefined;
                if (request.method !== 'GET' && request.method !== 'HEAD') {
                    try {
                        body = await request.clone().json();
                    } catch (e) {
                        try {
                            // Try form data if json fails? 
                            // Dispatcher expects objects usually.
                            // For file upload, body might be FormData logic needed?
                            // For now assume JSON or text
                        } catch (e2) {}
                    }
                }

                // Parse Query
                const query = parseQueryParams(url);
                
                // Dispatch
                const result = await dispatcher.dispatch(
                    request.method, 
                    path, 
                    body, 
                    query, 
                    { request }
                );

                if (result.handled) {
                    if (result.response) {
                        return HttpResponse.json(result.response.body, { 
                            status: result.response.status,
                            headers: result.response.headers as any
                        });
                    }
                    if (result.result) {
                        // Handle special results (streams/redirects - unlikely in MSW but possible)
                         if (result.result.type === 'redirect') {
                             return HttpResponse.redirect(result.result.url);
                         }
                         // Fallback for others
                         return HttpResponse.json(result.result);
                    }
                }
                
                // Not handled by dispatcher (404 for this route subset)
                return undefined; // Let MSW pass through or handle next
            };

            this.handlers.push(
                http.all(`*${baseUrl}/*`, catchAll),
                http.all(`*${baseUrl}`, catchAll) // Handle root if needed
            );
            
            ctx.logger.info('MSW handlers set up using HttpDispatcher', { baseUrl });
        } else {
             ctx.logger.warn('[MSWPlugin] No dispatcher available. No API routes registered.');
        }
    }


    /**
     * Start the MSW worker
     */
    private async startWorker(ctx: PluginContext) {
        if (this.options.enableBrowser && typeof window !== 'undefined') {
            // Browser environment
            ctx.logger.debug('Starting MSW in browser mode');
            this.worker = setupWorker(...this.handlers);
            await this.worker.start({
                onUnhandledRequest: 'bypass',
            });
            ctx.logger.info('MSW started in browser mode');
        } else {
            ctx.logger.debug('MSW browser mode disabled or not in browser environment');
        }
    }

    /**
     * Stop the MSW worker
     */
    private async stopWorker() {
        if (this.worker) {
            this.worker.stop();
            console.log('[MSWPlugin] Stopped MSW worker');
        }
    }

    /**
     * Get the MSW worker instance for advanced use cases
     */
    getWorker() {
        return this.worker;
    }

    /**
     * Get registered handlers
     */
    getHandlers() {
        return this.handlers;
    }
}

/**
 * Static helper for interacting with ObjectStack protocol in MSW handlers
 */
export class ObjectStackServer {
    private static protocol: ObjectStackProtocol;

    static init(protocol: ObjectStackProtocol) {
        this.protocol = protocol;
    }

    private static getProtocol(): ObjectStackProtocol {
        if (!this.protocol) {
            throw new Error('ObjectStackServer not initialized. Call ObjectStackServer.init(protocol) first.');
        }
        return this.protocol;
    }

    static async findData(objectName: string, query?: any) {
        const body = await this.getProtocol().findData({ object: objectName, query });
        return { data: body, status: 200 };
    }

    static async getData(objectName: string, id: string, options?: { expand?: string | string[]; select?: string | string[] }) {
        const normalize = (v?: string | string[]) => v == null ? undefined : Array.isArray(v) ? v : [v];
        const body = await this.getProtocol().getData({
            object: objectName,
            id,
            select: normalize(options?.select),
            expand: normalize(options?.expand),
        });
        return { data: body, status: 200 };
    }

    static async createData(objectName: string, data: any) {
        const body = await this.getProtocol().createData({ object: objectName, data });
        return { data: body, status: 201 };
    }

    static async updateData(objectName: string, id: string, data: any) {
        const body = await this.getProtocol().updateData({ object: objectName, id, data });
        return { data: body, status: 200 };
    }

    static async deleteData(objectName: string, id: string) {
        const body = await this.getProtocol().deleteData({ object: objectName, id });
        return { data: body, status: 200 };
    }
}
