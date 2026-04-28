// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { createRootRoute, Outlet, useLocation, useNavigate } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';
import { ObjectStackProvider } from '@objectstack/client-react';
import { ObjectStackClient } from '@objectstack/client';
import { Toaster } from '@/components/ui/toaster';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { TopBar } from '@/components/top-bar';
import { AccountSidebar } from '@/components/account-sidebar';
import { SessionProvider, useSession } from '@/hooks/useSession';
import { getApiBaseUrl } from '@/lib/config';

/** Routes that don't require authentication. */
const PUBLIC_ROUTES = new Set([
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
  '/auth/device',
  '/setup',
]);

function isPublic(pathname: string): boolean {
  return PUBLIC_ROUTES.has(pathname) || pathname.startsWith('/accept-invitation/');
}

/**
 * Probes `/api/v1/auth/bootstrap-status` once per app load. Returns:
 * - `null` while loading
 * - `true` if at least one user exists (normal mode)
 * - `false` if the database is empty (first-run setup required)
 *
 * On any error we assume `true` so the SPA falls through to its normal
 * login flow rather than hijacking the user with a setup screen.
 */
function useBootstrapStatus(): boolean | null {
  const [hasOwner, setHasOwner] = useState<boolean | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/v1/auth/bootstrap-status');
        if (!res.ok) {
          if (!cancelled) setHasOwner(true);
          return;
        }
        const data = await res.json() as { hasOwner?: boolean };
        if (!cancelled) setHasOwner(data.hasOwner !== false);
      } catch {
        if (!cancelled) setHasOwner(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);
  return hasOwner;
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const pub = isPublic(location.pathname);
  const fullscreenAuthed = location.pathname.startsWith('/oauth/');
  const hasOwner = useBootstrapStatus();
  const onSetup = location.pathname === '/setup';

  // First-run redirect: if there's no owner yet, force /setup. This runs
  // before the auth check below so the user isn't bounced to /login first.
  useEffect(() => {
    if (hasOwner === false && !onSetup && !user) {
      navigate({ to: '/setup', replace: true });
    }
  }, [hasOwner, onSetup, user, navigate]);

  // If the database has been bootstrapped, the /setup page should redirect
  // unauthenticated visitors back to /login (handled inside the page itself).
  useEffect(() => {
    if (loading) return;
    if (hasOwner === false) return; // setup flow takes precedence
    if (!user && !pub) {
      navigate({
        to: '/login',
        search: { redirect: location.pathname + location.searchStr },
        replace: true,
      });
    }
  }, [user, loading, pub, navigate, location.pathname, location.searchStr, hasOwner]);

  if (hasOwner === null || (loading && !user)) {
    return (
      <div className="flex min-h-screen w-full flex-1 items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
      </div>
    );
  }

  if (hasOwner === false && !onSetup) {
    return null;
  }

  if (!user && !pub) {
    return null;
  }

  // Public routes (login/register/etc.) and authed flow pages (/oauth/*)
  // render fullscreen without chrome.
  if (pub || fullscreenAuthed) {
    return <div className="flex min-h-screen w-full">{children}</div>;
  }

  // Authenticated layout: TopBar across the top, Sidebar + main below.
  return (
    <SidebarProvider className="flex h-svh w-full flex-col">
      <TopBar />
      <div className="flex min-h-0 flex-1 w-full">
        <AccountSidebar />
        <SidebarInset className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <main className="flex min-h-0 flex-1 flex-col overflow-auto bg-background">
            {children}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}

function RootComponent() {
  const baseUrl = getApiBaseUrl();
  const client = useMemo(() => new ObjectStackClient({ baseUrl }), [baseUrl]);

  return (
    <ObjectStackProvider client={client}>
      <SessionProvider>
        <RequireAuth>
          <Outlet />
        </RequireAuth>
        <Toaster />
      </SessionProvider>
    </ObjectStackProvider>
  );
}

export const Route = createRootRoute({
  component: RootComponent,
});
