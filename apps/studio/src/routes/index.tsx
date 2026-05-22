// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect } from 'react';
import { useSession } from '@/hooks/useSession';
import { usePackages } from '@/hooks/usePackages';

/**
 * Landing route. Studio assumes a signed-in user and at least one
 * installed package. We redirect to the first package's workspace so the
 * sidebar and breadcrumbs land on a known state. If no packages are
 * installed, we stay on this page and tell the user to install one.
 */
function IndexLanding() {
  const navigate = useNavigate();
  const { user, loading: sessionLoading } = useSession();
  const { packages, loading: packagesLoading } = usePackages();

  useEffect(() => {
    if (sessionLoading) return;
    if (!user) return;
    if (packagesLoading) return;
    const first = packages[0];
    if (first?.manifest?.id) {
      navigate({
        to: '/$package',
        params: { package: first.manifest.id },
        replace: true,
      });
    }
  }, [user, sessionLoading, packages, packagesLoading, navigate]);

  if (sessionLoading || packagesLoading) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
      </div>
    );
  }

  if (!packages.length) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-background p-8">
        <div className="max-w-md space-y-3 text-center">
          <h1 className="text-lg font-semibold">No packages installed</h1>
          <p className="text-sm text-muted-foreground">
            Studio browses metadata from packages installed on the connected
            backend. Install a package (for example an app or a built-in
            module) and refresh this page.
          </p>
        </div>
      </div>
    );
  }

  return null;
}

export const Route = createFileRoute('/')({ component: IndexLanding });
