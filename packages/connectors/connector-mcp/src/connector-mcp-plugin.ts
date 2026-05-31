// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { Plugin, PluginContext } from '@objectstack/core';
import type { Connector } from '@objectstack/spec/integration';
import { createMcpConnector, type McpConnectorOptions } from './mcp-connector.js';

/**
 * Minimal surface of the automation engine this plugin depends on — the
 * connector registry from ADR-0018 §Addendum. Kept structural so the plugin
 * needs no runtime dependency on `@objectstack/service-automation`.
 */
export interface ConnectorRegistrySurface {
    registerConnector(
        def: Connector,
        handlers: Record<
            string,
            (input: Record<string, unknown>, ctx: unknown) => Promise<Record<string, unknown>>
        >,
    ): void;
    unregisterConnector(name: string): void;
}

export interface ConnectorMcpPluginOptions extends McpConnectorOptions {}

/**
 * ConnectorMcpPlugin — connects to an MCP server, discovers its tools, and
 * registers them as a single connector on the automation engine (ADR-0024).
 * One generic adapter, configured per server (transport + `include`), never
 * per-server code.
 *
 * Lifecycle: on `start()` it connects and builds the connector once; on
 * `stop()` it tears the MCP connection down. If no automation engine is present
 * — or the server is unreachable at boot — the plugin logs and skips: a missing
 * optional connector is not a fatal error (same posture as `ConnectorRestPlugin`).
 */
export class ConnectorMcpPlugin implements Plugin {
    name = 'com.objectstack.connector.mcp';
    version = '1.0.0';
    type = 'standard' as const;
    // Ensure the automation engine (and its connector registry) is started first.
    dependencies = ['com.objectstack.service-automation'];

    private readonly options: ConnectorMcpPluginOptions;
    private connectorName?: string;
    private automation?: ConnectorRegistrySurface;
    private close?: () => Promise<void>;

    constructor(options: ConnectorMcpPluginOptions) {
        this.options = options;
    }

    async init(_ctx: PluginContext): Promise<void> {
        // No services to register; the connector is registered in start() once
        // the automation engine is available and the MCP server has been queried.
    }

    async start(ctx: PluginContext): Promise<void> {
        let automation: ConnectorRegistrySurface | undefined;
        try {
            automation = ctx.getService<ConnectorRegistrySurface>('automation');
        } catch {
            automation = undefined;
        }

        if (!automation || typeof automation.registerConnector !== 'function') {
            ctx.logger.info('ConnectorMcpPlugin: no automation engine — MCP connector not registered');
            return;
        }

        let bundle;
        try {
            bundle = await createMcpConnector(this.options);
        } catch (err) {
            // The MCP server is unreachable / failed discovery at boot. Skip the
            // optional connector rather than failing the whole bootstrap.
            ctx.logger.warn(
                `ConnectorMcpPlugin: could not connect to MCP server — connector not registered: ${(err as Error).message}`,
            );
            return;
        }

        automation.registerConnector(bundle.def, bundle.handlers);
        this.automation = automation;
        this.connectorName = bundle.def.name;
        this.close = bundle.close;
        ctx.logger.info(
            `ConnectorMcpPlugin: MCP connector '${bundle.def.name}' registered with ${bundle.def.actions?.length ?? 0} action(s)`,
        );
    }

    /**
     * Destroy phase — the kernel's shutdown hook (the `Plugin` lifecycle exposes
     * `destroy()`, not `stop()`). Unregister the connector and tear the MCP
     * connection down so no child process / socket is leaked.
     */
    async destroy(): Promise<void> {
        if (this.automation && this.connectorName) {
            try { this.automation.unregisterConnector(this.connectorName); } catch { /* ignore */ }
        }
        if (this.close) {
            try { await this.close(); } catch { /* ignore */ }
        }
    }
}
