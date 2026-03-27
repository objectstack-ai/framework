// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { DynamicModule, Module, Global, Inject, Provider, Controller, Post, Get, Body, Query, Req, Res, All, createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import { ObjectKernel, HttpDispatcher, HttpDispatcherResult } from '@objectstack/runtime';

export const OBJECT_KERNEL = 'OBJECT_KERNEL';

export const ConnectReq = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    return ctx.switchToHttp().getRequest();
  },
);

/**
 * Auth service interface with handleRequest method
 */
interface AuthService {
  handleRequest(request: Request): Promise<Response>;
}

// --- Service ---

@Injectable()
export class ObjectStackService {
  public dispatcher: HttpDispatcher;

  constructor(@Inject(OBJECT_KERNEL) private readonly kernel: ObjectKernel) {
    this.dispatcher = new HttpDispatcher(kernel);
  }

  getKernel() {
    return this.kernel;
  }
}

// --- Controller ---

@Controller('api')
export class ObjectStackController {
  constructor(private readonly service: ObjectStackService) {}

  private async normalizeResponse(result: HttpDispatcherResult, res: any) {
      if (result.handled) {
          if (result.response) {
               res.status(result.response.status);
               if (result.response.headers) {
                   Object.entries(result.response.headers).forEach(([k, v]) => res.setHeader(k, v));
               }
               return res.json(result.response.body);
          }
          if (result.result) {
             const response = result.result;
             
             // Handle redirect
             if (response.type === 'redirect' && response.url) {
                 return res.redirect(response.url);
             }

             // Handle stream
             if (response.type === 'stream' && response.stream) {
                 if (response.headers) {
                     Object.entries(response.headers).forEach(([k, v]) => res.setHeader(k, v));
                 }
                 response.stream.pipe(res);
                 return;
             }
             
             // If response is a standard Response object
             if (response && typeof response.status === 'number' && typeof response.text === 'function') {
                  res.status(response.status);
                  if (response.headers && typeof response.headers.forEach === 'function') {
                      response.headers.forEach((v: string, k: string) => res.setHeader(k, v));
                  }
                  const text = await response.text();
                  res.send(text);
                  return;
             }
             return res.status(200).json(response);
          }
      }
      return res.status(404).json({ success: false, error: { message: 'Not Found', code: 404 } });
  }

  private async handleError(err: any, res: any) {
      return res.status(err.statusCode || 500).json({ 
          success: false, 
          error: { 
              message: err.message || 'Internal Server Error', 
              code: err.statusCode || 500,
              details: err.details 
          } 
      });
  }

  // --- Discovery Endpoint ---
  @Get('discovery')
  async discovery() {
    return { data: await this.service.dispatcher.getDiscoveryInfo('/api') };
  }

  @Post('graphql')
  async graphql(@Body() body: any, @Req() req: any, @Res() res: any) {
    try {
        const result = await this.service.dispatcher.handleGraphQL(body, { request: req });
        return res.json(result);
    } catch (err) {
        return this.handleError(err, res);
    }
  }

  // Auth (Generic Auth Handler)
  @All('auth/*')
  async auth(@Req() req: any, @Res() res: any, @Body() body: any) {
    try {
        // Try AuthPlugin service first (prefer async to support factory-based services)
        const kernel = this.service.getKernel();
        let authService: AuthService | null = null;
        try {
          if (typeof kernel.getServiceAsync === 'function') {
            authService = await kernel.getServiceAsync<AuthService>('auth');
          } else if (typeof kernel.getService === 'function') {
            authService = kernel.getService<AuthService>('auth');
          }
        } catch {
          // Service not registered — fall through to legacy dispatcher
          authService = null;
        }

        if (authService && typeof authService.handleRequest === 'function') {
          // Construct a Web standard Request from the Express/Fastify request
          const protocol = req.protocol || 'http';
          const host = req.get?.('host') || req.headers?.host || 'localhost';
          const url = `${protocol}://${host}${req.originalUrl || req.url}`;
          const headers = new Headers();
          if (req.headers) {
            Object.entries(req.headers).forEach(([k, v]) => {
              if (typeof v === 'string') headers.set(k, v);
              else if (Array.isArray(v)) headers.set(k, v.join(', '));
            });
          }
          const init: RequestInit = { method: req.method, headers };
          if (req.method !== 'GET' && req.method !== 'HEAD' && body) {
            init.body = JSON.stringify(body);
            if (!headers.has('content-type')) {
              headers.set('content-type', 'application/json');
            }
          }
          const webRequest = new Request(url, init);
          const response = await authService.handleRequest(webRequest);

          // Convert Web Response to Express/Fastify response
          res.status(response.status);
          response.headers.forEach((v: string, k: string) => res.setHeader(k, v));
          const text = await response.text();
          return res.send(text);
        }

        // Fallback to legacy dispatcher
        const path = req.params[0] || req.url.split('/auth/')[1]?.split('?')[0] || '';
        const result = await this.service.dispatcher.handleAuth(path, req.method, body, { request: req, response: res });
        return this.normalizeResponse(result, res);
    } catch (err: any) {
        return this.handleError(err, res);
    }
  }

