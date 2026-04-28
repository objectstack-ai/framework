// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * TopBar
 *
 * Global chrome component in Supabase style.
 * Renders at the top of authenticated Studio layouts with:
 * - Left segment: OrganizationSwitcher + ProjectSwitcher + PackageSwitcher
 * - Center segment: SidebarTrigger + dynamic breadcrumbs (inferred from URL)
 * - Right segment: Global search placeholder, mode badge, ThemeToggle, UserMenu
 */

import { Link, useLocation, useParams } from '@tanstack/react-router';
import { useMemo } from 'react';
import { Separator } from '@/components/ui/separator';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { ThemeToggle } from '@/components/theme-toggle';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Boxes, Cpu, Search } from 'lucide-react';
import { config } from '@/lib/config';
import { ProjectSwitcher } from '@/components/project-switcher';
import { OrganizationSwitcher } from '@/components/organization-switcher';
import { UserMenu } from '@/components/user-menu';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { useActiveOrganizationId } from '@/hooks/useSession';

const META_TYPE_LABELS: Record<string, string> = {
  action: 'Actions',
  dashboard: 'Dashboards',
  report: 'Reports',
  flow: 'Flows',
  agent: 'Agents',
  api: 'APIs',
  ragPipeline: 'RAG Pipelines',
  profile: 'Profiles',
  sharingRule: 'Sharing Rules',
  data: 'Seed Data',
  view: 'Views',
  app: 'Apps',
  tool: 'Tools',
  workflow: 'Workflows',
  approval: 'Approvals',
  webhook: 'Webhooks',
  role: 'Roles',
  permission: 'Permissions',
  policy: 'Policies',
  connector: 'Connectors',
  object: 'Objects',
  hook: 'Hooks',
  mapping: 'Mappings',
  analyticsCube: 'Analytics Cubes',
  page: 'Pages',
  theme: 'Themes',
};

function StudioBrand() {
  return (
    <Link to="/" className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground hover:opacity-90">
      <Boxes className="h-4 w-4" />
    </Link>
  );
}

function SlashDivider() {
  return <span aria-hidden className="text-muted-foreground/50 select-none">/</span>;
}

export function TopBar() {
  const location = useLocation();
  const activeOrgId = useActiveOrganizationId();
  const params = useParams({ strict: false }) as {
    package?: string;
    projectId?: string;
    name?: string;
    type?: string;
    orgId?: string;
  };

  // Infer view type from pathname
  const viewType = useMemo(() => {
    const pathname = location.pathname;

    if (pathname === '/') return 'home';
    if (pathname === '/api-console' || pathname.startsWith('/api-console/')) return 'api-console';
    if (pathname === '/projects') return 'projects';
    if (pathname === '/organizations' || pathname === '/organizations/new' || params.orgId) return 'orgs';
    if (params.projectId && pathname.includes('/packages')) return 'packages';
    if (params.projectId && !params.package) return 'project-overview';
    if (params.package && params.name && !params.type) return 'object';
    if (params.package && params.type && params.name) return 'metadata';
    if (params.package && !params.name && !params.type) return 'package-overview';

    return 'default';
  }, [location.pathname, params]);

  // Compute breadcrumb items based on current route
  const breadcrumbs = useMemo(() => {
    const items: Array<{ label: string; href?: string }> = [];

    switch (viewType) {
      case 'home':
        items.push({ label: 'Home' });
        break;
      case 'api-console':
        items.push({ label: 'API Console' });
        break;
      case 'projects':
        items.push({ label: 'Projects' });
        break;
      case 'orgs':
        if (params.orgId) {
          items.push({ label: 'Organizations', href: '/organizations' });
          items.push({ label: 'Settings' });
        } else {
          items.push({ label: 'Organizations' });
        }
        break;
      case 'packages':
        items.push({ label: 'Package Manager' });
        break;
      case 'project-overview':
        items.push({ label: 'Overview' });
        break;
      case 'package-overview':
        items.push({ label: 'Overview' });
        break;
      case 'object':
        items.push({ label: 'Objects' });
        if (params.name) {
          items.push({ label: params.name });
        }
        break;
      case 'metadata':
        if (params.type) {
          items.push({ label: META_TYPE_LABELS[params.type] || params.type });
        }
        if (params.name) {
          items.push({ label: params.name });
        }
        break;
      default:
        items.push({ label: 'Studio' });
    }

    return items;
  }, [viewType, params]);

  // Compute API badge for object/metadata views
  const apiBadge = useMemo(() => {
    if (viewType === 'object' && params.name) {
      return `/api/v1/data/${params.name}`;
    }
    if (viewType === 'metadata' && params.type && params.name) {
      return `/api/v1/meta/${params.type}/${params.name}`;
    }
    return null;
  }, [viewType, params]);

  return (
    <header className="flex h-12 shrink-0 items-center justify-between gap-2 border-b px-2 sm:px-4">
      {/* Left segment: Brand + Org + Project switchers */}
      <div className="flex items-center gap-1 sm:gap-1.5 min-w-0">
        {/* Mobile: Hamburger menu */}
        <div className="sm:hidden">
          <SidebarTrigger className="h-9 w-9" />
        </div>
        <StudioBrand />
        {!config.singleProject && <SlashDivider />}
        {!config.singleProject && (
          <div className="hidden sm:flex items-center gap-1.5">
            <OrganizationSwitcher />
            {activeOrgId && (
              <>
                <SlashDivider />
                <ProjectSwitcher />
              </>
            )}
          </div>
        )}
        {/* Mobile: Show only current page breadcrumb */}
        <div className="sm:hidden min-w-0 flex-1">
          {breadcrumbs.length > 0 && (
            <span className="text-sm font-medium truncate">
              {breadcrumbs[breadcrumbs.length - 1].label}
            </span>
          )}
        </div>
        {/* Desktop: Show full navigation */}
        <div className="hidden sm:flex items-center gap-2">
          <Separator orientation="vertical" className="mx-2 h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              {breadcrumbs.map((item, index) => (
                <div key={index} className="flex items-center">
                  {index > 0 && <BreadcrumbSeparator />}
                  <BreadcrumbItem className={index === 0 ? 'hidden md:block' : ''}>
                    {item.href ? (
                      <BreadcrumbLink href={item.href}>{item.label}</BreadcrumbLink>
                    ) : (
                      <BreadcrumbPage className="font-medium">{item.label}</BreadcrumbPage>
                    )}
                  </BreadcrumbItem>
                </div>
              ))}
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </div>

      {/* Right segment: Search + Mode + Theme + User */}
      <div className="flex items-center gap-1 sm:gap-2">
        {/* Global search placeholder - desktop only */}
        <div className="relative hidden lg:flex items-center">
          <Search className="absolute left-2.5 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search..."
            className="h-8 w-[200px] pl-8 pr-10 text-sm"
            readOnly
          />
          <kbd className="absolute right-2 pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
            <span className="text-xs">⌘</span>K
          </kbd>
        </div>

        {/* API Badge - hide on small screens */}
        {apiBadge && (
          <Badge variant="outline" className="font-mono text-[10px] gap-1 hidden sm:flex">
            {apiBadge}
          </Badge>
        )}

        {/* Mode Badge - hide on mobile */}
        <Badge variant="secondary" className="text-[10px] gap-1 font-mono hidden sm:flex">
          <Cpu className="h-2.5 w-2.5" />
          {config.mode.toUpperCase()}
        </Badge>

        <div className="hidden sm:block">
          <ThemeToggle />
        </div>
        <UserMenu />
      </div>
    </header>
  );
}
