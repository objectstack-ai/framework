// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Project state hooks.
 *
 * Studio treats the project as a first-class, URL-owned primitive
 * (`/projects/:projectId/...`) in the spirit of Power Platform / Supabase.
 * Each project owns an isolated Turso database and its own credentials.
 *
 * @see docs/adr/0002-project-database-isolation.md
 */

import { useCallback, useEffect, useState } from 'react';
import { useClient } from '@objectstack/client-react';
import { useActiveOrganizationId } from '@/hooks/useSession';

/**
 * Snake_case database metadata as returned by the HTTP dispatcher under
 * `GET /cloud/projects/:id`. See `http-dispatcher.ts` (the `database` block
 * it builds alongside the project row).
 */
export interface ProjectDatabaseRow {
  driver?: string;
  database_name?: string;
  database_url?: string;
  storage_limit_mb?: number;
  provisioned_at?: string;
}

export interface ProjectMembershipRow {
  role?: string;
  user_id?: string;
  project_id?: string;
}

/**
 * Canonical project row shape returned by the HTTP API (snake_case).
 *
 * The dispatcher returns raw ObjectQL rows; Studio consumes them verbatim
 * with no camelCase translation.
 */
export interface ProjectRow {
  id: string;
  organization_id: string;
  display_name: string;
  is_default?: boolean;
  is_system?: boolean;
  status?: string;
  plan?: string;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
  database_url?: string;
  database_driver?: string;
  storage_limit_mb?: number;
  provisioned_at?: string;
  hostname?: string;
  metadata?: Record<string, unknown>;
}

export interface ProjectDetail {
  project: ProjectRow;
  database?: ProjectDatabaseRow;
  membership?: ProjectMembershipRow;
  credential?: { id: string; status: string; activatedAt?: string };
  organization?: { id: string; name: string; displayName?: string };
}

const ACTIVE_PROJECT_STORAGE_KEY = 'objectstack.studio.activeProjectId';

export function rememberActiveProject(id: string | null | undefined): void {
  if (typeof window === 'undefined') return;
  try {
    if (id) window.localStorage.setItem(ACTIVE_PROJECT_STORAGE_KEY, id);
    else window.localStorage.removeItem(ACTIVE_PROJECT_STORAGE_KEY);
  } catch {
    // localStorage unavailable (e.g. SSR, privacy mode) — silently ignore.
  }
}

export function recallActiveProject(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(ACTIVE_PROJECT_STORAGE_KEY);
  } catch {
    return null;
  }
}

/**
 * Hook: list all projects visible to the current session.
 */
export function useProjects() {
  const client = useClient() as any;
  const activeOrgId = useActiveOrganizationId();
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(async () => {
    if (!client?.projects) return;
    if (!activeOrgId) {
      setProjects([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await client.projects.list({ organization_id: activeOrgId });
      setProjects((result?.projects as ProjectRow[]) ?? []);
    } catch (err) {
      setError(err as Error);
      setProjects([]);
    } finally {
      setLoading(false);
    }
  }, [client, activeOrgId]);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!alive) return;
      await load();
    })();
    return () => {
      alive = false;
    };
  }, [load]);

  return { projects, loading, error, reload: load };
}

/**
 * Hook: load a single project detail by id.
 *
 * Side-effect: once loaded, propagate the id to the ObjectStackClient so
 * every subsequent HTTP call attaches the `X-Project-Id` header.
 */
export function useProjectDetail(projectId: string | undefined) {
  const client = useClient() as any;
  const [detail, setDetail] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(async () => {
    if (!projectId || !client?.projects) {
      setDetail(null);
      client?.setProjectId?.(undefined);
      return;
    }
    setLoading(true);
    setError(null);
    client.setProjectId(projectId);
    rememberActiveProject(projectId);
    try {
      const result = await client.projects.get(projectId);
      setDetail(result as ProjectDetail);
    } catch (err) {
      setError(err as Error);
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [client, projectId]);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!alive) return;
      await load();
    })();
    return () => {
      alive = false;
    };
  }, [load]);

  return { detail, loading, error, reload: load };
}

/**
 * Hook: list ObjectQL drivers registered on the server.
 *
 * Used by the NewProjectDialog to populate the "Driver" selector. The
 * server exposes whatever drivers are registered via `DriverPlugin`
 * (`memory`, `turso`, or future `sql` drivers) — Studio does not hardcode
 * any particular driver.
 */
export function useDrivers() {
  const client = useClient() as any;
  const [drivers, setDrivers] = useState<Array<{ name: string; driverId: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!client?.projects?.listDrivers) return;
    let alive = true;
    setLoading(true);
    (async () => {
      try {
        const result = await client.projects.listDrivers();
        if (!alive) return;
        setDrivers(result?.drivers ?? []);
      } catch (err) {
        if (!alive) return;
        setError(err as Error);
        setDrivers([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [client]);

  return { drivers, loading, error };
}

/**
 * Hook: provision a new project via the control-plane API.
 */
export function useProvisionProject() {
  const client = useClient() as any;
  const [provisioning, setProvisioning] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const provision = useCallback(
    async (req: Parameters<NonNullable<typeof client.projects>['create']>[0]) => {
      if (!client?.projects) throw new Error('Client not ready');
      setProvisioning(true);
      setError(null);
      try {
        return await client.projects.create(req);
      } catch (err) {
        setError(err as Error);
        throw err;
      } finally {
        setProvisioning(false);
      }
    },
    [client],
  );

  return { provision, provisioning, error };
}

/**
 * Hook: list available project templates from the server.
 */
export function useTemplates() {
  const client = useClient() as any;
  const [templates, setTemplates] = useState<Array<{ id: string; label: string; description: string; category?: string }>>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!client?.projects?.listTemplates) return;
    let alive = true;
    setLoading(true);
    (async () => {
      try {
        const result = await client.projects.listTemplates();
        if (!alive) return;
        setTemplates(result?.templates ?? []);
      } catch {
        if (!alive) return;
        setTemplates([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [client]);

  return { templates, loading };
}

/**
 * Hook: update the hostname bound to a project.
 */
export function useUpdateHostname() {
  const client = useClient() as any;
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const updateHostname = useCallback(
    async (projectId: string, hostname: string) => {
      if (!client?.projects?.updateHostname) throw new Error('Client not ready');
      setUpdating(true);
      setError(null);
      try {
        return await client.projects.updateHostname(projectId, hostname);
      } catch (err) {
        setError(err as Error);
        throw err;
      } finally {
        setUpdating(false);
      }
    },
    [client],
  );

  return { updateHostname, updating, error };
}

/**
 * Hook: retry provisioning for a project stuck in `failed` state.
 *
 * Wraps `client.projects.retryProvisioning(id)`. Exposes `retrying`
 * state so callers can disable the button and show a spinner while the
 * server re-runs the driver handshake.
 */
export function useRetryProvisioning() {
  const client = useClient() as any;
  const [retrying, setRetrying] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const retry = useCallback(
    async (projectId: string) => {
      if (!client?.projects?.retryProvisioning) {
        throw new Error('Client not ready');
      }
      setRetrying(true);
      setError(null);
      try {
        return await client.projects.retryProvisioning(projectId);
      } catch (err) {
        setError(err as Error);
        throw err;
      } finally {
        setRetrying(false);
      }
    },
    [client],
  );

  return { retry, retrying, error };
}
