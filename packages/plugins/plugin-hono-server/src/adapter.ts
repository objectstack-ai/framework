// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

// Export IHttpServer from core
export * from '@objectstack/core';

import {
    IHttpServer,
    RouteHandler,
    Middleware
} from '@objectstack/core';
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';

export interface HonoCorsOptions {
    enabled?: boolean;
    origins?: string | string[];
    methods?: string[];
    /**
     * Request headers allowed on preflight (`Access-Control-Allow-Headers`).
     *
     * Defaults to `['Content-Type', 'Authorization', 'X-Requested-With']`,
     * which is sufficient for cookie and bearer-token auth.
     */
    allowHeaders?: string[];
    /**
     * Response headers exposed to JS (`Access-Control-Expose-Headers`).
     *
     * Defaults to `['set-auth-token']` so that better-auth's `bearer()` plugin
     * can hand rotated session tokens to cross-origin clients. User-supplied
     * values are merged with this default — `set-auth-token` is always
     * exposed unless CORS is disabled entirely.
     */
    exposeHeaders?: string[];
    credentials?: boolean;
    maxAge?: number;
}

/**
 * Hono Implementation of IHttpServer
 */
export class HonoHttpServer implements IHttpServer {
    private app: Hono;
    private server: any;
    private listeningPort: number | undefined;

    constructor(
        private port: number = 3000,
        private staticRoot?: string
    ) {
        this.app = new Hono();
    }

    // internal helper to convert standard handler to Hono handler
    private wrap(handler: RouteHandler) {
        return async (c: any) => {
            let body: any = {};

            const contentType = c.req.header('content-type') ?? '';
            const isOctetStream = contentType.includes('application/octet-stream');

            // Try to parse JSON body first if content-type is JSON
            if (contentType.includes('application/json')) {
                try {
                    body = await c.req.json();
                } catch(e) {
                    // If JSON parsing fails, try parseBody
                    try {
                        body = await c.req.parseBody();
                    } catch(e2) {}
                }
            } else if (!isOctetStream) {
                // For non-JSON / non-binary content types, use parseBody
                // (Skipping for octet-stream so the raw stream stays consumable
                //  via `req.rawBody()` for binary uploads.)
                try {
                    body = await c.req.parseBody();
                } catch(e) {}
            }

            const rawHeaders = c.req.header();
            // Fetch API `Request` objects don't expose the `Host` header
            // (it's a forbidden header — derived from the URL by the
            // transport). Hostname-based routing in REST/dispatcher
            // depends on it, so we backfill from `c.req.url`.
            if (!rawHeaders.host) {
                try {
                    const u = new URL(c.req.url);
                    if (u.host) rawHeaders.host = u.host;
                } catch { /* non-URL request, leave headers as-is */ }
            }

            const req = {
                params: c.req.param(),
                query: c.req.query(),
                body,
                headers: rawHeaders,
                method: c.req.method,
                path: c.req.path,
                rawBody: async () => {
                    const ab = await c.req.arrayBuffer();
                    return Buffer.from(ab);
                },
            };

            let capturedResponse: any;
            let streamController: ReadableStreamDefaultController | null = null;
            let streamEncoder: TextEncoder | null = null;
            let streamHeaders: Record<string, string> = {};
            let isStreaming = false;
            let streamClosed = false;

            // The unused stream is always created (see below) and may be closed
            // from two places — `res.end()` and the post-handler cleanup — so
            // guard against the double-close that crashes the event loop with
            // `ERR_INVALID_STATE: Controller is already closed`.
            const closeStream = () => {
                if (streamController && !streamClosed) {
                    streamClosed = true;
                    try { streamController.close(); } catch { /* already closed */ }
                }
            };

            const res = {
                json: (data: any) => { capturedResponse = c.json(data); },
                send: (data: string | Uint8Array | ArrayBuffer | Buffer) => {
                    if (data instanceof Uint8Array || data instanceof ArrayBuffer || (typeof Buffer !== 'undefined' && Buffer.isBuffer?.(data))) {
                        const body = data instanceof ArrayBuffer ? data : (data as Uint8Array).buffer.slice((data as Uint8Array).byteOffset, (data as Uint8Array).byteOffset + (data as Uint8Array).byteLength);
                        capturedResponse = c.body(body as ArrayBuffer);
                    } else {
                        capturedResponse = c.html(data as string);
                    }
                },
                status: (code: number) => { c.status(code); return res; },
                header: (name: string, value: string) => {
                    c.header(name, value);
                    streamHeaders[name] = value;
                    return res;
                },
                write: (chunk: string | Uint8Array) => {
                    isStreaming = true;
                    if (streamController && streamEncoder) {
                        const data = typeof chunk === 'string' ? streamEncoder.encode(chunk) : chunk;
                        streamController.enqueue(data);
                    }
                },
                end: () => {
                    // Body-less response (e.g. 204 No Content) honoring any
                    // status already set via `res.status()`. A null body avoids
                    // the undici "Invalid response status code 204" thrown when
                    // an empty *string* body is paired with a null-body status.
                    if (!isStreaming && capturedResponse === undefined) {
                        capturedResponse = c.body(null);
                    }
                    closeStream();
                },
            };

            // Create a streaming response wrapper — if handler calls res.write(),
            // we return a ReadableStream; otherwise fall back to capturedResponse.
            const streamPromise = new Promise<Response | null>((resolve) => {
                const stream = new ReadableStream({
                    start(controller) {
                        streamController = controller;
                        streamEncoder = new TextEncoder();
                    },
                });

                // Run the handler; once it's done, check if streaming was used
                const result = handler(req as any, res as any);
                const done = result instanceof Promise ? result : Promise.resolve(result);
                done.then(() => {
                    if (isStreaming) {
                        resolve(new Response(stream, {
                            status: 200,
                            headers: streamHeaders,
                        }));
                    } else {
                        // Not streaming — close the unused stream and return null
                        closeStream();
                        resolve(null);
                    }
                }).catch((err) => {
                    closeStream();
                    resolve(null);
                });
            });

            const streamResponse = await streamPromise;
            return streamResponse ?? capturedResponse ?? c.json({ error: 'No response from handler' }, 500);
        };
    }

