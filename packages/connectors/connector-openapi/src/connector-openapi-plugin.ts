import type { AutomationEngine } from '@objectstack/service-automation';
import { createOpenApiConnector, type OpenApiConnectorConfig } from './openapi-connector';

/**
 * Register an OpenAPI-generated connector on the automation engine (ADR-0023).
 *
 * Mirrors `registerRestConnector` / `registerMcpConnector`: build the definition
 * + handlers via {@link createOpenApiConnector}, then register them on the
 * engine's connector registry so the `connector_action` node can dispatch to the
 * generated actions.
 */
export function registerOpenApiConnector(engine: AutomationEngine, config: OpenApiConnectorConfig): void {
    const { definition, handlers } = createOpenApiConnector(config);
    engine.registerConnector(definition, handlers);
}