  // Metadata
  @All('meta*')
  async metadata(@Req() req: any, @Res() res: any, @Body() body?: any, @Query() query?: any) {
      try {
          // /api/meta/objects -> objects
          let path = req.params[0] || ''; 
          if (req.url.includes('/meta')) {
             path = req.url.split('/meta')[1].split('?')[0];
          }
          
          const result = await this.service.dispatcher.dispatch(req.method, '/meta' + path, body || req.body, query, { request: req });
          return this.normalizeResponse(result, res);
      } catch (err) {
          return this.handleError(err, res);
      }
  }

  // Data
  @All('data*')
  async data(@Req() req: any, @Res() res: any, @Body() body: any, @Query() query: any) {
      try {
          let path = req.params[0] || '';
          if (req.url.includes('/data')) {
             path = req.url.substring(req.url.indexOf('/data') + 5).split('?')[0];
          }
           
          const result = await this.service.dispatcher.dispatch(req.method, '/data' + path, body, query, { request: req });
          return this.normalizeResponse(result, res);
      } catch (err) {
          return this.handleError(err, res);
      }
  }

  // Storage
  @All('storage*')
  async storage(@Req() req: any, @Res() res: any) {
      try {
          let path = req.params[0] || '';
          if (req.url.includes('/storage')) {
             path = req.url.substring(req.url.indexOf('/storage') + 8).split('?')[0];
          }

          // Handle File for NestJS (Express/Fastify)
          const file = req.file || req.files?.file;
          
          const result = await this.service.dispatcher.handleStorage(path, req.method, file, { request: req });
          return this.normalizeResponse(result, res);
      } catch (err) {
          return this.handleError(err, res);
      }
  }

  // Catch-all: delegate remaining routes to dispatcher.dispatch()
  // Handles packages, analytics, automation, i18n, ui, openapi,
  // custom API endpoints, and any future routes.
  @All('*')
  async catchAll(@Req() req: any, @Res() res: any, @Body() body: any, @Query() query: any) {
      try {
          // Extract the sub-path after /api
          const path = req.url.split('/api')[1]?.split('?')[0] || '';
          const method = req.method;
          const payload = (method === 'POST' || method === 'PUT' || method === 'PATCH') ? body : undefined;
          const result = await this.service.dispatcher.dispatch(method, path, payload, query, { request: req });
          return this.normalizeResponse(result, res);
      } catch (err) {
          return this.handleError(err, res);
      }
  }
}

// --- Discovery Controller ---

@Controller('.well-known')
export class DiscoveryController {
  @Get('objectstack')
  discover(@Res() res: any) {
    return res.redirect('/api/discovery');
  }
}

// --- Module ---

@Global()
@Module({})
export class ObjectStackModule {
  static forRoot(kernel: ObjectKernel): DynamicModule {
    const kernelProvider: Provider = {
      provide: OBJECT_KERNEL,
      useValue: kernel,
    };

    return {
      module: ObjectStackModule,
      controllers: [ObjectStackController, DiscoveryController],
      providers: [kernelProvider, ObjectStackService],
      exports: [kernelProvider, ObjectStackService],
    };
  }
}
