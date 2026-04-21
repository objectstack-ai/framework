// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Environment state hooks.
 *
 * Studio treats the environment as a first-class, URL-owned primitive
 * (`/environments/:environmentId/...`) in the spirit of Power Platform.
 * These hooks wrap the new `@objectstack/client` environments API added in
 * the v4.1 environment-per-database migration (PR #1186).
 *
 * @see docs/adr/0002-environment-database-isolation.md
 */

import { useCallback, useEffect, useState } from 'react';
import { useClient } from '@objectstack/client-react';
import type { Environment, EnvironmentDatabase, EnvironmentMember } from '@objectstack/spec/cloud';
import { useActiveOrganizationId } from '@/hooks/useSession';

export interface EnvironmentDetail {
  environment: Environment;
  database?: EnvironmentDatabase;
  membership?: EnvironmentMember;
  credential?: { id: string; status: string; activatedAt?: string };
  organization?: { id: string; name: string; displayName?: string };
}

const ACTIVE_ENV_STORAGE_KEY = 'objectstack.studio.activeEnvironmentId';

export function rememberActiveEnvironment(id: string | null | undefined): void {
  if (typeof window === 'undefined') return;
  try {
    if (id) window.localStorage.setItem(ACTIVE_ENV_STORAGE_KEY, id);
    else window.localStorage.removeItem(ACTIVE_ENV_STORAGE_KEY);
  } catch {
    // localStorage unavailable (e.g. SSR, privacy mode) — silently ignore.
  }
}

export function recallActiveEnvironment(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(ACTIVE_ENV_STORAGE_KEY);
  } catch {
    return null;
  }
}

/**
 * Hook: list all environments visible to the current session.
 */
export function useEnvironments() {
  const client = useClient() as any; // ObjectStackClient — typed as any to avoid export shape coupling.
  const activeOrgId = useActiveOrganizationId();
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(async () => {
    if (!client?.environments) return;
    if (!activeOrgId) {
      setEnvironments([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await client.environments.list({ organizationId: activeOrgId });
      setEnvironments((result?.environments as Environment[]) ?? []);
    } catch (err) {
      setError(err as Error);
      setEnvironments([]);
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

  return { environments, loading, error, reload: load };
}

/**
 * Hook: load a single environment detail by id.
 *
 * Side-effect: once loaded, propagate the id to the ObjectStackClient so
 * every subsequent HTTP call attaches the `X-Environment-Id` header.
 */
export function useEnvironmentDetail(environmentId: string | undefined) {
  const client = useClient() as any;
  const [detail, setDetail] = useState<EnvironmentDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(async () => {
    if (!environmentId || !client?.environments) {
      setDetail(null);
      client?.setEnvironmentId?.(undefined);
      return;
    }
    setLoading(true);
    setError(null);
    client.setEnvironmentId(environmentId);
    rememberActiveEnvironment(environmentId);
    try {
      const result = await client.environments.get(environmentId);
      setDetail(result as EnvironmentDetail);
    } catch (err) {
      setError(err as Error);
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [client, environmentId]);

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
 * Used by the NewEnvironmentDialog to populate the "Driver" selector. The
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
    if (!client?.environments?.listDrivers) return;
    let alive = true;
    setLoading(true);
    (async () => {
      try {
        const result = await client.environments.listDrivers();
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
 * Hook: provision a new environment via the control-plane API.
 */
export function useProvisionEnvironment() {
  const client = useClient() as any;
  const [provisioning, setProvisioning] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const provision = useCallback(
    async (req: Parameters<NonNullable<typeof client.environments>['create']>[0]) => {
      if (!client?.environments) throw new Error('Client not ready');
      setProvisioning(true);
      setError(null);
      try {
        return await client.environments.create(req);
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
 * Hook: retry provisioning for an environment stuck in `failed` state.
 *
 * Wraps `client.environments.retryProvisioning(id)`. Exposes `retrying`
 * state so callers can disable the button and show a spinner while the
 * server re-runs the driver handshake.
 */
export function useRetryProvisioning() {
  const client = useClient() as any;
  const [retrying, setRetrying] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const retry = useCallback(
    async (environmentId: string) => {
      if (!client?.environments?.retryProvisioning) {
        throw new Error('Client not ready');
      }
      setRetrying(true);
      setError(null);
      try {
        return await client.environments.retryProvisioning(environmentId);
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
