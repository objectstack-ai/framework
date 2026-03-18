// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * IHttpServer - Standard HTTP Server Interface
 * 
 * Abstract interface for HTTP server capabilities.
 * This allows plugins to interact with HTTP servers without knowing
 * the underlying implementation (Express, Fastify, Hono, etc.).
 * 
 * Follows Dependency Inversion Principle - plugins depend on this interface,
 * not on concrete HTTP framework implementations.
 */

// We use Zod for validation but export interfaces for internal implementation

/**
 * Generic HTTP Request type
 * Abstraction over framework-specific request objects
 */
export interface IHttpRequest {
    /** Request path parameters */
    params: Record<string, string>;
    /** Request query parameters */
    query: Record<string, string | string[]>;
    /** Request body */
    body?: any;
    /** Request headers */
    headers: Record<string, string | string[]>;
    /** HTTP method */
    method: string;
    /** Request path */
    path: string;
}

/**
 * Generic HTTP Response type
 * Abstraction over framework-specific response objects
 */
export interface IHttpResponse {
    /**
     * Send a JSON response
     * @param data - Data to send
     */
    json(data: any): void | Promise<void>;
    
    /**
     * Send a text/html response
     * @param data - Data to send
     */
    send(data: string): void | Promise<void>;
    
    /**
     * Set HTTP status code
     * @param code - HTTP status code
     */
    status(code: number): IHttpResponse;
    
    /**
     * Set response header
     * @param name - Header name
     * @param value - Header value (string or array of strings for multi-value headers)
     */
    header(name: string, value: string | string[]): IHttpResponse;
}

/**
 * Route handler function
 */
export type RouteHandler = (
    req: IHttpRequest,
    res: IHttpResponse
) => void | Promise<void>;

/**
 * Middleware function
 */
export type Middleware = (
    req: IHttpRequest,
    res: IHttpResponse,
    next: () => void | Promise<void>
) => void | Promise<void>;

/**
 * IHttpServer - HTTP Server capability interface
 * 
 * Defines the contract for HTTP server implementations.
 * Concrete implementations (Express, Fastify, Hono) should implement this interface.
 */
export interface IHttpServer {
    /**
     * Register a GET route handler
     * @param path - Route path (e.g., '/api/users/:id')
     * @param handler - Route handler function
     */
    get(path: string, handler: RouteHandler): void;
    
    /**
     * Register a POST route handler
     * @param path - Route path
     * @param handler - Route handler function
     */
    post(path: string, handler: RouteHandler): void;
    
    /**
     * Register a PUT route handler
     * @param path - Route path
     * @param handler - Route handler function
     */
    put(path: string, handler: RouteHandler): void;
    
    /**
     * Register a DELETE route handler
     * @param path - Route path
     * @param handler - Route handler function
     */
    delete(path: string, handler: RouteHandler): void;
    
    /**
     * Register a PATCH route handler
     * @param path - Route path
     * @param handler - Route handler function
     */
    patch(path: string, handler: RouteHandler): void;
    
    /**
     * Register middleware
     * @param path - Optional path to apply middleware to (if omitted, applies globally)
     * @param handler - Middleware function
     */
    use(path: string | Middleware, handler?: Middleware): void;
    
    /**
     * Start the HTTP server
     * @param port - Port number to listen on
     * @returns Promise that resolves when server is ready
     */
    listen(port: number): Promise<void>;

    /**
     * Get the port the server is listening on.
     * Returns the actual bound port after `listen()` resolves, or the
     * configured port before that.
     */
    getPort?(): number;
    
    /**
     * Stop the HTTP server
     * @returns Promise that resolves when server is stopped
     */
    close?(): Promise<void>;
}
