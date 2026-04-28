// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Console Application Configuration
 * 
 * Supports two runtime modes:
 * - MSW Mode: Uses Mock Service Worker with in-browser ObjectStack kernel
 * - Server Mode: Connects to a real ObjectStack server
 * 
 * Auto-detection: When served under /_studio/ (embedded in CLI via --ui),
 * the console automatically switches to Server mode with same-origin API.
 */

export type RuntimeMode = 'msw' | 'server';

export interface ConsoleConfig {
  /**
   * Runtime mode
   * - 'msw': Mock Service Worker mode (browser-based kernel)
   * - 'server': Connect to real ObjectStack server
   */
  mode: RuntimeMode;

  /**
   * Server base URL (used in 'server' mode)
   * This should be the server root, not including /api/v1
   * Empty string means same-origin (used in embedded mode)
   * @default 'http://localhost:3000'
   */
  serverUrl: string;

  /**
   * MSW API base path (used in 'msw' mode)
   * This should be empty string since client adds /api/v1/... internally
   * @default ''
   */
  mswBasePath: string;

  /**
   * Single-project mode. When true the backend is serving exactly one
   * synthetic project (no control plane, no org/project selection). The
   * frontend uses this to hide the Org/Project switchers, skip the
   * /login → /organizations → /projects funnel, and route `/` straight to the
   * default project workspace. Driven by a server-injected flag (see
   * `initRuntimeConfig`), which in turn reflects the server's
   * `OBJECTSTACK_MODE` environment variable (or the deprecated
   * `OBJECTSTACK_MULTI_PROJECT` legacy alias).
   */
  singleProject: boolean;

  /** Project id the frontend should land on in single-project mode. */
  defaultProjectId: string | null;

  /** Organization id the frontend should treat as active in single-project mode. */
  defaultOrgId: string | null;
}

/**
 * Detect if running in embedded mode (served under /_studio/ by CLI)
 */
function isEmbedded(): boolean {
  return typeof window !== 'undefined' && window.location.pathname.startsWith('/_studio');
}

/**
 * Get runtime mode from environment.
 * Priority: ?mode= URL param → VITE_RUNTIME_MODE env → embedded detection → default 'msw'
 */
function getRuntimeMode(): RuntimeMode {
  if (typeof window !== 'undefined') {
    const urlMode = new URLSearchParams(window.location.search).get('mode');
    if (urlMode === 'msw' || urlMode === 'server') return urlMode;
  }

  if (import.meta.env.VITE_RUNTIME_MODE === 'server') return 'server';
  if (isEmbedded()) return 'server';

  return 'msw';
}

/**
 * Resolve the server URL based on environment and context
 */
function resolveServerUrl(): string {
  // Explicit env var takes priority (including empty string for same-origin)
  if (import.meta.env.VITE_SERVER_URL != null) {
    return import.meta.env.VITE_SERVER_URL;
  }
  
  // Embedded mode: same-origin API
  if (isEmbedded()) {
    return '';
  }
  
  return 'http://localhost:3000';
}

/**
 * Default configuration values
 */
const defaultConfig: ConsoleConfig = {
  mode: getRuntimeMode(),
  serverUrl: resolveServerUrl(),
  mswBasePath: '',  // Empty - client adds /api/v1/... internally
  singleProject: false,
  defaultProjectId: null,
  defaultOrgId: null,
};

/**
 * Current application configuration
 */
export const config: ConsoleConfig = {
  ...defaultConfig,
};

/**
 * Runtime config the studio backend injects at `/api/v1/studio/runtime-config`.
 * Unknown/older backends omit the endpoint entirely; in that case the
 * frontend falls back to multi-project defaults (i.e. the original behaviour).
 */
interface StudioRuntimeConfig {
  singleProject?: boolean;
  defaultProjectId?: string | null;
  defaultOrgId?: string | null;
}

/**
 * Fetch the server-injected runtime config and merge it into `config`.
 *
 * Must be awaited before the app renders so `config.singleProject` is
 * definitive by the time `__root.tsx` decides whether to redirect to
 * `/login`. In MSW mode no fetch happens — the `VITE_STUDIO_SINGLE_PROJECT`
 * env var is the only override available.
 */
export async function initRuntimeConfig(): Promise<void> {
  if (isMswMode()) {
    if (import.meta.env.VITE_STUDIO_SINGLE_PROJECT === 'true') {
      config.singleProject = true;
      config.defaultProjectId = config.defaultProjectId ?? 'proj_local';
      config.defaultOrgId = config.defaultOrgId ?? 'org_local';
    }
    return;
  }

  const base = getApiBaseUrl();
  try {
    const res = await fetch(`${base}/api/v1/studio/runtime-config`, {
      credentials: 'include',
    });
    if (!res.ok) return;
    const body = (await res.json()) as StudioRuntimeConfig;
    if (!body || typeof body !== 'object') return;
    if (body.singleProject) {
      config.singleProject = true;
      config.defaultProjectId = body.defaultProjectId ?? 'proj_local';
      config.defaultOrgId = body.defaultOrgId ?? 'org_local';
    }
  } catch {
    // Endpoint missing or network error → keep multi-project defaults.
  }
}

/**
 * Check if running in MSW mode
 */
export function isMswMode(): boolean {
  return config.mode === 'msw';
}

/**
 * Check if running in Server mode
 */
export function isServerMode(): boolean {
  return config.mode === 'server';
}

/**
 * Get the API base URL based on current mode
 */
export function getApiBaseUrl(): string {
  if (isServerMode()) {
    return config.serverUrl;
  }
  return config.mswBasePath;
}

/**
 * Update configuration at runtime
 * Useful for switching modes programmatically
 */
export function updateConfig(updates: Partial<ConsoleConfig>): void {
  Object.assign(config, updates);
}

/**
 * Log current configuration (for debugging)
 */
export function logConfig(): void {
  console.log('[Console Config]', {
    mode: config.mode,
    apiBaseUrl: getApiBaseUrl(),
    serverUrl: config.serverUrl,
    singleProject: config.singleProject,
    defaultProjectId: config.defaultProjectId,
    defaultOrgId: config.defaultOrgId,
  });
}


