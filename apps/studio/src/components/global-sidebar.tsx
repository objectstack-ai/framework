// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * GlobalSidebar
 *
 * Top-level navigation shell rendered on routes that are NOT scoped to a
 * specific package — i.e. the home page, organization management, the
 * projects list, a project's overview page, and the per-project
 * packages management page.
 *
 * The sidebar deliberately exposes only two navigation entries:
 *
 *   1. **Projects** — links to `/projects` (browse / pick a project).
 *   2. **Packages** — links to `/projects/:projectId/packages`. Disabled
 *      until the user has selected a project.
 *
 * Once the user drills into a specific package
 * (`/projects/:projectId/:package/*`), the package-scoped {@link AppSidebar}
 * takes over instead. The two sidebars are mutually exclusive and share the
 * same `SidebarProvider` in `routes/__root.tsx`.
 *
 * Organization switching is now handled in the TopBar, so this sidebar only
 * focuses on functional navigation.
 */

import { useMemo } from 'react';
import { Link, useLocation } from '@tanstack/react-router';
import {
  Boxes,
  Globe,
  Package as PackageIcon,
  Settings,
} from 'lucide-react';

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { useSession } from '@/hooks/useSession';

/**
 * Extract the `:projectId` segment from the current pathname when the user is
 * anywhere under `/projects/:projectId(...)`. Returns undefined on the
 * projects list page (`/projects`) or any non-project route.
 */
function useActiveProjectId(): string | undefined {
  const location = useLocation();
  return useMemo(() => {
    const m = location.pathname.match(/^\/projects\/([^/]+)/);
    return m?.[1];
  }, [location.pathname]);
}

export function GlobalSidebar() {
  const location = useLocation();
  const pathname = location.pathname;
  const { session } = useSession();
  const activeOrgId = session?.activeOrganizationId ?? undefined;
  const projectId = useActiveProjectId();

  const projectsActive = pathname === '/projects';
  const packagesHref = projectId ? `/projects/${projectId}/packages` : undefined;
  const packagesActive = !!packagesHref && pathname === packagesHref;
  const apiConsoleActive = pathname === '/api-console';

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {/* Projects — single-row entry, no expansion. */}
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={projectsActive} tooltip="Projects">
                  <Link to="/projects">
                    <Boxes className="size-4" />
                    <span>Projects</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {/* Packages — single-row entry. Depends on a selected project;
                  disabled and tooltipped when none is selected. */}
              <SidebarMenuItem>
                {projectId ? (
                  <SidebarMenuButton
                    asChild
                    isActive={packagesActive}
                    tooltip="Packages"
                  >
                    <Link
                      to="/projects/$projectId/packages"
                      params={{ projectId }}
                    >
                      <PackageIcon className="size-4" />
                      <span>Packages</span>
                    </Link>
                  </SidebarMenuButton>
                ) : (
                  <SidebarMenuButton
                    disabled
                    aria-disabled="true"
                    tooltip="Select a project first"
                    className="cursor-not-allowed opacity-50"
                  >
                    <PackageIcon className="size-4" />
                    <span>Packages</span>
                  </SidebarMenuButton>
                )}
              </SidebarMenuItem>

              {/* API Console — always available; the console discovers
                  endpoints dynamically from the active client/project. */}
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={apiConsoleActive} tooltip="API Console">
                  <Link to="/api-console">
                    <Globe className="size-4" />
                    <span>API Console</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={pathname === `/orgs/${activeOrgId}`}
                  tooltip="Settings"
                >
                  {activeOrgId ? (
                    <Link to="/orgs/$orgId" params={{ orgId: activeOrgId }}>
                      <Settings className="size-4" />
                      <span>Settings</span>
                    </Link>
                  ) : (
                    <Link to="/orgs">
                      <Settings className="size-4" />
                      <span>Settings</span>
                    </Link>
                  )}
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarTrigger />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
