import { createRestConnector, type RestAuth, type RestResponse } from '@objectstack/connector-rest';
import type { Connector, ConnectorAction, ConnectorAuth } from '@objectstack/spec';

/**
 * OpenAPI connector generator — turns a declarative OpenAPI 3.x document into a
 * {@link Connector} definition + handler map (ADR-0023).
 *
 * Each OpenAPI operation maps to one connector action; a single generic handler
 * (closing over the operation's method + path template) reuses the REST
 * transport from `@objectstack/connector-rest` — one shared HTTP/auth
 * implementation (ADR-0022). The output is an ordinary `type: 'api'` connector,
 * registered via `engine.registerConnector(def, handlers)` exactly like a
 * hand-written one — the registry, discovery endpoint, and Studio palette have
 * no awareness that it came from OpenAPI.
 */

/** A free-form JSON Schema fragment (matches ConnectorAction input/outputSchema). */
export type JsonSchema = Record<string, unknown>;

/** Minimal subset of an OpenAPI 3.x document consumed by the generator.
 *  The caller is responsible for loading and de-referencing ($ref) the doc. */
export interface OpenApiDocument {
    openapi?: string;
    info?: { title?: string; description?: string; version?: string };
    servers?: { url: string }[];
    paths?: Record<string, OpenApiPathItem>;
    components?: { securitySchemes?: Record<string, OpenApiSecurityScheme> };
}

export interface OpenApiPathItem {
    [method: string]: OpenApiOperation | unknown;
}

export interface OpenApiOperation {
    operationId?: string;
    summary?: string;
    description?: string;
    tags?: string[];
    parameters?: OpenApiParameter[];
    requestBody?: OpenApiRequestBody;
    responses?: Record<string, OpenApiResponse>;
}

export interface OpenApiParameter {
    name: string;
    in: 'path' | 'query' | 'header' | 'cookie';
    required?: boolean;
    description?: string;
    schema?: JsonSchema;
}

export interface OpenApiRequestBody {
    required?: boolean;
    description?: string;
    content?: Record<string, { schema?: JsonSchema }>;
}

export interface OpenApiResponse {
    description?: string;
    content?: Record<string, { schema?: JsonSchema }>;
}

export interface OpenApiSecurityScheme {
    type: 'apiKey' | 'http' | 'oauth2' | 'openIdConnect';
    name?: string;
    in?: 'header' | 'query' | 'cookie';
    scheme?: string;
}

/** Flattened view of a single operation, passed to the `include` predicate. */
export interface OperationInfo {
    operationId?: string;
    method: string;
    path: string;
    tags?: string[];
    summary?: string;
    description?: string;
}

/** Configuration for {@link createOpenApiConnector}. */
export interface OpenApiConnectorConfig {
    /** Connector machine name (snake_case). Defaults to a slug of info.title. */
    name?: string;
    /** Human-friendly label. Defaults to info.title (then name). */
    label?: string;
    /** Description. Defaults to info.description. */
    description?: string;
    /** Icon identifier for the Studio palette. */
    icon?: string;
    /** The parsed OpenAPI 3.x document (caller loads/derefs it). */
    document: OpenApiDocument;
    /** Override the base URL (else servers[0].url). */
    baseUrl?: string;
    /** Static auth with credentials. If omitted, the declared security scheme is
     *  reflected in the definition (best-effort) but no credentials are applied. */
    auth?: RestAuth;
    /** Only include operations for which this predicate returns true (allowlist). */
    include?: (op: OperationInfo) => boolean;
    /** Injected fetch implementation (defaults to global `fetch`). */
    fetchImpl?: typeof fetch;
}

/** OpenAPI HTTP method keys, in a deterministic order. */
const HTTP_METHODS = ['get', 'put', 'post', 'delete', 'patch', 'options', 'head', 'trace'] as const;

/**
 * Build an OpenAPI connector definition and its handler map.
 *
 * @returns the `Connector` definition and a `handlers` record keyed by action
 * name, suitable for `engine.registerConnector(def, handlers)`.
 */
