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
  twoFactorEnabled?: boolean;
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
  /**
   * `true` once `organizations` has been fetched at least once for the
   * current user. Useful for callers that need to distinguish "user has no
   * orgs" from "we haven't asked the server yet" (e.g. the post-login
   * redirect flow).
   */
  organizationsFetched: boolean;
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
 * Storage keys used by `@object-ui/auth`'s built-in Bearer fetch wrapper.
 * The Console SPA mounts an `<AuthProvider>` from that package which reads
 * `auth-session-token` out of localStorage and injects it as a Bearer header
 * on every API call. We don't use that AuthProvider here in Account, but we
 * MUST keep those keys in sync with our cookie session — otherwise a stale
 * token left by a previous user causes the Console to think the current
 * cookie session is invalid, bouncing it back to `/_account/login`, which
 * Account in turn bounces back to the Console (infinite loop).
 *
 * On every successful session refresh / login we mirror the server token
 * into `auth-session-token`; on logout (or when the server reports no
 * session) we clear both keys.
 */
const OBJECT_UI_AUTH_TOKEN_KEY = 'auth-session-token';
const OBJECT_UI_AUTH_ACTIVE_ORG_KEY = 'auth-active-organization-id';

function syncObjectUiAuthStorage(session: SessionData | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (session?.token) {
      localStorage.setItem(OBJECT_UI_AUTH_TOKEN_KEY, session.token);
    } else {
      localStorage.removeItem(OBJECT_UI_AUTH_TOKEN_KEY);
    }
    if (session?.activeOrganizationId) {
      localStorage.setItem(
        OBJECT_UI_AUTH_ACTIVE_ORG_KEY,
        session.activeOrganizationId,
      );
    } else {
      localStorage.removeItem(OBJECT_UI_AUTH_ACTIVE_ORG_KEY);
    }
  } catch {
    /* localStorage unavailable (Safari private, SSR, etc.) — ignore */
  }
}

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
  const [organizationsFetched, setOrganizationsFetched] = useState(false);

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
      setOrganizationsFetched(true);
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
      // Mirror cookie session → localStorage so `@object-ui/auth`'s
      // Bearer-based AuthProvider (used by Console) doesn't see a stale
      // token from a previous user.
      syncObjectUiAuthStorage(u ? s : null);
    } catch (err) {
      setError(err as Error);
      setUser(null);
      setSession(null);
      syncObjectUiAuthStorage(null);
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
      setOrganizationsFetched(false);
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
      setOrganizationsFetched(false);
      // Clear `@object-ui/auth`'s localStorage so the Console SPA doesn't
      // carry a Bearer token across the sign-out boundary.
      syncObjectUiAuthStorage(null);
    }
  }, [client]);

  const setActiveOrganization = useCallback(
    async (organizationId: string) => {
      if (!client?.organizations) return;
      await client.organizations.setActive(organizationId);
      await refresh();
      // `refresh()` already syncs storage with the new session's active
      // org; this is just belt-and-braces in case `client.auth.me()` is
      // momentarily stale.
      try {
        localStorage.setItem(OBJECT_UI_AUTH_ACTIVE_ORG_KEY, organizationId);
      } catch {
        /* ignore */
      }
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
      organizationsFetched,
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
      organizationsFetched,
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
 * Hook: update an organization (owner/admin only — server-side enforced).
 *
 * Wraps `client.organizations.update(id, data)` (`POST /api/v1/auth/organization/update`).
 * On success the local organization list and session are refreshed so the
 * top-bar switcher and the active org snapshot reflect the new name/slug.
 */
export function useUpdateOrganization() {
  const client = useClient() as any;
  const { reloadOrganizations, refresh } = useSession();
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const update = useCallback(
    async (
      organizationId: string,
      data: { name?: string; slug?: string; logo?: string; metadata?: Record<string, unknown> },
    ) => {
      if (!client?.organizations?.update) throw new Error('Client not ready');
      setUpdating(true);
      setError(null);
      try {
        const result = await client.organizations.update(organizationId, data);
        await reloadOrganizations();
        await refresh();
        return result;
      } catch (err) {
        setError(err as Error);
        throw err;
      } finally {
        setUpdating(false);
      }
    },
    [client, reloadOrganizations, refresh],
  );

  return { update, updating, error };
}

/**
 * Hook: delete an organization via better-auth.
 *
 * Wraps `client.organizations.delete(id)` (which hits
 * `POST /api/v1/auth/organization/delete`). better-auth removes the
 * organization, its members and pending invitations; server-side hooks
 * (attached to the organization plugin) tear down any projects /
 * per-project databases that belonged to the org.
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
