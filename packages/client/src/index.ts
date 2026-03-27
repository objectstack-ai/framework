// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { QueryAST, SortNode, AggregationNode, isFilterAST } from '@objectstack/spec/data';
import { 
  BatchUpdateRequest, 
  BatchUpdateResponse, 
  UpdateManyRequest,
  DeleteManyRequest,
  BatchOptions,
  MetadataCacheRequest,
  MetadataCacheResponse,
  StandardErrorCode,
  ErrorCategory,
  GetDiscoveryResponse,
  GetMetaTypesResponse,
  GetMetaItemsResponse,
  LoginRequest,
  SessionResponse,
  GetPresignedUrlRequest,
  PresignedUrlResponse,
  CompleteUploadRequest,
  FileUploadResponse,
  InitiateChunkedUploadRequest,
  InitiateChunkedUploadResponse,
  UploadChunkResponse,
  CompleteChunkedUploadRequest,
  CompleteChunkedUploadResponse,
  UploadProgress,
  CheckPermissionRequest,
  CheckPermissionResponse,
  GetObjectPermissionsResponse,
  GetEffectivePermissionsResponse,
  RealtimeConnectRequest,
  RealtimeConnectResponse,
  RealtimeSubscribeRequest,
  RealtimeSubscribeResponse,
  SetPresenceRequest,
  GetPresenceResponse,
  GetWorkflowConfigResponse,
  GetWorkflowStateResponse,
  WorkflowTransitionRequest,
  WorkflowTransitionResponse,
  WorkflowApproveRequest,
  WorkflowApproveResponse,
  WorkflowRejectRequest,
  WorkflowRejectResponse,
  ListViewsResponse,
  GetViewResponse,
  CreateViewRequest,
  CreateViewResponse,
  UpdateViewRequest,
  UpdateViewResponse,
  DeleteViewResponse,
  RegisterDeviceRequest,
  RegisterDeviceResponse,
  UnregisterDeviceResponse,
  GetNotificationPreferencesResponse,
  UpdateNotificationPreferencesRequest,
  UpdateNotificationPreferencesResponse,
  ListNotificationsResponse,
  MarkNotificationsReadResponse,
  MarkAllNotificationsReadResponse,
  AiNlqRequest,
  AiNlqResponse,
  AiChatRequest,
  AiChatResponse,
  AiSuggestRequest,
  AiSuggestResponse,
  AiInsightsRequest,
  AiInsightsResponse,
  GetLocalesResponse,
  GetTranslationsResponse,
  GetFieldLabelsResponse,
  RegisterRequest,
  GetFeedResponse,
  CreateFeedItemResponse,
  UpdateFeedItemResponse,
  DeleteFeedItemResponse,
  AddReactionResponse,
  RemoveReactionResponse,
  PinFeedItemResponse,
  UnpinFeedItemResponse,
  StarFeedItemResponse,
  UnstarFeedItemResponse,
  SearchFeedResponse,
  GetChangelogResponse,
  SubscribeResponse,
  UnsubscribeResponse,
  WellKnownCapabilities,
  ApiRoutes,
} from '@objectstack/spec/api';
import { Logger, createLogger } from '@objectstack/core';

/**
 * Route types that the client can resolve.
 * Covers all keys from `ApiRoutes` (the discovery schema) plus
 * client-specific virtual routes (`views`, `permissions`).
 */
export type ApiRouteType = keyof ApiRoutes | 'views' | 'permissions';

export interface ClientConfig {
  baseUrl: string;
  token?: string;
  /**
   * Custom fetch implementation (e.g. node-fetch or for Next.js caching)
   */
  fetch?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  /**
   * Logger instance for debugging
   */
  logger?: Logger;
  /**
   * Enable debug logging
   */
  debug?: boolean;
}

/**
 * Discovery Result
 * Re-export from @objectstack/spec/api for convenience
 */
export type DiscoveryResult = GetDiscoveryResponse;

/**
 * @deprecated Use `data.query()` with standard QueryAST parameters instead.
 * This interface uses legacy parameter names (filter/sort/top/skip) that
 * require translation to QueryAST. Prefer QueryAST fields directly:
 *   - filter → where
 *   - select → fields
 *   - sort → orderBy
 *   - skip → offset
 *   - top → limit
 */
export interface QueryOptions {
  select?: string[]; // Simplified Selection
  /** @canonical Preferred filter parameter (singular). */
  filter?: Record<string, any> | unknown[]; // Map or AST
  /** @deprecated Use `filter` (singular). Kept for backward compatibility. */
  filters?: Record<string, any> | unknown[]; // Map or AST
  sort?: string | string[] | SortNode[]; // 'name' or ['-created_at'] or AST
  top?: number;
  skip?: number;
  // Advanced features
  aggregations?: AggregationNode[];
  groupBy?: string[];
}

export interface PaginatedResult<T = any> {
  /** Spec-compliant: array of matching records */
  records: T[];
  /** Total number of matching records (if requested) */
  total?: number;
  /** The object name */
  object?: string;
  /** Whether more records are available */
  hasMore?: boolean;
}

/** Spec: GetDataResponseSchema */
export interface GetDataResult<T = any> {
  object: string;
  id: string;
  record: T;
}

/** Spec: CreateDataResponseSchema */
export interface CreateDataResult<T = any> {
  object: string;
  id: string;
  record: T;
}

/** Spec: UpdateDataResponseSchema */
export interface UpdateDataResult<T = any> {
  object: string;
  id: string;
  record: T;
}

/** Spec: DeleteDataResponseSchema */
export interface DeleteDataResult {
  object: string;
  id: string;
  deleted: boolean;
}

export interface StandardError {
  code: StandardErrorCode;
  message: string;
  category: ErrorCategory;
  httpStatus: number;
  retryable: boolean;
  details?: Record<string, any>;
}

export class ObjectStackClient {
  private baseUrl: string;
  private token?: string;
  private fetchImpl: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  private discoveryInfo?: DiscoveryResult;
  private logger: Logger;

  constructor(config: ClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.token = config.token;
    this.fetchImpl = config.fetch || globalThis.fetch.bind(globalThis);
    
    // Initialize logger
    this.logger = config.logger || createLogger({ 
      level: config.debug ? 'debug' : 'info',
      format: 'pretty'
    });
    
    this.logger.debug('ObjectStack client created', { baseUrl: this.baseUrl });
  }

  /**
   * Initialize the client by discovering server capabilities.
   */
  async connect() {
    this.logger.debug('Connecting to ObjectStack server', { baseUrl: this.baseUrl });
    
    try {
      let data: DiscoveryResult | undefined;

      // 1. Try Standard Discovery (.well-known)
      try {
        let wellKnownUrl: string;
        try {
          // If baseUrl is absolute, get origin
          const url = new URL(this.baseUrl);
          wellKnownUrl = `${url.origin}/.well-known/objectstack`;
        } catch {
          // If baseUrl is relative, use absolute path from root
          wellKnownUrl = '/.well-known/objectstack';
        }

        this.logger.debug('Probing .well-known discovery', { url: wellKnownUrl });
        const res = await this.fetchImpl(wellKnownUrl);
        if (res.ok) {
          const body = await res.json();
          data = body.data || body;
          this.logger.debug('Discovered via .well-known');
        }
      } catch (e) {
        this.logger.debug('Standard discovery probe failed', { error: (e as Error).message });
      }

      // 2. Fallback to Protocol-standard Discovery Path /api/v1/discovery
      if (!data) {
        const fallbackUrl = `${this.baseUrl}/api/v1/discovery`;
        this.logger.debug('Falling back to standard discovery endpoint', { url: fallbackUrl });
        const res = await this.fetchImpl(fallbackUrl);
        if (!res.ok) {
           throw new Error(`Failed to connect to ${fallbackUrl}: ${res.statusText}`);
        }
        const body = await res.json();
        data = body.data || body;
      }

      if (!data) {
         throw new Error('Connection failed: No discovery data returned');
      }

      this.discoveryInfo = data;
      
      this.logger.info('Connected to ObjectStack server', { 
        version: data.version,
        apiName: data.apiName,
        services: data.services 
      });
      
      return data as DiscoveryResult;
    } catch (e) {
      this.logger.error('Failed to connect to ObjectStack server', e as Error, { baseUrl: this.baseUrl });
      throw e;
    }
  }

