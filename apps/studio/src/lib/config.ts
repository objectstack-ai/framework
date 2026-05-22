// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Studio runtime configuration.
 *
 * Studio is a thin SPA that always talks to a real ObjectStack backend
 * over HTTP — there is no in-browser MSW mode. When served standalone
 * (Vite dev at :5173) the backend is reached via the dev-server proxy
 * to localhost:3000; when embedded under `/_studio/` (CLI `--ui`,
 * Vercel deployment, self-host) it uses same-origin requests.
 *
 * Single-project mode is communicated by the backend at
 * `/api/v1/studio/runtime-config` and resolved before first render so
 * route guards (see `__root.tsx`) make the right decision on first paint.
 */

export interface ConsoleConfig {
  /**
   * Server base URL.
   * Empty string ⇒ same-origin (embedded mode under `/_studio/`).
   * Otherwise the API root (no trailing `/api/v1`).
   */
  serverUrl: string;

  /**
   * Single-project mode. When true the backend is serving exactly one
   * synthetic project (no control plane, no org/project selection). The
   * frontend uses this to hide the Org/Project switchers, skip the
   * /login → /organizations → /projects funnel, and route `/` straight
   * to the default project workspace. Driven by a server-injected flag
   * (see `initRuntimeConfig`), which in turn reflects the server's
   * `OS_MODE` environment variable.
   */
  singleProject: boolean;

  /** Project id the frontend should land on in single-project mode. */
  defaultProjectId: string | null;

  /** Organization id the frontend should treat as active in single-project mode. */
  defaultOrgId: string | null;
}

/** True when served under `/_studio/` (CLI --ui, Vercel, self-host). */
function isEmbedded(): boolean {
  return typeof window !== 'undefined' && window.location.pathname.startsWith('/_studio');
}

/** Resolve the server URL. */
function resolveServerUrl(): string {
  if (import.meta.env.VITE_SERVER_URL != null) {
    return import.meta.env.VITE_SERVER_URL;
  }
  // Embedded under /_studio/ → same-origin.
  if (isEmbedded()) return '';
  // Standalone Vite dev → empty string, the dev server proxies /api → :3000.
  return '';
}

const defaultConfig: ConsoleConfig = {
  serverUrl: resolveServerUrl(),
  singleProject: false,
  defaultProjectId: null,
  defaultOrgId: null,
};

export const config: ConsoleConfig = { ...defaultConfig };

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
 * `/login`.
 */
export async function initRuntimeConfig(): Promise<void> {
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

/** API base URL for `fetch()`. */
export function getApiBaseUrl(): string {
  return config.serverUrl;
}

/** Update configuration at runtime (testing helper). */
export function updateConfig(updates: Partial<ConsoleConfig>): void {
  Object.assign(config, updates);
}

/** Log current configuration (debugging). */
export function logConfig(): void {
  console.log('[Studio Config]', {
    apiBaseUrl: getApiBaseUrl(),
    serverUrl: config.serverUrl,
    singleProject: config.singleProject,
    defaultProjectId: config.defaultProjectId,
    defaultOrgId: config.defaultOrgId,
  });
}
