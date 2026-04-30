// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { createRootRoute, Outlet, useLocation, useNavigate } from '@tanstack/react-router';
import { useEffect } from 'react';
import { ObjectStackProvider } from '@objectstack/client-react';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { SidebarProvider } from '@/components/ui/sidebar';
import { Toaster } from '@/components/ui/toaster';
import { AiChatPanel } from '@/components/AiChatPanel';
import { ProductionGuardProvider } from '@/components/production-guard';
import { TopBar } from '@/components/top-bar';
import { PluginRegistryProvider } from '../plugins';
import { builtInPlugins } from '../plugins/built-in';
import { useObjectStackClient } from '../hooks/useObjectStackClient';
import { SessionProvider, useSession } from '../hooks/useSession';
import { config } from '@/lib/config';
import { gotoAccountLogin } from '@/lib/auth-redirect';
import { PLATFORM_PROJECT_ID } from '@/lib/platform-project';

/** Routes that don't require authentication. */
const PUBLIC_ROUTES = new Set(['/login', '/register', '/forgot-password', '/auth/device']);

/**
 * Paths that exist only in multi-project mode — login, registration, the
 * org list, and the project chooser. In single-project mode these routes
 * still exist as files (so the route tree is identical across modes), but
 * hitting them redirects to the default project workspace.
 */
function isMultiProjectOnlyPath(pathname: string): boolean {
  return (
    pathname === '/login' ||
    pathname.startsWith('/login/') ||
    pathname === '/register' ||
    pathname.startsWith('/register/') ||
    pathname === '/forgot-password' ||
    pathname === '/organizations' ||
    pathname.startsWith('/organizations/') ||
    pathname === '/projects'
  );
}

/**
 * Routes where an environment selection is NOT required.
 * Everything under /projects (list + detail), org mgmt, auth pages.
 */
function isEnvExemptPath(pathname: string): boolean {
  return (
    pathname === '/' ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/register') ||
    pathname.startsWith('/organizations') ||
    pathname.startsWith('/projects') ||
    pathname.startsWith('/auth/') ||
    pathname === '/api-console' ||
    pathname.startsWith('/api-console/')
  );
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const isPublic = PUBLIC_ROUTES.has(location.pathname);

  // In single-project mode, collapse every multi-project-only entry
  // (`/login`, `/organizations`, `/projects`) onto the platform metadata
  // workspace so the user never sees the org/project funnel.
  useEffect(() => {
    if (!config.singleProject) return;
    if (isMultiProjectOnlyPath(location.pathname)) {
      navigate({
        to: '/projects/$projectId',
        params: { projectId: PLATFORM_PROJECT_ID },
        replace: true,
      });
    }
  }, [location.pathname, navigate]);

  // Redirect to environment picker when the user hits a route that requires
  // an environment context (e.g. /$package/*) but isn't already under /projects.
  useEffect(() => {
    if (config.singleProject) return; // handled by the branch above
    if (loading || !user) return;
    if (!isEnvExemptPath(location.pathname)) {
      navigate({ to: '/projects' });
    }
  }, [user, loading, location.pathname, navigate]);

  useEffect(() => {
    if (loading) return;
    if (!user && !isPublic) {
      // Use the raw browser path (includes the `/_studio` base) so
      // Account can bounce the user back to the exact same Studio URL.
      gotoAccountLogin(window.location.pathname + window.location.search);
    }
  }, [user, loading, isPublic, location.pathname, location.searchStr]);

  if (loading && !user) {
    return (
      <div className="flex min-h-screen w-full flex-1 items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
      </div>
    );
  }

  if (!user && !isPublic) {
    return null;
  }

  // Authenticated layout with TopBar + Content.
  if (user) {
    return (
      <SidebarProvider>
        <div className="flex min-h-screen w-full flex-col">
          <TopBar />
          <div className="flex flex-1 w-full overflow-hidden">
            <main className="flex flex-1 min-w-0 overflow-hidden">
              {children}
            </main>
          </div>
        </div>
      </SidebarProvider>
    );
  }

  return <div className="flex min-h-screen w-full">{children}</div>;
}

function AuthedAiChatPanel() {
  const { user } = useSession();
  if (!user) return null;
  return <AiChatPanel />;
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
            <ProductionGuardProvider>
              <RequireAuth>
                <Outlet />
              </RequireAuth>
              <Toaster />
              <AuthedAiChatPanel />
            </ProductionGuardProvider>
          </ErrorBoundary>
        </PluginRegistryProvider>
      </SessionProvider>
    </ObjectStackProvider>
  );
}

export const Route = createRootRoute({
  component: RootComponent,
});
