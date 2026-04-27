// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { createRootRoute, Navigate, Outlet, useLocation, useNavigate } from '@tanstack/react-router';
import { useEffect, useMemo } from 'react';
import { ObjectStackProvider } from '@objectstack/client-react';
import { ObjectStackClient } from '@objectstack/client';
import { Toaster } from '@/components/ui/toaster';
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
]);

function isPublic(pathname: string): boolean {
  return PUBLIC_ROUTES.has(pathname) || pathname.startsWith('/accept-invitation/');
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const pub = isPublic(location.pathname);

  useEffect(() => {
    if (loading) return;
    if (!user && !pub) {
      navigate({
        to: '/login',
        search: { redirect: location.pathname + location.search },
        replace: true,
      });
    }
  }, [user, loading, pub, navigate, location.pathname, location.search]);

  if (loading && !user) {
    return (
      <div className="flex min-h-screen w-full flex-1 items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
      </div>
    );
  }

  if (!user && !pub) {
    return null;
  }

  return <>{children}</>;
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
