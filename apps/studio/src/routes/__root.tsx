// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { createRootRoute, Outlet, useLocation, useNavigate, useParams } from '@tanstack/react-router';
import { useEffect, useMemo } from 'react';
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
import { useEnvAwarePackages } from '../hooks/useProjectAwarePackages';
import type { InstalledPackage } from '@objectstack/spec/kernel';

/** Routes that don't require authentication. */
const PUBLIC_ROUTES = new Set(['/login', '/register']);

/**
 * Routes where an environment selection is NOT required.
 * Everything under /projects (list + detail), org mgmt, auth pages.
 */
function isEnvExemptPath(pathname: string): boolean {
  return (
    pathname === '/' ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/register') ||
    pathname.startsWith('/orgs') ||
    pathname.startsWith('/projects') ||
    pathname === '/api-console' ||
    pathname.startsWith('/api-console/')
  );
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams({ strict: false }) as { projectId?: string; package?: string };
  const isPublic = PUBLIC_ROUTES.has(location.pathname);

  // Get packages for TopBar PackageSwitcher
  const { packages, selectedPackage, setSelectedPackage } =
    useEnvAwarePackages(params.projectId);

  // Extract the $package segment from the URL
  const activePackageId = useMemo(() => {
    if (!params.package) return undefined;
    // Reserved segments that are NOT package ids
    if (params.package === 'packages') return undefined;
    return params.package;
  }, [params.package]);

  // Sync selectedPackage with URL
  useEffect(() => {
    if (!activePackageId) {
      if (selectedPackage) setSelectedPackage(null);
      return;
    }
    if (!packages.length) return;
    const pkg = packages.find(
      (p) =>
        p.manifest?.id === activePackageId ||
        p.manifest?.id?.endsWith('.' + activePackageId),
    );
    if (pkg && pkg !== selectedPackage) setSelectedPackage(pkg);
  }, [activePackageId, packages, selectedPackage, setSelectedPackage]);

  const handleSelectPackage = (pkg: InstalledPackage) => {
    const nextId = pkg.manifest?.id;
    if (!nextId) return;
    if (params.projectId) {
      navigate({
        to: '/projects/$projectId/$package',
        params: { projectId: params.projectId, package: nextId },
      });
    }
  };

  // Redirect to environment picker when the user hits a route that requires
  // an environment context (e.g. /$package/*) but isn't already under /projects.
  useEffect(() => {
    if (loading || !user) return;
    if (!isEnvExemptPath(location.pathname)) {
      navigate({ to: '/projects' });
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
      <div className="flex min-h-screen w-full flex-1 items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
      </div>
    );
  }

  if (!user && !isPublic) {
    return null;
  }

  // Authenticated layout with TopBar + Content
  if (user) {
    return (
      <SidebarProvider>
        <div className="flex min-h-screen w-full flex-col">
          <TopBar
            packages={packages}
            selectedPackage={selectedPackage}
            onSelectPackage={handleSelectPackage}
          />
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