    get(path: string, handler: RouteHandler) {
        this.app.get(path, this.wrap(handler));
    }
    post(path: string, handler: RouteHandler) {
        this.app.post(path, this.wrap(handler));
    }
    put(path: string, handler: RouteHandler) {
        this.app.put(path, this.wrap(handler));
    }
    delete(path: string, handler: RouteHandler) {
        this.app.delete(path, this.wrap(handler));
    }
    patch(path: string, handler: RouteHandler) {
        this.app.patch(path, this.wrap(handler));
    }

    use(pathOrHandler: string | Middleware, handler?: Middleware) {
        if (typeof pathOrHandler === 'string' && handler) {
             this.app.use(pathOrHandler, async (c, next) => {
                 let nextCalled = false;
                 const wrappedNext = () => { nextCalled = true; return next(); };
                 await handler({} as any, {} as any, wrappedNext);
                 if (!nextCalled) await next();
             });
        } else if (typeof pathOrHandler === 'function') {
             this.app.use('*', async (c, next) => {
                 let nextCalled = false;
                 const wrappedNext = () => { nextCalled = true; return next(); };
                 await pathOrHandler({} as any, {} as any, wrappedNext);
                 if (!nextCalled) await next();
             });
        }
    }

    /**
     * Mount a sub-application or router
     */
    mount(path: string, subApp: Hono) {
        this.app.route(path, subApp);
    }


    async listen(port: number) {
        if (this.staticRoot) {
            this.app.get('/*', serveStatic({ root: this.staticRoot }));
        }

        const targetPort = port || this.port;
        const maxRetries = 20;

        for (let attempt = 0; attempt < maxRetries; attempt++) {
            const tryPort = targetPort + attempt;
            try {
                await this.tryListen(tryPort);
                return;
            } catch (err: any) {
                if (err.code === 'EADDRINUSE' && attempt < maxRetries - 1) {
                    if (this.server && typeof this.server.close === 'function') {
                        this.server.close();
                    }
                    continue;
                }
                throw err;
            }
        }
    }

    private tryListen(port: number): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            const server = serve({
                fetch: this.app.fetch,
                port
            }, (info) => {
                this.listeningPort = info.port;
                resolve();
            });
            this.server = server;
            server.on('error', (err: any) => {
                reject(err);
            });
        });
    }

    getPort() {
        return this.listeningPort || this.port;
    }

    // Expose raw app for scenarios where standard interface is not enough
    getRawApp() {
        return this.app;
    }

    async close() {
        if (!this.server) return;
        // Destroy all keep-alive sockets so the server stops immediately
        if (typeof this.server.closeAllConnections === 'function') {
            this.server.closeAllConnections();
        }
        await new Promise<void>((resolve, reject) => {
            this.server.close((err: any) => (err ? reject(err) : resolve()));
        });
    }
}
