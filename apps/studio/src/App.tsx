// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { useState, useEffect, useCallback } from 'react';
import { ObjectStackClient } from '@objectstack/client';
import { ObjectStackProvider } from '@objectstack/client-react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AppSidebar } from "./components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { SidebarProvider } from "@/components/ui/sidebar"
import { DeveloperOverview } from './components/DeveloperOverview';
import { PackageManager } from './components/PackageManager';
import { ApiConsolePage } from './components/ApiConsolePage';
import { Toaster } from "@/components/ui/toaster"
import { AiChatPanel } from "@/components/AiChatPanel"
import { getApiBaseUrl, config } from './lib/config';
import { PluginRegistryProvider, PluginHost } from './plugins';
import { builtInPlugins } from './plugins/built-in';
import type { InstalledPackage } from '@objectstack/spec/kernel';

type ViewType = 'overview' | 'packages' | 'object' | 'metadata' | 'api-console';

export default function App() {
  const [client, setClient] = useState<ObjectStackClient | null>(null);
  const [packages, setPackages] = useState<InstalledPackage[]>([]);
  const [selectedPackage, setSelectedPackage] = useState<InstalledPackage | null>(null);
  const [selectedObject, setSelectedObject] = useState<string | null>(null);
  const [selectedMeta, setSelectedMeta] = useState<{ type: string; name: string } | null>(null);
  const [selectedView, setSelectedView] = useState<ViewType>('overview');

  // 1. Create client once
  useEffect(() => {
    const baseUrl = getApiBaseUrl();
    console.log(`[App] Connecting to API: ${baseUrl} (mode: ${config.mode})`);
    setClient(new ObjectStackClient({ baseUrl }));
  }, []);

  // 2. Fetch installed packages from the server API
  useEffect(() => {
    if (!client) return;
    let mounted = true;

    async function loadPackages() {
      try {
        const result = await client!.packages.list();
        const all: InstalledPackage[] = result?.packages || [];
        // Filter out the root dev-workspace — it's the monorepo aggregator, not a real package
        const items = all.filter((p) => p.manifest?.version !== '0.0.0' && p.manifest?.id !== 'dev-workspace');
        console.log('[App] Fetched packages:', items.map((p) => p.manifest?.name || p.manifest?.id));
        if (mounted && items.length > 0) {
          setPackages(items);
          setSelectedPackage(items[0]);
        }
      } catch (err) {
        console.error('[App] Failed to fetch packages:', err);
      }
    }

    loadPackages();
    return () => { mounted = false; };
  }, [client]);

  const handleSelectPackage = useCallback((pkg: InstalledPackage) => {
    setSelectedPackage(pkg);
    setSelectedObject(null);
    setSelectedMeta(null);
    setSelectedView('overview');
  }, []);

  const handleSelectObject = useCallback((name: string) => {
    if (name) {
      setSelectedObject(name);
      setSelectedView('object');
    } else {
      setSelectedObject(null);
      setSelectedView('overview');
    }
  }, []);

  const handleSelectView = useCallback((view: ViewType) => {
    setSelectedView(view);
    setSelectedObject(null);
    setSelectedMeta(null);
  }, []);

  const handleSelectMeta = useCallback((type: string, name: string) => {
    setSelectedMeta({ type, name });
    setSelectedObject(null);
    setSelectedView('metadata');
  }, []);

  const handleNavigate = useCallback((view: string, detail?: string) => {
    if (view === 'packages') handleSelectView('packages');
    else if (detail) handleSelectObject(detail);
  }, [handleSelectView, handleSelectObject]);

  if (!client) return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center space-y-2">
        <div className="h-8 w-8 mx-auto animate-spin rounded-full border-4 border-muted border-t-primary" />
        <p className="text-sm text-muted-foreground">Connecting to ObjectStack…</p>
      </div>
    </div>
  );

  return (
    <ObjectStackProvider client={client}>
      <PluginRegistryProvider plugins={builtInPlugins}>
      <ErrorBoundary>
      <SidebarProvider>
        <AppSidebar 
          selectedObject={selectedObject} 
          onSelectObject={handleSelectObject}
          selectedMeta={selectedMeta}
          onSelectMeta={handleSelectMeta}
          packages={packages}
          selectedPackage={selectedPackage}
          onSelectPackage={handleSelectPackage}
          onSelectView={handleSelectView}
          selectedView={selectedView}
        />
        <main className="flex min-w-0 flex-1 flex-col h-svh overflow-hidden bg-background">
          <SiteHeader
            selectedObject={selectedObject}
            selectedMeta={selectedMeta}
            selectedView={selectedView}
            packageLabel={selectedPackage?.manifest?.name || selectedPackage?.manifest?.id}
          />
          <div className="flex flex-1 flex-col overflow-hidden">
            {selectedView === 'object' && selectedObject ? (
              <PluginHost
                metadataType="object"
                metadataName={selectedObject}
                packageId={selectedPackage?.manifest?.id}
              />
            ) : selectedView === 'metadata' && selectedMeta ? (
              <PluginHost
                metadataType={selectedMeta.type}
                metadataName={selectedMeta.name}
                packageId={selectedPackage?.manifest?.id}
              />
            ) : selectedView === 'packages' ? (
              <PackageManager />
            ) : selectedView === 'api-console' ? (
              <ApiConsolePage />
            ) : (
              <DeveloperOverview
                packages={packages}
                selectedPackage={selectedPackage}
                onNavigate={handleNavigate}
              />
            )}
          </div>
        </main>
        <Toaster />
        <AiChatPanel />
      </SidebarProvider>
      </ErrorBoundary>
      </PluginRegistryProvider>
    </ObjectStackProvider>
  );
}