export function createOpenApiConnector(config: OpenApiConnectorConfig): {
    definition: Connector;
    handlers: Record<string, (input: unknown) => Promise<unknown>>;
} {
    const { document, include, auth, fetchImpl } = config;
    const name = config.name ?? slug(document.info?.title ?? 'openapi_connector');
    const label = config.label ?? document.info?.title ?? name;
    const description = config.description ?? document.info?.description;
    const baseUrl = config.baseUrl ?? document.servers?.[0]?.url;
    if (!baseUrl) {
        throw new Error('createOpenApiConnector: no base URL — provide config.baseUrl or document.servers[0].url');
    }

    // Reuse the REST transport for URL building, static auth, and JSON handling.
    const rest = createRestConnector({ name, label, baseUrl, auth, fetchImpl, icon: config.icon, description });
    const request = rest.handlers.request as (input: unknown) => Promise<RestResponse>;

    const actions: ConnectorAction[] = [];
    const handlers: Record<string, (input: unknown) => Promise<unknown>> = {};
    const seenNames = new Set<string>();

    for (const op of collectOperations(document)) {
        if (include && !include(toInfo(op))) continue;
        const actionName = uniqueName(op.operationId ?? slug(`${op.method}_${op.path}`), seenNames);

        actions.push({
            name: actionName,
            label: op.summary ?? actionName,
            description: op.description,
            inputSchema: buildInputSchema(op),
            outputSchema: buildOutputSchema(op),
        });

        handlers[actionName] = async (input: unknown) => {
            const req = (input ?? {}) as { path?: unknown; query?: unknown; header?: unknown; body?: unknown };
            return request({
                method: op.method.toUpperCase(),
                path: interpolatePath(op.path, asRecord(req.path)),
                query: stringifyValues(asRecord(req.query)),
                headers: stringifyValues(asRecord(req.header)),
                body: req.body,
            });
        };
    }

    const definition: Connector = { name, label, type: 'api', description, icon: config.icon, actions };
    const authentication = auth ? authToConnectorAuth(auth) : inferAuthentication(document);
    if (authentication) definition.authentication = authentication;

    return { definition, handlers };
}

interface Op extends OpenApiOperation {
    method: string;
    path: string;
}

/** Flatten paths × methods into a deterministic list of operations. */
function collectOperations(doc: OpenApiDocument): Op[] {
    const ops: Op[] = [];
    for (const [path, item] of Object.entries(doc.paths ?? {})) {
        if (!item || typeof item !== 'object') continue;
        const record = item as Record<string, unknown>;
        for (const method of HTTP_METHODS) {
            const operation = record[method] as OpenApiOperation | undefined;
            if (!operation || typeof operation !== 'object') continue;
            ops.push({ ...operation, method, path });
        }
    }
    return ops;
}

function toInfo(op: Op): OperationInfo {
    return {
        operationId: op.operationId,
        method: op.method,
        path: op.path,
        tags: op.tags,
        summary: op.summary,
        description: op.description,
    };
}

/**
 * Assemble the action inputSchema from an operation's parameters + requestBody.
 * Produces { type: 'object', properties: { path, query, header, body }, required }
 * where only non-empty sections are emitted.
 */
function buildInputSchema(op: OpenApiOperation): JsonSchema | undefined {
    const sections: Record<'path' | 'query' | 'header', { props: Record<string, JsonSchema>; required: string[] }> = {
        path: { props: {}, required: [] },
        query: { props: {}, required: [] },
        header: { props: {}, required: [] },
    };

    for (const p of op.parameters ?? []) {
        if (!p || typeof p !== 'object' || '$ref' in p) continue;
        if (p.in !== 'path' && p.in !== 'query' && p.in !== 'header') continue;
        const sec = sections[p.in];
        sec.props[p.name] = p.schema ?? (p.description ? { type: 'string', description: p.description } : { type: 'string' });
        if (p.required) sec.required.push(p.name);
    }

    const properties: Record<string, JsonSchema> = {};
    const required: string[] = [];
    for (const where of ['path', 'query', 'header'] as const) {
        const sec = sections[where];
        if (Object.keys(sec.props).length === 0) continue;
        const schema: JsonSchema = { type: 'object', properties: sec.props };
        if (sec.required.length) schema.required = sec.required;
        properties[where] = schema;
        // Path params are always required when present; others only if any are.
        if (where === 'path' || sec.required.length) required.push(where);
    }

    const bodySchema = extractRequestBodySchema(op.requestBody);
    if (bodySchema) {
        properties.body = bodySchema;
        if (op.requestBody && !('$ref' in op.requestBody) && op.requestBody.required) required.push('body');
    }

    if (Object.keys(properties).length === 0) return undefined;
    const schema: JsonSchema = { type: 'object', properties };
    if (required.length) schema.required = required;
    return schema;
}

