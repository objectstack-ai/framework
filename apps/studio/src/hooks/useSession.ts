// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Session hook for Studio.
 *
 * Wraps `client.auth.me()` (=> `GET /api/v1/auth/get-session`) to expose
 * "who is signed in" + a logout entry point. Studio defers actual login
 * to `apps/account`; if the session call returns no user, the layout
 * bounces the browser to the Account login page.
 *
 * Organization / project / multi-tenant state lived on this hook in
 * previous versions and was removed when Studio collapsed onto a single
 * unscoped backend. The session response's `activeOrganizationId` is
 * still surfaced so plugins that care can read it, but Studio does no
 * org switching itself.
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
  /**
   * Derived role from better-auth `customSession` (see
   * `packages/plugins/plugin-auth/src/auth-manager.ts`). Set to `'admin'`
   * when the user is a platform admin or an admin/owner of the active
   * organization. Studio uses this to gate access — only admins are
   * permitted past the shell.
   */
  role?: string;
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
}

const SessionContext = createContext<SessionState | null>(null);

function normaliseSessionResponse(raw: any): {
  user: SessionUser | null;
  session: SessionData | null;
} {
  if (!raw) return { user: null, session: null };
  const payload = raw.data !== undefined ? raw.data : raw;
  if (!payload) return { user: null, session: null };
  return { user: payload.user ?? null, session: payload.session ?? null };
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const client = useClient() as any;
  const [user, setUser] = useState<SessionUser | null>(null);
  const [session, setSession] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

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

  const logout = useCallback(async () => {
    if (!client?.auth) return;
    try {
      await client.auth.logout();
    } finally {
      setUser(null);
      setSession(null);
    }
  }, [client]);

  const value = useMemo<SessionState>(
    () => ({ user, session, loading, error, refresh, logout }),
    [user, session, loading, error, refresh, logout],
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
 * @deprecated Studio no longer scopes by organization. Returns `undefined`.
 */
export function useActiveOrganizationId(): string | undefined {
  const { session } = useSession();
  return session?.activeOrganizationId ?? undefined;
}
