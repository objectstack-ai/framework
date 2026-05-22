// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { createRootRoute, Outlet } from '@tanstack/react-router';
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
import { gotoAccountLogin } from '@/lib/auth-redirect';

/**
 * Single-tenant Studio shell. Login is delegated to apps/account; if the
 * session call comes back empty we bounce there. There is no per-project
 * routing, no organization switch, no public-route exemption — Studio is
 * purely a metadata browser + runtime debugger on top of one backend.
 */
function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useSession();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      gotoAccountLogin(window.location.pathname + window.location.search);
    }
  }, [user, loading]);

  if (loading) {
    return (
      <div className="flex min-h-screen w-full flex-1 items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full flex-col">
        <TopBar />
        <div className="flex flex-1 w-full overflow-hidden">
          <main className="flex flex-1 min-w-0 overflow-hidden">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
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

export const Route = createRootRoute({ component: RootComponent });
