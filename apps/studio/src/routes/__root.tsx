// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { createRootRoute, Outlet, useLocation, useNavigate } from '@tanstack/react-router';
import { useEffect } from 'react';
import { ObjectStackProvider } from '@objectstack/client-react';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { SidebarProvider } from '@/components/ui/sidebar';
import { Toaster } from '@/components/ui/toaster';
import { AiChatPanel } from '@/components/AiChatPanel';
import { ProductionGuardProvider } from '@/components/production-guard';
import { GlobalSidebar } from '@/components/global-sidebar';
import { PluginRegistryProvider } from '../plugins';
import { builtInPlugins } from '../plugins/built-in';
import { useObjectStackClient } from '../hooks/useObjectStackClient';
import { SessionProvider, useSession } from '../hooks/useSession';

/** Routes that don't require authentication. */
const PUBLIC_ROUTES = new Set(['/login', '/register']);

/**
 * Returns true when the current route should render the GlobalSidebar
 * (the top-level nav shell) rather than the package-scoped AppSidebar.
 *
 * Package-scoped routes (`/$package/*` and `/environments/:id/:package/*`)
 * have their own AppSidebar injected by their layout component, so the
 * GlobalSidebar must be suppressed there to avoid rendering two sidebars.
 */
function isGlobalShellPath(pathname: string): boolean {
  if (PUBLIC_ROUTES.has(pathname)) return false;
  // Once the user drills into a package under an environment
  // (`/environments/:envId/:package/*` where :package is NOT the reserved
  // `packages` segment), the package-scoped AppSidebar takes over.
  if (/^\/environments\/[^/]+\/(?!packages(?:\/|$))[^/]+/.test(pathname)) {
    return false;
  }
  // /environments (list), /environments/:envId (overview), and
  // /environments/:envId/packages (package management) all keep GlobalSidebar.
  const globalPrefixes = ['/orgs', '/environments', '/packages', '/api-console'];
  if (pathname === '/') return true;
  return globalPrefixes.some(
    (p) => pathname === p || pathname.startsWith(p + '/'),
  );
}

/**
 * Routes where an environment selection is NOT required.
 * Everything under /environments (list + detail), org mgmt, auth pages.
 */
function isEnvExemptPath(pathname: string): boolean {
  return (
    pathname === '/' ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/register') ||
    pathname.startsWith('/orgs') ||
    pathname.startsWith('/environments') ||
    pathname === '/api-console' ||
    pathname.startsWith('/api-console/')
  );
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const isPublic = PUBLIC_ROUTES.has(location.pathname);

  // Redirect to environment picker when the user hits a route that requires
  // an environment context (e.g. /$package/*) but isn't already under /environments.
  useEffect(() => {
    if (loading || !user) return;
    if (!isEnvExemptPath(location.pathname)) {
      navigate({ to: '/environments' });
    }
  }, [user, loading, location.pathname, navigate]);

  useEffect(() => {
    if (loading) return;
    if (!user && !isPublic) {
      navigate({ to: '/login' });
    }
  }, [user, loading, isPublic, navigate]);

  if (loading && !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
      </div>
    );
  }

  if (!user && !isPublic) {
    return null;
  }

  // On global shell paths (non-package routes), render the GlobalSidebar
  // alongside children. Package-scoped routes keep rendering their own
  // AppSidebar from within their layout component.
  if (user && isGlobalShellPath(location.pathname)) {
    return (
      <>
        <GlobalSidebar />
        {children}
      </>
    );
  }

  return <>{children}</>;
}

function RootComponent() {
  const client = useObjectStackClient();

  if (!client) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center space-y-2">
          <div className="h-8 w-8 mx-auto animate-spin rounded-full border-4 border-muted border-t-primary" />
          <p className="text-sm text-muted-foreground">Connecting to ObjectStack…</p>
        </div>
      </div>
    );
  }

  return (
    <ObjectStackProvider client={client}>
      <SessionProvider>
        <PluginRegistryProvider plugins={builtInPlugins}>
          <ErrorBoundary>
            <SidebarProvider>
              <ProductionGuardProvider>
                <RequireAuth>
                  <Outlet />
                </RequireAuth>
                <Toaster />
                <AiChatPanel />
              </ProductionGuardProvider>
            </SidebarProvider>
          </ErrorBoundary>
        </PluginRegistryProvider>
      </SessionProvider>
    </ObjectStackProvider>
  );
}

export const Route = createRootRoute({
  component: RootComponent,
});
