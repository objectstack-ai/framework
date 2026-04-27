// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Session + Organization hooks for Studio.
 *
 * These hooks sit on top of the better-auth session endpoint
 * (`GET /api/v1/auth/get-session`) and the organization plugin endpoints
 * (`/api/v1/auth/organization/**`), both wrapped by
 * `packages/client/src/index.ts`.
 *
 * The three-layer model:
 *
 *   HTTP cookie → `session.activeOrganizationId` → `X-Environment-Id` header
 *       (who)            (which org)                    (which DB)
 *
 * Studio uses `SessionProvider` (below) as the single React source of truth
 * for "who is logged in and which org is active." Consumers call
 * `useSession()` / `useActiveOrganizationId()` / `useOrganizations()`.
 */

import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useClient } from '@objectstack/client-react';

export interface SessionUser {
  id: string;
  email?: string;
  name?: string;
  image?: string | null;
  emailVerified?: boolean;
}

export interface SessionData {
  id: string;
  userId: string;
  token?: string;
  expiresAt?: string;
  activeOrganizationId?: string | null;
}

export interface SessionState {
  user: SessionUser | null;
  session: SessionData | null;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
  setActiveOrganization: (organizationId: string) => Promise<void>;
  organizations: Organization[];
  organizationsLoading: boolean;
  reloadOrganizations: () => Promise<void>;
}

export interface Organization {
  id: string;
  name: string;
  slug?: string;
  logo?: string;
  metadata?: Record<string, unknown> | null;
}

const SessionContext = createContext<SessionState | null>(null);

/**
 * Normalise the better-auth `/get-session` response shape. Depending on the
 * version, the body is either `{ user, session }` directly or wrapped in
 * `{ data: { user, session } }`. Also handles the older `{ data: null }`
 * "not logged in" shape.
 */
function normaliseSessionResponse(raw: any): { user: SessionUser | null; session: SessionData | null } {
  if (!raw) return { user: null, session: null };
  const payload = raw.data !== undefined ? raw.data : raw;
  if (!payload) return { user: null, session: null };
  const user = payload.user ?? null;
  const session = payload.session ?? null;
  return { user, session };
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const client = useClient() as any;
  const [user, setUser] = useState<SessionUser | null>(null);
  const [session, setSession] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [organizationsLoading, setOrganizationsLoading] = useState(false);

  const reloadOrganizations = useCallback(async () => {
    if (!client?.organizations) return;
    setOrganizationsLoading(true);
    try {
      const result = await client.organizations.list();
      setOrganizations(result?.organizations ?? []);
    } catch {
      setOrganizations([]);
    } finally {
      setOrganizationsLoading(false);
    }
  }, [client]);

  const refresh = useCallback(async () => {
    if (!client?.auth) return;
    setLoading(true);
    setError(null);
    try {
      const raw = await client.auth.me();
      const { user: u, session: s } = normaliseSessionResponse(raw);
      setUser(u);
      setSession(s);
    } catch (err) {
      setError(err as Error);
      setUser(null);
      setSession(null);
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (user) {
      reloadOrganizations();
    } else {
      setOrganizations([]);
    }
  }, [user, reloadOrganizations]);

  const logout = useCallback(async () => {
    if (!client?.auth) return;
    try {
      await client.auth.logout();
    } finally {
      setUser(null);
      setSession(null);
      setOrganizations([]);
    }
  }, [client]);

  const setActiveOrganization = useCallback(
    async (organizationId: string) => {
      if (!client?.organizations) return;
      await client.organizations.setActive(organizationId);
      await refresh();
    },
    [client, refresh],
  );

  const value = useMemo<SessionState>(
    () => ({
      user,
      session,
      loading,
      error,
      refresh,
      logout,
      setActiveOrganization,
      organizations,
      organizationsLoading,
      reloadOrganizations,
    }),
    [
      user,
      session,
      loading,
      error,
      refresh,
      logout,
      setActiveOrganization,
      organizations,
      organizationsLoading,
      reloadOrganizations,
    ],
  );

  return createElement(SessionContext.Provider, { value }, children);
}

export function useSession(): SessionState {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error('useSession must be used inside <SessionProvider>.');
  }
  return ctx;
}

/**
 * Convenience selector for the currently-active organization id (taken from
 * the session). Returns `undefined` if no org is selected.
 */
export function useActiveOrganizationId(): string | undefined {
  const { session } = useSession();
  return session?.activeOrganizationId ?? undefined;
}

/**
 * Hook: list every organization the current user belongs to.
 *
 * Backed by the shared state in {@link SessionProvider}, so every caller
 * (top-bar switcher, org list page, new-org redirect) sees the same list
 * and a single reload refreshes them all.
 */
export function useOrganizations() {
  const { organizations, organizationsLoading, reloadOrganizations } = useSession();
  return {
    organizations,
    loading: organizationsLoading,
    error: null as Error | null,
    reload: reloadOrganizations,
  };
}

/**
 * Hook: provision a new organization via better-auth.
 */
export function useCreateOrganization() {
  const client = useClient() as any;
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const create = useCallback(
    async (req: { name: string; slug?: string }) => {
      if (!client?.organizations) throw new Error('Client not ready');
      setCreating(true);
      setError(null);
      try {
        return await client.organizations.create(req);
      } catch (err) {
        setError(err as Error);
        throw err;
      } finally {
        setCreating(false);
      }
    },
    [client],
  );

  return { create, creating, error };
}

/**
 * Hook: cascade-delete an organization.
 *
 * Wraps `client.organizations.delete(id)` (which hits
 * `DELETE /api/v1/cloud/organizations/:id`). The server tears down every
 * project owned by the organization (including each project's physical
 * database) before dropping the org row itself.
 *
 * On success the local session + organization list are refreshed so the
 * deleted org disappears from the switcher and `activeOrganizationId`
 * gets cleared if it pointed at this org.
 */
export function useDeleteOrganization() {
  const client = useClient() as any;
  const { reloadOrganizations, refresh } = useSession();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const remove = useCallback(
    async (organizationId: string) => {
      if (!client?.organizations?.delete) throw new Error('Client not ready');
      setDeleting(true);
      setError(null);
      try {
        const result = await client.organizations.delete(organizationId);
        await reloadOrganizations();
        await refresh();
        return result;
      } catch (err) {
        setError(err as Error);
        throw err;
      } finally {
        setDeleting(false);
      }
    },
    [client, reloadOrganizations, refresh],
  );

  return { remove, deleting, error };
}