/** Pick the success response's JSON schema (200 → first 2xx → default). */
function buildOutputSchema(op: OpenApiOperation): JsonSchema | undefined {
    const responses = op.responses;
    if (!responses) return undefined;
    let code: string | undefined;
    if (responses['200']) code = '200';
    else code = Object.keys(responses).find((c) => /^2\d\d$/.test(c));
    if (!code && responses['default']) code = 'default';
    if (!code) return undefined;
    const resp = responses[code];
    if (!resp || typeof resp !== 'object' || '$ref' in resp) return undefined;
    return pickJsonSchema(resp.content);
}

/** Extract the requestBody JSON schema (prefers application/json). */
function extractRequestBodySchema(rb: OpenApiRequestBody | undefined): JsonSchema | undefined {
    if (!rb || typeof rb !== 'object' || '$ref' in rb) return undefined;
    return pickJsonSchema(rb.content);
}

/** Choose the application/json schema, falling back to the first content type. */
function pickJsonSchema(content: Record<string, { schema?: JsonSchema }> | undefined): JsonSchema | undefined {
    if (!content) return undefined;
    const chosen = content['application/json'] ?? Object.values(content)[0];
    return chosen?.schema;
}

/** Map a credentialed RestAuth to the serializable ConnectorAuth metadata. */
function authToConnectorAuth(auth: RestAuth): ConnectorAuth {
    switch (auth.kind) {
        case 'api-key':
            return { kind: 'api-key', name: auth.name, in: auth.in };
        case 'basic':
            return { kind: 'basic' };
        case 'bearer':
            return { kind: 'bearer' };
        default:
            return { kind: 'none' };
    }
}

/** Best-effort map of the first declared security scheme to a serializable auth. */
function inferAuthentication(doc: OpenApiDocument): ConnectorAuth | undefined {
    const schemes = doc.components?.securitySchemes;
    if (!schemes) return undefined;
    for (const scheme of Object.values(schemes)) {
        if (!scheme) continue;
        if (scheme.type === 'apiKey' && scheme.name && (scheme.in === 'header' || scheme.in === 'query')) {
            return { kind: 'api-key', name: scheme.name, in: scheme.in };
        }
        if (scheme.type === 'http') {
            if (scheme.scheme === 'basic') return { kind: 'basic' };
            if (scheme.scheme === 'bearer') return { kind: 'bearer' };
        }
        // oauth2 is importable open-source as a static bearer token (ADR-0023 §4).
        if (scheme.type === 'oauth2') {
            return { kind: 'bearer', description: 'OAuth2 declared — supply a static bearer token (managed OAuth2 is enterprise).' };
        }
    }
    return undefined;
}

/** Interpolate {name} path templates with encoded values from the input. */
function interpolatePath(template: string, pathParams: Record<string, unknown>): string {
    return template.replace(/\{([^}]+)\}/g, (_match, key: string) => {
        const value = pathParams[key];
        return value === undefined || value === null ? `{${key}}` : encodeURIComponent(String(value));
    });
}

/** Coerce a record of mixed values into string values, dropping null/undefined. */
function stringifyValues(rec: Record<string, unknown>): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(rec)) {
        if (v === undefined || v === null) continue;
        out[k] = String(v);
    }
    return out;
}

/** Return v if it is a plain object, else an empty record. */
function asRecord(v: unknown): Record<string, unknown> {
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

/** Ensure a deterministically unique action name within the connector. */
function uniqueName(base: string, seen: Set<string>): string {
    let candidate = base;
    if (seen.has(candidate)) {
        let i = 2;
        while (seen.has(`${base}_${i}`)) i++;
        candidate = `${base}_${i}`;
    }
    seen.add(candidate);
    return candidate;
}

/** Slugify a string into a snake_case machine name. */
function slug(s: string): string {
    const out = s
        .normalize('NFKD')
        .replace(/[^a-zA-Z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .toLowerCase();
    return out || 'connector';
}
