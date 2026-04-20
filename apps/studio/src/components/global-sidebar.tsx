// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * GlobalSidebar
 *
 * Top-level navigation shell rendered on routes that are NOT scoped to a
 * specific package — i.e. the home page, organization management, the
 * environments list, an environment's overview page, and the per-environment
 * packages management page.
 *
 * The sidebar deliberately exposes only two navigation entries:
 *
 *   1. **Environments** — links to `/environments` (browse / pick an env).
 *   2. **Packages** — links to `/environments/:envId/packages`. Disabled
 *      until the user has selected an environment.
 *
 * Once the user drills into a specific package
 * (`/environments/:envId/:package/*`), the package-scoped {@link AppSidebar}
 * takes over instead. The two sidebars are mutually exclusive and share the
 * same `SidebarProvider` in `routes/__root.tsx`.
 */

import { useMemo } from 'react';
import { Link, useLocation } from '@tanstack/react-router';
import {
  Building2,
  Check,
  ChevronsUpDown,
  Plus,
  Boxes,
  Globe,
  Package as PackageIcon,
  Settings,
} from 'lucide-react';

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from '@/components/ui/sidebar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useOrganizations, useSession } from '@/hooks/useSession';
import { toast } from '@/hooks/use-toast';

/** Header: active organization + switcher. */
function OrgHeader() {
  const { organizations, loading, reload } = useOrganizations();
  const { session, setActiveOrganization } = useSession();
  const activeId = session?.activeOrganizationId ?? undefined;
  const active = useMemo(
    () => organizations.find((o) => o.id === activeId) ?? null,
    [organizations, activeId],
  );

  const handleSelect = async (id: string) => {
    if (id === activeId) return;
    try {
      await setActiveOrganization(id);
      await reload();
      toast({ title: 'Organization switched' });
    } catch (err) {
      toast({
        title: 'Failed to switch organization',
        description: (err as Error).message,
        variant: 'destructive',
      });
    }
  };

  return (
    <SidebarHeader className="border-b">
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton
                size="lg"
                className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
              >
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <Building2 className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">
                    {active?.name ?? (loading ? 'Loading…' : 'Select organization')}
                  </span>
                  {active?.slug && (
                    <span className="truncate text-xs text-muted-foreground">
                      {active.slug}
                    </span>
                  )}
                </div>
                <ChevronsUpDown className="ml-auto size-4 opacity-60" />
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="w-[--radix-dropdown-menu-trigger-width] min-w-56"
              align="start"
              side="bottom"
              sideOffset={4}
            >
              <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Organizations
              </DropdownMenuLabel>
              {organizations.map((org) => (
                <DropdownMenuItem
                  key={org.id}
                  onSelect={(e) => {
                    e.preventDefault();
                    handleSelect(org.id);
                  }}
                  className="gap-2"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{org.name}</div>
                    {org.slug && (
                      <code className="font-mono text-[11px] text-muted-foreground">
                        {org.slug}
                      </code>
                    )}
                  </div>
                  {org.id === activeId && (
                    <Check className="size-3.5 text-primary" />
                  )}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/orgs/new" className="gap-2">
                  <Plus className="size-3.5" />
                  New organization…
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/orgs" className="gap-2 text-muted-foreground">
                  Manage organizations
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarHeader>
  );
}

/**
 * Extract the `:envId` segment from the current pathname when the user is
 * anywhere under `/environments/:envId(...)`. Returns undefined on the
 * environments list page (`/environments`) or any non-environment route.
 */
function useActiveEnvironmentId(): string | undefined {
  const location = useLocation();
  return useMemo(() => {
    const m = location.pathname.match(/^\/environments\/([^/]+)/);
    return m?.[1];
  }, [location.pathname]);
}

export function GlobalSidebar() {
  const location = useLocation();
  const pathname = location.pathname;
  const { session } = useSession();
  const activeOrgId = session?.activeOrganizationId ?? undefined;
  const envId = useActiveEnvironmentId();

  const envsActive = pathname === '/environments';
  const packagesHref = envId ? `/environments/${envId}/packages` : undefined;
  const packagesActive = !!packagesHref && pathname === packagesHref;
  const apiConsoleActive = pathname === '/api-console';

  return (
    <Sidebar collapsible="icon">
      <OrgHeader />
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {/* Environments — single-row entry, no expansion. */}
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={envsActive} tooltip="Environments">
                  <Link to="/environments">
                    <Boxes className="size-4" />
                    <span>Environments</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {/* Packages — single-row entry. Depends on a selected environment;
                  disabled and tooltipped when none is selected. */}
              <SidebarMenuItem>
                {envId ? (
                  <SidebarMenuButton
                    asChild
                    isActive={packagesActive}
                    tooltip="Packages"
                  >
                    <Link
                      to="/environments/$environmentId/packages"
                      params={{ environmentId: envId }}
                    >
                      <PackageIcon className="size-4" />
                      <span>Packages</span>
                    </Link>
                  </SidebarMenuButton>
                ) : (
                  <SidebarMenuButton
                    disabled
                    aria-disabled="true"
                    tooltip="Select an environment first"
                    className="cursor-not-allowed opacity-50"
                  >
                    <PackageIcon className="size-4" />
                    <span>Packages</span>
                  </SidebarMenuButton>
                )}
              </SidebarMenuItem>

              {/* API Console — always available; the console discovers
                  endpoints dynamically from the active client/environment. */}
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
    </Sidebar>
  );
}
