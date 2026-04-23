// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { Plugin, PluginContext, IHttpServer } from '@objectstack/core';
import { RestServer, RestKernelManager } from './rest-server.js';
import { ObjectStackProtocol, RestServerConfig } from '@objectstack/spec/api';
import { registerPackageRoutes } from './package-routes.js';
import type { PackageService } from '@objectstack/service-package';

export interface RestApiPluginConfig {
    serverServiceName?: string;
    protocolServiceName?: string;
    /**
     * Optional override for the kernel-manager service name. When the service
     * is registered (by @objectstack/runtime's MultiProjectPlugin), scoped
     * routes resolve per-project protocols at request time.
     */
    kernelManagerServiceName?: string;
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

            // Optional — only present when MultiProjectPlugin is mounted. When
            // available, RestServer will resolve a per-project protocol at
            // request time for scoped (`/projects/:projectId/...`) routes.
            let kernelManager: RestKernelManager | undefined;
            const kernelManagerService = config.kernelManagerServiceName || 'kernel-manager';
            try {
                kernelManager = ctx.getService<RestKernelManager>(kernelManagerService);
            } catch (e) {
                // Single-kernel deployment — fall back to the control protocol
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
                const restServer = new RestServer(server, protocol, config.api as any, kernelManager);
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
                    const versionedBase = `${basePath}/${version}`;
                    const enableProjectScoping = config.api?.api?.enableProjectScoping ?? false;
                    const projectResolution = config.api?.api?.projectResolution ?? 'auto';

                    if (enableProjectScoping && projectResolution === 'required') {
                        // Only register the scoped variant
                        registerPackageRoutes(server, packageService, `${versionedBase}/projects/:projectId`, {
                            protocol,
                        });
                    } else {
                        registerPackageRoutes(server, packageService, versionedBase, { protocol });
                        if (enableProjectScoping) {
                            registerPackageRoutes(server, packageService, `${versionedBase}/projects/:projectId`, {
                                protocol,
                            });
                        }
                    }
                    ctx.logger.info('Package management routes registered');
                }
            } catch (e) {
                // Package service not available, skip
                ctx.logger.debug('Package service not available, package routes skipped');
            }
        }
    };
}