  /**
   * Well-known capability flags discovered from the server.
   * Returns undefined if the client has not yet connected or the server
   * did not include capabilities in its discovery response.
   */
  get capabilities(): WellKnownCapabilities | undefined {
    return this.discoveryInfo?.capabilities;
  }

  /**
   * Metadata Operations
   */
  meta = {
    /**
     * Get all available metadata types
     * Returns types like 'object', 'plugin', 'view', etc.
     */
    getTypes: async (): Promise<GetMetaTypesResponse> => {
        const route = this.getRoute('metadata');
        const res = await this.fetch(`${this.baseUrl}${route}`);
        return this.unwrapResponse<GetMetaTypesResponse>(res);
    },

    /**
     * Get all items of a specific metadata type
     * @param type - Metadata type name (e.g., 'object', 'plugin')
     * @param options - Optional filters (e.g., packageId to scope by package)
     */
    getItems: async (type: string, options?: { packageId?: string }): Promise<GetMetaItemsResponse> => {
        const route = this.getRoute('metadata');
        const params = new URLSearchParams();
        if (options?.packageId) params.set('package', options.packageId);
        const qs = params.toString();
        const url = `${this.baseUrl}${route}/${type}${qs ? `?${qs}` : ''}`;
        const res = await this.fetch(url);
        return this.unwrapResponse<GetMetaItemsResponse>(res);
    },

    /**
     * Get a specific metadata item by type and name
     * @param type - Metadata type (e.g., 'object', 'plugin')
     * @param name - Item name (snake_case identifier)
     */
    getItem: async (type: string, name: string) => {
        const route = this.getRoute('metadata');
        const res = await this.fetch(`${this.baseUrl}${route}/${type}/${name}`);
        return this.unwrapResponse(res);
    },

    /**
     * Save a metadata item
     * @param type - Metadata type (e.g., 'object', 'plugin')
     * @param name - Item name
     * @param item - The metadata content to save
     */
    saveItem: async (type: string, name: string, item: any) => {
        const route = this.getRoute('metadata');
        const res = await this.fetch(`${this.baseUrl}${route}/${type}/${name}`, {
            method: 'PUT',
            body: JSON.stringify(item)
        });
        return this.unwrapResponse(res);
    },
    
    /**
     * Get object metadata with cache support
     * Supports ETag-based conditional requests for efficient caching
     */
    getCached: async (name: string, cacheOptions?: MetadataCacheRequest): Promise<MetadataCacheResponse> => {
        const route = this.getRoute('metadata');
        const headers: Record<string, string> = {};
        
        if (cacheOptions?.ifNoneMatch) {
          headers['If-None-Match'] = cacheOptions.ifNoneMatch;
        }
        if (cacheOptions?.ifModifiedSince) {
          headers['If-Modified-Since'] = cacheOptions.ifModifiedSince;
        }
        
        const res = await this.fetch(`${this.baseUrl}${route}/object/${name}`, {
          headers
        });
        
        // Check for 304 Not Modified
        if (res.status === 304) {
          return {
            notModified: true,
            etag: cacheOptions?.ifNoneMatch ? { 
              value: cacheOptions.ifNoneMatch.replace(/^W\/|"/g, ''),
              weak: cacheOptions.ifNoneMatch.startsWith('W/')
            } : undefined
          };
        }
        
        const data = await res.json();
        const etag = res.headers.get('ETag');
        const lastModified = res.headers.get('Last-Modified');
        
        return {
          data,
          etag: etag ? { 
            value: etag.replace(/^W\/|"/g, ''), 
            weak: etag.startsWith('W/') 
          } : undefined,
          lastModified: lastModified || undefined,
          notModified: false
        };
    },
    
    getView: async (object: string, type: 'list' | 'form' = 'list') => {
        const route = this.getRoute('ui');
        const res = await this.fetch(`${this.baseUrl}${route}/view/${object}?type=${type}`);
        return this.unwrapResponse(res);
    }
  };

  /**
   * Analytics Services
   */
  analytics = {
    query: async (payload: any) => {
      const route = this.getRoute('analytics');
      const res = await this.fetch(`${this.baseUrl}${route}/query`, {
         method: 'POST',
         body: JSON.stringify(payload)
      });
      return res.json();
    },
    meta: async (cube: string) => {
        const route = this.getRoute('analytics');
        const res = await this.fetch(`${this.baseUrl}${route}/meta/${cube}`);
        return res.json();
    },
    explain: async (payload: any) => {
        const route = this.getRoute('analytics');
        const res = await this.fetch(`${this.baseUrl}${route}/explain`, {
            method: 'POST',
            body: JSON.stringify(payload)
         });
         return res.json();
    }
  };

  /**
   * Package Management Services
   * 
   * Manages the lifecycle of installed packages.
   * A package (ManifestSchema) is the unit of installation.
   * An app (AppSchema) is a UI navigation definition within a package.
   * A package may contain 0, 1, or many apps, or be a pure functionality plugin.
   * 
   * Endpoints:
   * - GET    /packages               → list installed packages
   * - GET    /packages/:id           → get package details  
   * - POST   /packages               → install a package
   * - DELETE  /packages/:id           → uninstall a package
   * - PATCH  /packages/:id/enable    → enable a package
   * - PATCH  /packages/:id/disable   → disable a package
   */
  packages = {
    /**
     * List all installed packages with optional filters.
     */
    list: async (filters?: { status?: string; type?: string; enabled?: boolean }) => {
        const route = this.getRoute('packages');
        const params = new URLSearchParams();
        if (filters?.status) params.set('status', filters.status);
        if (filters?.type) params.set('type', filters.type);
        if (filters?.enabled !== undefined) params.set('enabled', String(filters.enabled));
        const qs = params.toString();
        const url = `${this.baseUrl}${route}${qs ? '?' + qs : ''}`;
        const res = await this.fetch(url);
        return this.unwrapResponse<{ packages: any[]; total: number }>(res);
    },

    /**
     * Get a specific installed package by its ID (reverse domain identifier).
     */
    get: async (id: string) => {
        const route = this.getRoute('packages');
        const res = await this.fetch(`${this.baseUrl}${route}/${encodeURIComponent(id)}`);
        return this.unwrapResponse<{ package: any }>(res);
    },

    /**
     * Install a new package from its manifest.
     */
    install: async (manifest: any, options?: { settings?: Record<string, any>; enableOnInstall?: boolean }) => {
        const route = this.getRoute('packages');
        const res = await this.fetch(`${this.baseUrl}${route}`, {
            method: 'POST',
            body: JSON.stringify({
                manifest,
                settings: options?.settings,
                enableOnInstall: options?.enableOnInstall,
            }),
        });
        return this.unwrapResponse<{ package: any; message?: string }>(res);
    },

    /**
     * Uninstall a package by its ID.
     */
    uninstall: async (id: string) => {
        const route = this.getRoute('packages');
        const res = await this.fetch(`${this.baseUrl}${route}/${encodeURIComponent(id)}`, {
            method: 'DELETE',
        });
        return this.unwrapResponse<{ id: string; success: boolean; message?: string }>(res);
    },

    /**
     * Enable a disabled package.
     */
    enable: async (id: string) => {
        const route = this.getRoute('packages');
        const res = await this.fetch(`${this.baseUrl}${route}/${encodeURIComponent(id)}/enable`, {
            method: 'PATCH',
        });
        return this.unwrapResponse<{ package: any; message?: string }>(res);
    },

    /**
     * Disable an installed package.
     */
    disable: async (id: string) => {
        const route = this.getRoute('packages');
        const res = await this.fetch(`${this.baseUrl}${route}/${encodeURIComponent(id)}/disable`, {
            method: 'PATCH',
        });
        return this.unwrapResponse<{ package: any; message?: string }>(res);
    },
  };

  /**
   * Authentication Services
   */
  auth = {
    /**
     * Login with email and password
     * Uses better-auth endpoint: POST /sign-in/email
     */
    login: async (request: LoginRequest): Promise<SessionResponse> => {
        const route = this.getRoute('auth');
        const res = await this.fetch(`${this.baseUrl}${route}/sign-in/email`, {
            method: 'POST',
            body: JSON.stringify(request)
        });
        const data = await res.json();
        // Auto-set token if present in response
        if (data.data?.token) {
            this.token = data.data.token;
        }
        return data;
    },
    
    /**
     * Logout current user
     * Uses better-auth endpoint: POST /sign-out
     */
    logout: async () => {
        const route = this.getRoute('auth');
        await this.fetch(`${this.baseUrl}${route}/sign-out`, { method: 'POST' });
        this.token = undefined;
    },

    /**
     * Get current user session
     * Uses better-auth endpoint: GET /get-session
     */
    me: async (): Promise<SessionResponse> => {
        const route = this.getRoute('auth');
        const res = await this.fetch(`${this.baseUrl}${route}/get-session`);
        return res.json();
    },

    /**
     * Register a new user account
     * Uses better-auth endpoint: POST /sign-up/email
     */
    register: async (request: RegisterRequest): Promise<SessionResponse> => {
      const route = this.getRoute('auth');
      const res = await this.fetch(`${this.baseUrl}${route}/sign-up/email`, {
        method: 'POST',
        body: JSON.stringify(request)
      });
      const data = await res.json();
      if (data.data?.token) {
        this.token = data.data.token;
      }
      return data;
    },

    /**
     * Refresh an authentication token
     * Note: better-auth handles token refresh automatically via /get-session
     * @param _refreshToken - Not used (better-auth handles refresh automatically)
     */
    refreshToken: async (_refreshToken: string): Promise<SessionResponse> => {
      const route = this.getRoute('auth');
      // better-auth doesn't have a separate refresh endpoint
      // Session refresh is handled automatically when calling /get-session
      const res = await this.fetch(`${this.baseUrl}${route}/get-session`, {
        method: 'GET'
      });
      const data = await res.json();
      if (data.data?.token) {
        this.token = data.data.token;
      }
      return data;
    }
  };

  /**
   * Storage Services
   */
  storage = {
    upload: async (file: any, scope: string = 'user'): Promise<FileUploadResponse> => {
        // 1. Get Presigned URL
        const presignedReq: GetPresignedUrlRequest = {
            filename: file.name,
            mimeType: file.type,
            size: file.size,
            scope
        };
        
        const route = this.getRoute('storage');
        const presignedRes = await this.fetch(`${this.baseUrl}${route}/upload/presigned`, {
            method: 'POST',
            body: JSON.stringify(presignedReq)
        });
        const { data: presigned } = await presignedRes.json() as { data: PresignedUrlResponse['data'] };

        // 2. Upload to Cloud directly (Bypass API Middleware to avoid Auth headers if using S3)
        // Use fetchImpl directly
        const uploadRes = await this.fetchImpl(presigned.uploadUrl, {
            method: presigned.method,
            headers: presigned.headers,
            body: file
        });

        if (!uploadRes.ok) {
            throw new Error(`Storage Upload Failed: ${uploadRes.statusText}`);
        }

        // 3. Complete Upload
        const completeReq: CompleteUploadRequest = {
            fileId: presigned.fileId
        };
        const completeRes = await this.fetch(`${this.baseUrl}${route}/upload/complete`, {
            method: 'POST',
            body: JSON.stringify(completeReq)
        });
        
        return completeRes.json();
    },
    
    getDownloadUrl: async (fileId: string): Promise<string> => {
        const route = this.getRoute('storage');
        const res = await this.fetch(`${this.baseUrl}${route}/files/${fileId}/url`);
        const data = await res.json();
        return data.url;
    },

    /**
     * Get a presigned URL for direct-to-cloud upload
     */
    getPresignedUrl: async (req: GetPresignedUrlRequest): Promise<PresignedUrlResponse> => {
        const route = this.getRoute('storage');
        const res = await this.fetch(`${this.baseUrl}${route}/upload/presigned`, {
            method: 'POST',
            body: JSON.stringify(req)
        });
        return res.json();
    },

    /**
     * Initiate a chunked (multipart) upload session
     */
    initChunkedUpload: async (req: InitiateChunkedUploadRequest): Promise<InitiateChunkedUploadResponse> => {
        const route = this.getRoute('storage');
        const res = await this.fetch(`${this.baseUrl}${route}/upload/chunked`, {
            method: 'POST',
            body: JSON.stringify(req)
        });
        return res.json();
    },

    /**
     * Upload a single chunk/part of a multipart upload
     */
    uploadPart: async (uploadId: string, chunkIndex: number, resumeToken: string, data: Blob | Buffer): Promise<UploadChunkResponse> => {
        const route = this.getRoute('storage');
        const res = await this.fetch(`${this.baseUrl}${route}/upload/chunked/${uploadId}/chunk/${chunkIndex}`, {
            method: 'PUT',
            headers: { 'x-resume-token': resumeToken },
            body: data as any
        });
        return res.json();
    },

    /**
     * Complete a chunked upload by assembling all parts
     */
    completeChunkedUpload: async (req: CompleteChunkedUploadRequest): Promise<CompleteChunkedUploadResponse> => {
        const route = this.getRoute('storage');
        const res = await this.fetch(`${this.baseUrl}${route}/upload/chunked/${req.uploadId}/complete`, {
            method: 'POST',
            body: JSON.stringify(req)
        });
        return res.json();
    },

    /**
     * Resume an interrupted chunked upload.
     * Fetches current progress, then uploads remaining chunks and completes.
     */
    resumeUpload: async (uploadId: string, file: Blob | ArrayBuffer, chunkSize: number, resumeToken: string): Promise<CompleteChunkedUploadResponse> => {
        const route = this.getRoute('storage');

        // 1. Get current progress
        const progressRes = await this.fetch(`${this.baseUrl}${route}/upload/chunked/${uploadId}/progress`);
        const progress = await progressRes.json() as UploadProgress;

        const { totalChunks, uploadedChunks } = progress.data;
        const parts: Array<{ chunkIndex: number; eTag: string }> = [];

        // 2. Upload remaining chunks
        const fileBuffer = file instanceof ArrayBuffer ? file : await file.arrayBuffer();
        for (let i = uploadedChunks; i < totalChunks; i++) {
            const start = i * chunkSize;
            const end = Math.min(start + chunkSize, fileBuffer.byteLength);
            const chunk = new Blob([fileBuffer.slice(start, end)]);

            const chunkRes = await this.storage.uploadPart(uploadId, i, resumeToken, chunk);
            parts.push({ chunkIndex: i, eTag: chunkRes.data.eTag });
        }

        // 3. Complete
        return this.storage.completeChunkedUpload({ uploadId, parts });
    },
  };

  /**
   * Automation Services
   */
  automation = {
      /**
       * Trigger a named automation flow (legacy endpoint)
       */
      trigger: async (triggerName: string, payload: any) => {
          const route = this.getRoute('automation');
          const res = await this.fetch(`${this.baseUrl}${route}/trigger/${triggerName}`, {
              method: 'POST',
              body: JSON.stringify(payload)
          });
          return res.json();
      },

      /**
       * List all registered automation flows
       */
      list: async (): Promise<{ flows: string[]; total: number; hasMore: boolean }> => {
          const route = this.getRoute('automation');
          const res = await this.fetch(`${this.baseUrl}${route}`);
          return this.unwrapResponse(res);
      },

      /**
       * Get a flow definition by name
       */
      get: async (name: string): Promise<any> => {
          const route = this.getRoute('automation');
          const res = await this.fetch(`${this.baseUrl}${route}/${name}`);
          return this.unwrapResponse(res);
      },

      /**
       * Create (register) a new flow
       */
      create: async (name: string, definition: any): Promise<any> => {
          const route = this.getRoute('automation');
          const res = await this.fetch(`${this.baseUrl}${route}`, {
              method: 'POST',
              body: JSON.stringify({ name, ...definition }),
          });
          return this.unwrapResponse(res);
      },

      /**
       * Update an existing flow
       */
      update: async (name: string, definition: any): Promise<any> => {
          const route = this.getRoute('automation');
          const res = await this.fetch(`${this.baseUrl}${route}/${name}`, {
              method: 'PUT',
              body: JSON.stringify({ definition }),
          });
          return this.unwrapResponse(res);
      },

      /**
       * Delete (unregister) a flow
       */
      delete: async (name: string): Promise<{ name: string; deleted: boolean }> => {
          const route = this.getRoute('automation');
          const res = await this.fetch(`${this.baseUrl}${route}/${name}`, {
              method: 'DELETE',
          });
          return this.unwrapResponse(res);
      },

      /**
       * Enable or disable a flow
       */
      toggle: async (name: string, enabled: boolean): Promise<{ name: string; enabled: boolean }> => {
          const route = this.getRoute('automation');
          const res = await this.fetch(`${this.baseUrl}${route}/${name}/toggle`, {
              method: 'POST',
              body: JSON.stringify({ enabled }),
          });
          return this.unwrapResponse(res);
      },

      /**
       * Execution run history
       */
      runs: {
          /**
           * List execution runs for a flow
           */
          list: async (flowName: string, options?: { limit?: number; cursor?: string }): Promise<{ runs: any[]; hasMore: boolean }> => {
              const route = this.getRoute('automation');
              const params = new URLSearchParams();
              if (options?.limit) params.set('limit', String(options.limit));
              if (options?.cursor) params.set('cursor', options.cursor);
              const qs = params.toString();
              const res = await this.fetch(`${this.baseUrl}${route}/${flowName}/runs${qs ? `?${qs}` : ''}`);
              return this.unwrapResponse(res);
          },

          /**
           * Get a single execution run
           */
          get: async (flowName: string, runId: string): Promise<any> => {
              const route = this.getRoute('automation');
              const res = await this.fetch(`${this.baseUrl}${route}/${flowName}/runs/${runId}`);
              return this.unwrapResponse(res);
          },
      },
  };

  /**
   * Permissions Services
   */
  permissions = {
    /**
     * Check if current user has permission for an action on an object
     */
    check: async (request: CheckPermissionRequest): Promise<CheckPermissionResponse> => {
      const route = this.getRoute('permissions');
      const params = new URLSearchParams({ object: request.object, action: request.action });
      if (request.recordId !== undefined) params.set('recordId', request.recordId);
      if (request.field !== undefined) params.set('field', request.field);
      const res = await this.fetch(`${this.baseUrl}${route}/check?${params.toString()}`);
      return this.unwrapResponse<CheckPermissionResponse>(res);
    },

    /**
     * Get all permissions for a specific object
     */
    getObjectPermissions: async (object: string): Promise<GetObjectPermissionsResponse> => {
      const route = this.getRoute('permissions');
      const res = await this.fetch(`${this.baseUrl}${route}/objects/${encodeURIComponent(object)}`);
      return this.unwrapResponse<GetObjectPermissionsResponse>(res);
    },

    /**
     * Get effective permissions for the current user
     */
    getEffectivePermissions: async (): Promise<GetEffectivePermissionsResponse> => {
      const route = this.getRoute('permissions');
      const res = await this.fetch(`${this.baseUrl}${route}/effective`);
      return this.unwrapResponse<GetEffectivePermissionsResponse>(res);
    }
  };

  /**
   * Realtime Services
   */
  realtime = {
    /**
     * Establish a realtime connection
     */
    connect: async (request?: RealtimeConnectRequest): Promise<RealtimeConnectResponse> => {
      const route = this.getRoute('realtime');
      const res = await this.fetch(`${this.baseUrl}${route}/connect`, {
        method: 'POST',
        body: JSON.stringify(request || {})
      });
      return this.unwrapResponse<RealtimeConnectResponse>(res);
    },

    /**
     * Disconnect from realtime services
     */
    disconnect: async (): Promise<void> => {
      const route = this.getRoute('realtime');
      await this.fetch(`${this.baseUrl}${route}/disconnect`, {
        method: 'POST'
      });
    },

    /**
     * Subscribe to a channel
     */
    subscribe: async (request: RealtimeSubscribeRequest): Promise<RealtimeSubscribeResponse> => {
      const route = this.getRoute('realtime');
      const res = await this.fetch(`${this.baseUrl}${route}/subscribe`, {
        method: 'POST',
        body: JSON.stringify(request)
      });
      return this.unwrapResponse<RealtimeSubscribeResponse>(res);
    },

    /**
     * Unsubscribe from a channel
     */
    unsubscribe: async (subscriptionId: string): Promise<void> => {
      const route = this.getRoute('realtime');
      await this.fetch(`${this.baseUrl}${route}/unsubscribe`, {
        method: 'POST',
        body: JSON.stringify({ subscriptionId })
      });
    },

    /**
     * Set presence state on a channel
     */
    setPresence: async (channel: string, state: SetPresenceRequest['state']): Promise<void> => {
      const route = this.getRoute('realtime');
      await this.fetch(`${this.baseUrl}${route}/presence`, {
        method: 'PUT',
        body: JSON.stringify({ channel, state })
      });
    },

    /**
     * Get presence information for a channel
     */
    getPresence: async (channel: string): Promise<GetPresenceResponse> => {
      const route = this.getRoute('realtime');
      const res = await this.fetch(`${this.baseUrl}${route}/presence/${encodeURIComponent(channel)}`);
      return this.unwrapResponse<GetPresenceResponse>(res);
    }
  };

  /**
   * Workflow Services
   */
  workflow = {
    /**
     * Get workflow configuration for an object
     */
    getConfig: async (object: string): Promise<GetWorkflowConfigResponse> => {
      const route = this.getRoute('workflow');
      const res = await this.fetch(`${this.baseUrl}${route}/${encodeURIComponent(object)}/config`);
      return this.unwrapResponse<GetWorkflowConfigResponse>(res);
    },

    /**
     * Get current workflow state for a record
     */
    getState: async (object: string, recordId: string): Promise<GetWorkflowStateResponse> => {
      const route = this.getRoute('workflow');
      const res = await this.fetch(`${this.baseUrl}${route}/${encodeURIComponent(object)}/${encodeURIComponent(recordId)}/state`);
      return this.unwrapResponse<GetWorkflowStateResponse>(res);
    },

    /**
     * Execute a workflow state transition
     */
    transition: async (request: WorkflowTransitionRequest): Promise<WorkflowTransitionResponse> => {
      const route = this.getRoute('workflow');
      const res = await this.fetch(`${this.baseUrl}${route}/${encodeURIComponent(request.object)}/${encodeURIComponent(request.recordId)}/transition`, {
        method: 'POST',
        body: JSON.stringify({
          transition: request.transition,
          comment: request.comment,
          data: request.data
        })
      });
      return this.unwrapResponse<WorkflowTransitionResponse>(res);
    },

    /**
     * Approve a workflow step
     */
    approve: async (request: WorkflowApproveRequest): Promise<WorkflowApproveResponse> => {
      const route = this.getRoute('workflow');
      const res = await this.fetch(`${this.baseUrl}${route}/${encodeURIComponent(request.object)}/${encodeURIComponent(request.recordId)}/approve`, {
        method: 'POST',
        body: JSON.stringify({
          comment: request.comment,
          data: request.data
        })
      });
      return this.unwrapResponse<WorkflowApproveResponse>(res);
    },

    /**
     * Reject a workflow step
     */
    reject: async (request: WorkflowRejectRequest): Promise<WorkflowRejectResponse> => {
      const route = this.getRoute('workflow');
      const res = await this.fetch(`${this.baseUrl}${route}/${encodeURIComponent(request.object)}/${encodeURIComponent(request.recordId)}/reject`, {
        method: 'POST',
        body: JSON.stringify({
          reason: request.reason,
          comment: request.comment
        })
      });
      return this.unwrapResponse<WorkflowRejectResponse>(res);
    }
  };

  /**
   * Views CRUD Services
   */
  views = {
    /**
     * List views for an object
     */
    list: async (object: string, type?: 'list' | 'form'): Promise<ListViewsResponse> => {
      const route = this.getRoute('views');
      const params = new URLSearchParams();
      if (type) params.set('type', type);
      const qs = params.toString();
      const res = await this.fetch(`${this.baseUrl}${route}/${encodeURIComponent(object)}${qs ? `?${qs}` : ''}`);
      return this.unwrapResponse<ListViewsResponse>(res);
    },

    /**
     * Get a specific view
     */
    get: async (object: string, viewId: string): Promise<GetViewResponse> => {
      const route = this.getRoute('views');
      const res = await this.fetch(`${this.baseUrl}${route}/${encodeURIComponent(object)}/${encodeURIComponent(viewId)}`);
      return this.unwrapResponse<GetViewResponse>(res);
    },

    /**
     * Create a new view
     */
    create: async (object: string, data: CreateViewRequest['data']): Promise<CreateViewResponse> => {
      const route = this.getRoute('views');
      const res = await this.fetch(`${this.baseUrl}${route}/${encodeURIComponent(object)}`, {
        method: 'POST',
        body: JSON.stringify({ object, data })
      });
      return this.unwrapResponse<CreateViewResponse>(res);
    },

    /**
     * Update an existing view
     */
    update: async (object: string, viewId: string, data: UpdateViewRequest['data']): Promise<UpdateViewResponse> => {
      const route = this.getRoute('views');
      const res = await this.fetch(`${this.baseUrl}${route}/${encodeURIComponent(object)}/${encodeURIComponent(viewId)}`, {
        method: 'PUT',
        body: JSON.stringify({ object, viewId, data })
      });
      return this.unwrapResponse<UpdateViewResponse>(res);
    },

    /**
     * Delete a view
     */
    delete: async (object: string, viewId: string): Promise<DeleteViewResponse> => {
      const route = this.getRoute('views');
      const res = await this.fetch(`${this.baseUrl}${route}/${encodeURIComponent(object)}/${encodeURIComponent(viewId)}`, {
        method: 'DELETE'
      });
      return this.unwrapResponse<DeleteViewResponse>(res);
    }
  };

  /**
   * Notification Services
   */
  notifications = {
    /**
     * Register a device for push notifications
     */
    registerDevice: async (request: RegisterDeviceRequest): Promise<RegisterDeviceResponse> => {
      const route = this.getRoute('notifications');
      const res = await this.fetch(`${this.baseUrl}${route}/devices`, {
        method: 'POST',
        body: JSON.stringify(request)
      });
      return this.unwrapResponse<RegisterDeviceResponse>(res);
    },

    /**
     * Unregister a device from push notifications
     */
    unregisterDevice: async (deviceId: string): Promise<UnregisterDeviceResponse> => {
      const route = this.getRoute('notifications');
      const res = await this.fetch(`${this.baseUrl}${route}/devices/${encodeURIComponent(deviceId)}`, {
        method: 'DELETE'
      });
      return this.unwrapResponse<UnregisterDeviceResponse>(res);
    },

    /**
     * Get notification preferences for the current user
     */
    getPreferences: async (): Promise<GetNotificationPreferencesResponse> => {
      const route = this.getRoute('notifications');
      const res = await this.fetch(`${this.baseUrl}${route}/preferences`);
      return this.unwrapResponse<GetNotificationPreferencesResponse>(res);
    },

    /**
     * Update notification preferences
     */
    updatePreferences: async (preferences: UpdateNotificationPreferencesRequest['preferences']): Promise<UpdateNotificationPreferencesResponse> => {
      const route = this.getRoute('notifications');
      const res = await this.fetch(`${this.baseUrl}${route}/preferences`, {
        method: 'PUT',
        body: JSON.stringify({ preferences })
      });
      return this.unwrapResponse<UpdateNotificationPreferencesResponse>(res);
    },

    /**
     * List notifications for the current user
     */
    list: async (options?: { read?: boolean; type?: string; limit?: number; cursor?: string }): Promise<ListNotificationsResponse> => {
      const route = this.getRoute('notifications');
      const params = new URLSearchParams();
      if (options?.read !== undefined) params.set('read', String(options.read));
      if (options?.type) params.set('type', options.type);
      if (options?.limit) params.set('limit', String(options.limit));
      if (options?.cursor) params.set('cursor', options.cursor);
      const qs = params.toString();
      const res = await this.fetch(`${this.baseUrl}${route}${qs ? `?${qs}` : ''}`);
      return this.unwrapResponse<ListNotificationsResponse>(res);
    },

    /**
     * Mark specific notifications as read
     */
    markRead: async (ids: string[]): Promise<MarkNotificationsReadResponse> => {
      const route = this.getRoute('notifications');
      const res = await this.fetch(`${this.baseUrl}${route}/read`, {
        method: 'POST',
        body: JSON.stringify({ ids })
      });
      return this.unwrapResponse<MarkNotificationsReadResponse>(res);
    },

    /**
     * Mark all notifications as read
     */
    markAllRead: async (): Promise<MarkAllNotificationsReadResponse> => {
      const route = this.getRoute('notifications');
      const res = await this.fetch(`${this.baseUrl}${route}/read/all`, {
        method: 'POST'
      });
      return this.unwrapResponse<MarkAllNotificationsReadResponse>(res);
    }
  };

  /**
   * AI Services
   */
  ai = {
    /**
     * Natural language query — converts natural language to structured query
     */
    nlq: async (request: AiNlqRequest): Promise<AiNlqResponse> => {
      const route = this.getRoute('ai');
      const res = await this.fetch(`${this.baseUrl}${route}/nlq`, {
        method: 'POST',
        body: JSON.stringify(request)
      });
      return this.unwrapResponse<AiNlqResponse>(res);
    },

    /**
     * Multi-turn AI chat
     */
    chat: async (request: AiChatRequest): Promise<AiChatResponse> => {
      const route = this.getRoute('ai');
      const res = await this.fetch(`${this.baseUrl}${route}/chat`, {
        method: 'POST',
        body: JSON.stringify(request)
      });
      return this.unwrapResponse<AiChatResponse>(res);
    },

    /**
     * AI-powered field value suggestions
     */
    suggest: async (request: AiSuggestRequest): Promise<AiSuggestResponse> => {
      const route = this.getRoute('ai');
      const res = await this.fetch(`${this.baseUrl}${route}/suggest`, {
        method: 'POST',
        body: JSON.stringify(request)
      });
      return this.unwrapResponse<AiSuggestResponse>(res);
    },

    /**
     * AI-powered data insights
     */
    insights: async (request: AiInsightsRequest): Promise<AiInsightsResponse> => {
      const route = this.getRoute('ai');
      const res = await this.fetch(`${this.baseUrl}${route}/insights`, {
        method: 'POST',
        body: JSON.stringify(request)
      });
      return this.unwrapResponse<AiInsightsResponse>(res);
    }
  };

  /**
   * Internationalization Services
   */
  i18n = {
    /**
     * Get available locales
     */
    getLocales: async (): Promise<GetLocalesResponse> => {
      const route = this.getRoute('i18n');
      const res = await this.fetch(`${this.baseUrl}${route}/locales`);
      return this.unwrapResponse<GetLocalesResponse>(res);
    },

    /**
     * Get translations for a locale
     */
    getTranslations: async (locale: string, options?: { namespace?: string; keys?: string[] }): Promise<GetTranslationsResponse> => {
      const route = this.getRoute('i18n');
      const params = new URLSearchParams();
      params.set('locale', locale);
      if (options?.namespace) params.set('namespace', options.namespace);
      if (options?.keys) params.set('keys', options.keys.join(','));
      const res = await this.fetch(`${this.baseUrl}${route}/translations?${params.toString()}`);
      return this.unwrapResponse<GetTranslationsResponse>(res);
    },

    /**
     * Get translated field labels for an object
     */
    getFieldLabels: async (object: string, locale: string): Promise<GetFieldLabelsResponse> => {
      const route = this.getRoute('i18n');
      const res = await this.fetch(`${this.baseUrl}${route}/labels/${encodeURIComponent(object)}?locale=${encodeURIComponent(locale)}`);
      return this.unwrapResponse<GetFieldLabelsResponse>(res);
    }
  };

  /**
   * Feed / Chatter Services
   *
   * Provides access to the activity timeline (comments, field changes, tasks),
   * emoji reactions, pin/star, search, changelog, and record subscriptions.
   * Base path: /api/data/{object}/{recordId}/feed
   */
  feed = {
    /**
     * List feed items for a record
     */
    list: async (object: string, recordId: string, options?: { type?: string; limit?: number; cursor?: string }): Promise<GetFeedResponse> => {
      const route = this.getRoute('feed');
      const params = new URLSearchParams();
      if (options?.type) params.set('type', options.type);
      if (options?.limit) params.set('limit', String(options.limit));
      if (options?.cursor) params.set('cursor', options.cursor);
      const qs = params.toString();
      const res = await this.fetch(`${this.baseUrl}${route}/${encodeURIComponent(object)}/${encodeURIComponent(recordId)}/feed${qs ? `?${qs}` : ''}`);
      return this.unwrapResponse<GetFeedResponse>(res);
    },

    /**
     * Create a new feed item (comment, note, task, etc.)
     */
    create: async (object: string, recordId: string, data: { type: string; body?: string; mentions?: any[]; parentId?: string; visibility?: string }): Promise<CreateFeedItemResponse> => {
      const route = this.getRoute('feed');
      const res = await this.fetch(`${this.baseUrl}${route}/${encodeURIComponent(object)}/${encodeURIComponent(recordId)}/feed`, {
        method: 'POST',
        body: JSON.stringify(data)
      });
      return this.unwrapResponse<CreateFeedItemResponse>(res);
    },

    /**
     * Update an existing feed item
     */
    update: async (object: string, recordId: string, feedId: string, data: { body?: string; mentions?: any[]; visibility?: string }): Promise<UpdateFeedItemResponse> => {
      const route = this.getRoute('feed');
      const res = await this.fetch(`${this.baseUrl}${route}/${encodeURIComponent(object)}/${encodeURIComponent(recordId)}/feed/${encodeURIComponent(feedId)}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      });
      return this.unwrapResponse<UpdateFeedItemResponse>(res);
    },

    /**
     * Delete a feed item
     */
    delete: async (object: string, recordId: string, feedId: string): Promise<DeleteFeedItemResponse> => {
      const route = this.getRoute('feed');
      const res = await this.fetch(`${this.baseUrl}${route}/${encodeURIComponent(object)}/${encodeURIComponent(recordId)}/feed/${encodeURIComponent(feedId)}`, {
        method: 'DELETE'
      });
      return this.unwrapResponse<DeleteFeedItemResponse>(res);
    },

    /**
     * Add an emoji reaction to a feed item
     */
    addReaction: async (object: string, recordId: string, feedId: string, emoji: string): Promise<AddReactionResponse> => {
      const route = this.getRoute('feed');
      const res = await this.fetch(`${this.baseUrl}${route}/${encodeURIComponent(object)}/${encodeURIComponent(recordId)}/feed/${encodeURIComponent(feedId)}/reactions`, {
        method: 'POST',
        body: JSON.stringify({ emoji })
      });
      return this.unwrapResponse<AddReactionResponse>(res);
    },

    /**
     * Remove an emoji reaction from a feed item
     */
    removeReaction: async (object: string, recordId: string, feedId: string, emoji: string): Promise<RemoveReactionResponse> => {
      const route = this.getRoute('feed');
      const res = await this.fetch(`${this.baseUrl}${route}/${encodeURIComponent(object)}/${encodeURIComponent(recordId)}/feed/${encodeURIComponent(feedId)}/reactions/${encodeURIComponent(emoji)}`, {
        method: 'DELETE'
      });
      return this.unwrapResponse<RemoveReactionResponse>(res);
    },

    /**
     * Pin a feed item to the top of the timeline
     */
    pin: async (object: string, recordId: string, feedId: string): Promise<PinFeedItemResponse> => {
      const route = this.getRoute('feed');
      const res = await this.fetch(`${this.baseUrl}${route}/${encodeURIComponent(object)}/${encodeURIComponent(recordId)}/feed/${encodeURIComponent(feedId)}/pin`, {
        method: 'POST'
      });
      return this.unwrapResponse<PinFeedItemResponse>(res);
    },

    /**
     * Unpin a feed item
     */
    unpin: async (object: string, recordId: string, feedId: string): Promise<UnpinFeedItemResponse> => {
      const route = this.getRoute('feed');
      const res = await this.fetch(`${this.baseUrl}${route}/${encodeURIComponent(object)}/${encodeURIComponent(recordId)}/feed/${encodeURIComponent(feedId)}/pin`, {
        method: 'DELETE'
      });
      return this.unwrapResponse<UnpinFeedItemResponse>(res);
    },

    /**
     * Star (bookmark) a feed item
     */
    star: async (object: string, recordId: string, feedId: string): Promise<StarFeedItemResponse> => {
      const route = this.getRoute('feed');
      const res = await this.fetch(`${this.baseUrl}${route}/${encodeURIComponent(object)}/${encodeURIComponent(recordId)}/feed/${encodeURIComponent(feedId)}/star`, {
        method: 'POST'
      });
      return this.unwrapResponse<StarFeedItemResponse>(res);
    },

    /**
     * Unstar a feed item
     */
    unstar: async (object: string, recordId: string, feedId: string): Promise<UnstarFeedItemResponse> => {
      const route = this.getRoute('feed');
      const res = await this.fetch(`${this.baseUrl}${route}/${encodeURIComponent(object)}/${encodeURIComponent(recordId)}/feed/${encodeURIComponent(feedId)}/star`, {
        method: 'DELETE'
      });
      return this.unwrapResponse<UnstarFeedItemResponse>(res);
    },

    /**
     * Search feed items
     */
    search: async (object: string, recordId: string, query: string, options?: { type?: string; actorId?: string; dateFrom?: string; dateTo?: string; limit?: number; cursor?: string }): Promise<SearchFeedResponse> => {
      const route = this.getRoute('feed');
      const params = new URLSearchParams();
      params.set('query', query);
      if (options?.type) params.set('type', options.type);
      if (options?.actorId) params.set('actorId', options.actorId);
      if (options?.dateFrom) params.set('dateFrom', options.dateFrom);
      if (options?.dateTo) params.set('dateTo', options.dateTo);
      if (options?.limit) params.set('limit', String(options.limit));
      if (options?.cursor) params.set('cursor', options.cursor);
      const res = await this.fetch(`${this.baseUrl}${route}/${encodeURIComponent(object)}/${encodeURIComponent(recordId)}/feed/search?${params.toString()}`);
      return this.unwrapResponse<SearchFeedResponse>(res);
    },

    /**
     * Get field-level changelog for a record
     */
    getChangelog: async (object: string, recordId: string, options?: { field?: string; actorId?: string; dateFrom?: string; dateTo?: string; limit?: number; cursor?: string }): Promise<GetChangelogResponse> => {
      const route = this.getRoute('feed');
      const params = new URLSearchParams();
      if (options?.field) params.set('field', options.field);
      if (options?.actorId) params.set('actorId', options.actorId);
      if (options?.dateFrom) params.set('dateFrom', options.dateFrom);
      if (options?.dateTo) params.set('dateTo', options.dateTo);
      if (options?.limit) params.set('limit', String(options.limit));
      if (options?.cursor) params.set('cursor', options.cursor);
      const qs = params.toString();
      const res = await this.fetch(`${this.baseUrl}${route}/${encodeURIComponent(object)}/${encodeURIComponent(recordId)}/changelog${qs ? `?${qs}` : ''}`);
      return this.unwrapResponse<GetChangelogResponse>(res);
    },

    /**
     * Subscribe to record notifications
     */
    subscribe: async (object: string, recordId: string, options?: { events?: string[]; channels?: string[] }): Promise<SubscribeResponse> => {
      const route = this.getRoute('feed');
      const res = await this.fetch(`${this.baseUrl}${route}/${encodeURIComponent(object)}/${encodeURIComponent(recordId)}/subscribe`, {
        method: 'POST',
        body: JSON.stringify(options || {})
      });
      return this.unwrapResponse<SubscribeResponse>(res);
    },

    /**
     * Unsubscribe from record notifications
     */
    unsubscribe: async (object: string, recordId: string): Promise<UnsubscribeResponse> => {
      const route = this.getRoute('feed');
      const res = await this.fetch(`${this.baseUrl}${route}/${encodeURIComponent(object)}/${encodeURIComponent(recordId)}/subscribe`, {
        method: 'DELETE'
      });
      return this.unwrapResponse<UnsubscribeResponse>(res);
    },
  };

  /**
   * Data Operations
   */
  data = {
    /**
     * Advanced Query using ObjectStack Query Protocol
     * Supports both simplified options and full AST
     */
    query: async <T = any>(object: string, query: Partial<QueryAST>): Promise<PaginatedResult<T>> => {
      const route = this.getRoute('data');
      // POST for complex query to avoid URL length limits and allow clean JSON AST
      // Convention: POST /api/v1/data/:object/query
      const res = await this.fetch(`${this.baseUrl}${route}/${object}/query`, {
        method: 'POST',
        body: JSON.stringify(query)
      });
      return this.unwrapResponse<PaginatedResult<T>>(res);
    },

    /**
     * @deprecated Use `data.query()` with standard QueryAST parameters instead.
     * This method uses legacy parameter names. Internally adapts to HTTP GET params.
     */
    find: async <T = any>(object: string, options: QueryOptions = {}): Promise<PaginatedResult<T>> => {
        const route = this.getRoute('data');
        const queryParams = new URLSearchParams();
        
        // 1. Handle Pagination
        if (options.top) queryParams.set('top', options.top.toString());
        if (options.skip) queryParams.set('skip', options.skip.toString());

        // 2. Handle Sort
        if (options.sort) {
            // Check if it's AST 
            if (Array.isArray(options.sort) && typeof options.sort[0] === 'object') {
                 queryParams.set('sort', JSON.stringify(options.sort));
            } else {
                 const sortVal = Array.isArray(options.sort) ? options.sort.join(',') : options.sort;
                 queryParams.set('sort', sortVal as string);
            }
        }
        
        // 3. Handle Select
        if (options.select) {
            queryParams.set('select', options.select.join(','));
        }

        // 4. Handle Filters (Simple vs AST)
        // Canonical HTTP param name: `filter` (singular). `filters` (plural) is accepted
        // for backward compatibility but `filter` is the standard going forward.
        const filterValue = options.filter ?? options.filters;
        if (filterValue) {
             // Detect AST filter format vs simple key-value map. AST filters use an array structure
             // with [field, operator, value] or [logicOp, ...nodes] shape (see isFilterAST from spec).
             // For complex filter expressions, use .query() which builds a proper QueryAST.
             if (this.isFilterAST(filterValue) || Array.isArray(filterValue)) {
                 // AST or any array → serialize as JSON in `filter` param
                 queryParams.set('filter', JSON.stringify(filterValue));
             } else if (typeof filterValue === 'object' && filterValue !== null) {
                 // Plain key-value map → append each as individual query params
                 Object.entries(filterValue as Record<string, unknown>).forEach(([k, v]) => {
                     if (v !== undefined && v !== null) {
                        queryParams.append(k, String(v));
                     }
                 });
             }
        }
        
        // 5. Handle Aggregations & GroupBy (Pass through as JSON if present)
        if (options.aggregations) {
            queryParams.set('aggregations', JSON.stringify(options.aggregations));
        }
        if (options.groupBy) {
             queryParams.set('groupBy', options.groupBy.join(','));
        }

        const res = await this.fetch(`${this.baseUrl}${route}/${object}?${queryParams.toString()}`);
        return this.unwrapResponse<PaginatedResult<T>>(res);
    },

    get: async <T = any>(object: string, id: string): Promise<GetDataResult<T>> => {
        const route = this.getRoute('data');
        const res = await this.fetch(`${this.baseUrl}${route}/${object}/${id}`);
        return this.unwrapResponse<GetDataResult<T>>(res);
    },

    create: async <T = any>(object: string, data: Partial<T>): Promise<CreateDataResult<T>> => {
        const route = this.getRoute('data');
        const res = await this.fetch(`${this.baseUrl}${route}/${object}`, {
            method: 'POST',
            body: JSON.stringify(data)
        });
        return this.unwrapResponse<CreateDataResult<T>>(res);
    },

    createMany: async <T = any>(object: string, data: Partial<T>[]): Promise<T[]> => {
        const route = this.getRoute('data');
        const res = await this.fetch(`${this.baseUrl}${route}/${object}/createMany`, {
            method: 'POST',
            body: JSON.stringify(data)
        });
        return this.unwrapResponse<T[]>(res);
    },

    update: async <T = any>(object: string, id: string, data: Partial<T>): Promise<UpdateDataResult<T>> => {
        const route = this.getRoute('data');
        const res = await this.fetch(`${this.baseUrl}${route}/${object}/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(data)
        });
        return this.unwrapResponse<UpdateDataResult<T>>(res);
    },

    /**
     * Batch update multiple records
     * Uses the new BatchUpdateRequest schema with full control over options
     */
    batch: async (object: string, request: BatchUpdateRequest): Promise<BatchUpdateResponse> => {
        const route = this.getRoute('data');
        const res = await this.fetch(`${this.baseUrl}${route}/${object}/batch`, {
            method: 'POST',
            body: JSON.stringify(request)
        });
        return this.unwrapResponse<BatchUpdateResponse>(res);
    },

    /**
     * Update multiple records (simplified batch update)
     * Convenience method for batch updates without full BatchUpdateRequest
     */
    updateMany: async <T = any>(
      object: string, 
      records: Array<{ id: string; data: Partial<T> }>,
      options?: BatchOptions
    ): Promise<BatchUpdateResponse> => {
        const route = this.getRoute('data');
        const request: UpdateManyRequest = {
          records,
          options
        };
        const res = await this.fetch(`${this.baseUrl}${route}/${object}/updateMany`, {
            method: 'POST',
            body: JSON.stringify(request)
        });
        return this.unwrapResponse<BatchUpdateResponse>(res);
    },

    delete: async (object: string, id: string): Promise<DeleteDataResult> => {
        const route = this.getRoute('data');
        const res = await this.fetch(`${this.baseUrl}${route}/${object}/${id}`, {
            method: 'DELETE'
        });
        return this.unwrapResponse<DeleteDataResult>(res);
    },

    /**
     * Delete multiple records by IDs
     */
    deleteMany: async(object: string, ids: string[], options?: BatchOptions): Promise<BatchUpdateResponse> => {
        const route = this.getRoute('data');
        const request: DeleteManyRequest = {
          ids,
          options
        };
        const res = await this.fetch(`${this.baseUrl}${route}/${object}/deleteMany`, {
             method: 'POST',
             body: JSON.stringify(request)
        });
        return this.unwrapResponse<BatchUpdateResponse>(res);
    }
  };



  /**
   * Private Helpers
   */

  private isFilterAST(filter: any): boolean {
    // Delegate to the spec-exported structural validator instead of naive Array.isArray.
    // This checks for valid AST shapes: [field, op, val], [logic, ...nodes], or [[cond], ...].
    return isFilterAST(filter);
  }

  /**
   * Unwrap the standard REST API response envelope.
   * The HTTP layer wraps responses as `{ success: boolean, data: T, meta? }`
   * (see BaseResponseSchema in contract.zod.ts).
   * This method strips the envelope and returns the inner `data` payload
   * so callers receive the spec-level type (e.g. GetMetaTypesResponse).
   */
  private async unwrapResponse<T>(res: Response): Promise<T> {
    const body = await res.json();
    // If the body has a `success` flag it's a BaseResponse envelope
    if (body && typeof body.success === 'boolean' && 'data' in body) {
      return body.data as T;
    }
    // Already unwrapped or non-standard
    return body as T;
  }

  private async fetch(url: string, options: RequestInit = {}): Promise<Response> {
    this.logger.debug('HTTP request', { 
      method: options.method || 'GET',
      url,
      hasBody: !!options.body
    });
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };

    if (this.token) {
        headers['Authorization'] = `Bearer ${this.token}`;
    }

    const res = await this.fetchImpl(url, { ...options, headers });
    
    this.logger.debug('HTTP response', { 
      method: options.method || 'GET',
      url,
      status: res.status,
      ok: res.ok
    });
    
    if (!res.ok) {
        let errorBody: any;
        try {
            errorBody = await res.json();
        } catch {
            errorBody = { message: res.statusText };
        }
        
        this.logger.error('HTTP request failed', undefined, { 
          method: options.method || 'GET',
          url,
          status: res.status,
          error: errorBody
        });
        
        // Create a standardized error if the response includes error details
        const errorMessage = errorBody?.message || errorBody?.error?.message || res.statusText;
        const errorCode = errorBody?.code || errorBody?.error?.code;
        const error = new Error(`[ObjectStack] ${errorCode ? `${errorCode}: ` : ''}${errorMessage}`) as any;
        
        // Attach error details for programmatic access
        error.code = errorCode;
        error.category = errorBody?.category;
        error.httpStatus = res.status;
        error.retryable = errorBody?.retryable;
        error.details = errorBody?.details || errorBody;
        
        throw error;
    }
    
    return res;
  }

