// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { Plugin, PluginContext, IHttpServer } from '@objectstack/core';
import { RestServer } from './rest-server.js';
import { ObjectStackProtocol, RestServerConfig } from '@objectstack/spec/api';
import { registerPackageRoutes } from './package-routes.js';
import type { PackageService } from '@objectstack/service-package';

export interface RestApiPluginConfig {
    serverServiceName?: string;
    protocolServiceName?: string;
    api?: RestServerConfig;
}

/**
 * REST API Plugin
 * 
 * Responsibilities:
 * 1. Consumes 'http.server' (or configured service)
 * 2. Consumes 'protocol' (ObjectStackProtocol)
 * 3. Instantiates RestServer to auto-generate routes
 */
export function createRestApiPlugin(config: RestApiPluginConfig = {}): Plugin {
    return {
        name: 'com.objectstack.rest.api',
        version: '1.0.0',
        
        init: async (_ctx: PluginContext) => {
            // No service registration, this is a consumer plugin
        },
        
        start: async (ctx: PluginContext) => {
            const serverService = config.serverServiceName || 'http.server';
            const protocolService = config.protocolServiceName || 'protocol';
            
            let server: IHttpServer | undefined;
            let protocol: ObjectStackProtocol | undefined;

            try {
                server = ctx.getService<IHttpServer>(serverService);
            } catch (e) {
                // Ignore missing service
            }

            try {
                protocol = ctx.getService<ObjectStackProtocol>(protocolService);
            } catch (e) {
                // Ignore missing service
            }
            
            if (!server) {
                ctx.logger.warn(`RestApiPlugin: HTTP Server service '${serverService}' not found. REST routes skipped.`);
                return;
            }
            
            if (!protocol) {
                ctx.logger.warn(`RestApiPlugin: Protocol service '${protocolService}' not found. REST routes skipped.`);
                return;
            }
            
            ctx.logger.info('Hydrating REST API from Protocol...');
            
            try {
                const restServer = new RestServer(server, protocol, config.api as any);
                restServer.registerRoutes();

                ctx.logger.info('REST API successfully registered');
            } catch (err: any) {
                ctx.logger.error('Failed to register REST API routes', { error: err.message } as any);
                throw err;
            }

            // Register package management routes if service is available
            try {
                const packageService = ctx.getService<PackageService>('package');
                if (packageService) {
                    const basePath = config.api?.api?.basePath || '/api';
                    const version = config.api?.api?.version || 'v1';
                    registerPackageRoutes(server, packageService, `${basePath}/${version}`, {
                        protocol,
                    });
                    ctx.logger.info('Package management routes registered');
                }
            } catch (e) {
                // Package service not available, skip
                ctx.logger.debug('Package service not available, package routes skipped');
            }
        }
    };
}
