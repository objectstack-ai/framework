// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { Connector } from '@objectstack/spec/integration';
import { createOpenApiConnector, type OpenApiConnectorConfig } from './openapi-connector.js';

/**
 * Minimal surface of the automation engine this helper depends on — the
 * connector registry from ADR-0018 §Addendum. Kept structural so callers need
 * no runtime dependency on `@objectstack/service-automation` (mirrors
 * connector-rest / connector-mcp).
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

/**
 * Generate an OpenAPI-backed connector and register it on the engine's connector
 * registry so the baseline `connector_action` node can dispatch to the generated
 * actions (ADR-0023). Returns the registered connector name.
 */
export function registerOpenApiConnector(registry: ConnectorRegistrySurface, config: OpenApiConnectorConfig): string {
    const { def, handlers } = createOpenApiConnector(config);
    registry.registerConnector(def, handlers);
    return def.name;
}