  /**
   * Get the conventional route path for a given API endpoint type
   * ObjectStack uses standard conventions: /api/v1/data, /api/v1/meta, /api/v1/ui
   */
  private getRoute(type: ApiRouteType): string {
    // 1. Use discovered routes if available
    const routes = this.discoveryInfo?.routes;
    if (routes && type in routes) {
        return routes[type as keyof ApiRoutes] as string;
    }

    // 2. Fallback to conventions
    const routeMap: Record<ApiRouteType, string> = {
      data: '/api/v1/data',
      metadata: '/api/v1/meta',
      discovery: '/api/v1/discovery',
      ui: '/api/v1/ui',
      auth: '/api/v1/auth',
      analytics: '/api/v1/analytics',
      storage: '/api/v1/storage',
      automation: '/api/v1/automation',
      packages: '/api/v1/packages',
      permissions: '/api/v1/permissions',
      realtime: '/api/v1/realtime',
      workflow: '/api/v1/workflow',
      views: '/api/v1/ui/views',
      notifications: '/api/v1/notifications',
      ai: '/api/v1/ai',
      i18n: '/api/v1/i18n',
      feed: '/api/v1/feed',
      graphql: '/graphql',
    };
    
    return routeMap[type] || `/api/v1/${type}`;
  }
}

