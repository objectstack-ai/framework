// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * /projects/$projectId — project-scoped layout.
 *
 * Responsibilities:
 *  - Bind the URL `projectId` to the ObjectStackClient via
 *    {@link useProjectDetail}, causing every downstream API request to
 *    carry the `X-Project-Id` header.
 *  - Render the package-scoped {@link AppSidebar} (metadata tree) for ALL
 *    routes under `/projects/:projectId/*` EXCEPT `/packages` (the package
 *    management page), where the sidebar would compete with the page content.
 *  - When no package is selected (URL has no `:package` segment), AppSidebar
 *    renders project-wide metadata by passing `packageId: undefined` to
 *    `client.meta.getItems`.
 *  - Redirect back to `/projects` when the project cannot be loaded.
 */

import {
  createFileRoute,
  Outlet,
  useLocation,
  useNavigate,
  useParams,
} from '@tanstack/react-router';
import { useCallback, useEffect, useMemo } from 'react';
import type { InstalledPackage } from '@objectstack/spec/kernel';
import { useProjectDetail } from '@/hooks/useProjects';
import { useSession } from '@/hooks/useSession';
import { useRegisterActiveProject } from '@/components/production-guard';
import { toast } from '@/hooks/use-toast';
import { AppSidebar } from '@/components/app-sidebar';
import { useEnvAwarePackages } from '@/hooks/useProjectAwarePackages';

function ProjectLayoutComponent() {
  const { projectId } = useParams({
    from: '/projects/$projectId',
  });
  const { detail, error } = useProjectDetail(projectId);
  const registerActiveProject = useRegisterActiveProject();
  const { session, setActiveOrganization } = useSession();
  const navigate = useNavigate();
  const location = useLocation();

  const { packages, selectedPackage, setSelectedPackage } =
    useEnvAwarePackages(projectId);

  // Extract the $package segment from the URL when the user is on a
  // package-scoped child route. This lets the sidebar highlight the
  // current package without requiring the child route to own the sidebar.
  const activePackageId = useMemo(() => {
    const m = location.pathname.match(
      /^\/projects\/[^/]+\/([^/]+)(?:\/|$)/,
    );
    if (!m) return undefined;
    const seg = m[1];
    // Reserved child segments that are NOT package ids.
    if (seg === 'packages') return undefined;
    return seg;
  }, [location.pathname]);

  // Sync selectedPackage with URL.
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

  // Sync active organization: if the project belongs to a different org than
  // the current session's active org, switch automatically so that all
  // org-scoped API calls (project list, member list, etc.) use the right org.
  useEffect(() => {
    const projectOrgId = detail?.project?.organization_id;
    if (!projectOrgId) return;
    if (session?.activeOrganizationId === projectOrgId) return;
    setActiveOrganization(projectOrgId);
  }, [detail?.project?.organization_id, session?.activeOrganizationId, setActiveOrganization]);

  const handleSelectPackage = useCallback(
    (pkg: InstalledPackage) => {
      const nextId = pkg.manifest?.id;
      if (!nextId) return;
      navigate({
        to: '/projects/$projectId/$package',
        params: { projectId, package: nextId },
      });
    },
    [navigate, projectId],
  );

  // Publish the active project to the production guard so that any
  // descendant component can call useProductionGuard().confirm() and have
  // the dialog know which project it's protecting.
  useEffect(() => {
    registerActiveProject({
      projectType: undefined,
      display_name: detail?.project?.display_name,
    });
    return () => registerActiveProject({ projectType: undefined });
  }, [detail, registerActiveProject]);

  // Persist last-used project so legacy /$package/* redirects can restore context.
  useEffect(() => {
    if (projectId) localStorage.setItem('objectstack.lastProjectId', projectId);
  }, [projectId]);

  useEffect(() => {
    if (error) {
      toast({
        title: 'Project not available',
        description: error.message,
        variant: 'destructive',
      });
      navigate({ to: '/projects' });
    }
  }, [error, navigate]);

  // Reserved child segments that do NOT get the metadata AppSidebar.
  // /packages is the package-management surface; rendering the tree there
  // would compete with the page's own content. Everything else — overview
  // and the package workspace — shows the sidebar.
  const hideSidebar = location.pathname.endsWith(`/projects/${projectId}/packages`);

  return (
    <>
      {!hideSidebar && (
        <AppSidebar
          packages={packages}
          selectedPackage={selectedPackage}
          onSelectPackage={handleSelectPackage}
          projectId={projectId}
        />
      )}
      <Outlet />
    </>
  );
}

export const Route = createFileRoute('/projects/$projectId')({
  component: ProjectLayoutComponent,
});
