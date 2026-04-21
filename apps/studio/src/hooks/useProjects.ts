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
import type { Project, ProjectDatabase, ProjectMember } from '@objectstack/spec/cloud';
import { useActiveOrganizationId } from '@/hooks/useSession';

export interface ProjectDetail {
  project: Project;
  database?: ProjectDatabase;
  membership?: ProjectMember;
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
  const [projects, setProjects] = useState<Project[]>([]);
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
      const result = await client.projects.list({ organizationId: activeOrgId });
      setProjects((result?.projects as Project[]) ?? []);
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