// Re-export type-safe query builder
export { QueryBuilder, FilterBuilder, createQuery, createFilter } from './query-builder';

// Re-export commonly used types from @objectstack/spec/api for convenience
export type {
  BatchUpdateRequest,
  BatchUpdateResponse,
  UpdateManyRequest,
  DeleteManyRequest,
  BatchOptions,
  BatchRecord,
  BatchOperationResult,
  MetadataCacheRequest,
  MetadataCacheResponse,
  StandardErrorCode,
  ErrorCategory,
  GetDiscoveryResponse,
  GetMetaTypesResponse,
  GetMetaItemsResponse,
  CheckPermissionRequest,
  CheckPermissionResponse,
  GetObjectPermissionsResponse,
  GetEffectivePermissionsResponse,
  RealtimeConnectRequest,
  RealtimeConnectResponse,
  RealtimeSubscribeRequest,
  RealtimeSubscribeResponse,
  GetPresenceResponse,
  GetWorkflowConfigResponse,
  GetWorkflowStateResponse,
  WorkflowTransitionRequest,
  WorkflowTransitionResponse,
  WorkflowApproveRequest,
  WorkflowApproveResponse,
  WorkflowRejectRequest,
  WorkflowRejectResponse,
  ListViewsResponse,
  GetViewResponse,
  CreateViewResponse,
  UpdateViewResponse,
  DeleteViewResponse,
  RegisterDeviceRequest,
  RegisterDeviceResponse,
  ListNotificationsResponse,
  AiNlqRequest,
  AiNlqResponse,
  AiChatRequest,
  AiChatResponse,
  AiSuggestRequest,
  AiSuggestResponse,
  AiInsightsRequest,
  AiInsightsResponse,
  GetLocalesResponse,
  GetTranslationsResponse,
  GetFieldLabelsResponse,
  RegisterRequest,
  RefreshTokenRequest,
  GetFeedResponse,
  CreateFeedItemResponse,
  UpdateFeedItemResponse,
  DeleteFeedItemResponse,
  AddReactionResponse,
  RemoveReactionResponse,
  PinFeedItemResponse,
  UnpinFeedItemResponse,
  StarFeedItemResponse,
  UnstarFeedItemResponse,
  SearchFeedResponse,
  GetChangelogResponse,
  SubscribeResponse,
  UnsubscribeResponse,
  WellKnownCapabilities,
} from '@objectstack/spec/api';
