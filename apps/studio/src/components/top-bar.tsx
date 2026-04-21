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

import { useLocation, useParams } from '@tanstack/react-router';
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
import { Cpu, Search } from 'lucide-react';
import { config } from '@/lib/config';
import { ProjectSwitcher } from '@/components/project-switcher';
import { OrganizationSwitcher } from '@/components/organization-switcher';
import { UserMenu } from '@/components/user-menu';
import { PackageSwitcher } from '@/components/package-switcher';
import type { InstalledPackage } from '@objectstack/spec/kernel';

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

interface TopBarProps {
  /** List of installed packages for the PackageSwitcher dropdown */
  packages?: InstalledPackage[];
  /** Currently selected package */
  selectedPackage?: InstalledPackage | null;
  /** Callback when a package is selected from the dropdown */
  onSelectPackage?: (pkg: InstalledPackage) => void;
}

export function TopBar({
  packages = [],
  selectedPackage = null,
  onSelectPackage = () => {},
}: TopBarProps) {
  const location = useLocation();
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
    if (pathname === '/orgs' || pathname === '/orgs/new' || params.orgId) return 'orgs';
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
          items.push({ label: 'Organizations', href: '/orgs' });
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
        if (selectedPackage?.manifest?.name) {
          items.push({ label: selectedPackage.manifest.name });
        }
        items.push({ label: 'Overview' });
        break;
      case 'object':
        if (selectedPackage?.manifest?.name) {
          items.push({ label: selectedPackage.manifest.name });
        }
        items.push({ label: 'Objects' });
        if (params.name) {
          items.push({ label: params.name });
        }
        break;
      case 'metadata':
        if (selectedPackage?.manifest?.name) {
          items.push({ label: selectedPackage.manifest.name });
        }
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
  }, [viewType, params, selectedPackage]);

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

  // Show PackageSwitcher only when we're in a package context
  const showPackageSwitcher = params.package && packages.length > 0;

  return (
    <header className="flex h-12 shrink-0 items-center justify-between gap-2 border-b px-4">
      {/* Left segment: Org + Env + Package switchers */}
      <div className="flex items-center gap-2">
        <OrganizationSwitcher />
        <Separator orientation="vertical" className="mx-1 h-4" />
        <ProjectSwitcher />
        {showPackageSwitcher && (
          <>
            <Separator orientation="vertical" className="mx-1 h-4" />
            <PackageSwitcher
              packages={packages}
              selectedPackage={selectedPackage}
              onSelectPackage={onSelectPackage}
            />
          </>
        )}
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

      {/* Right segment: Search + Mode + Theme + User */}
      <div className="flex items-center gap-2">
        {/* Global search placeholder */}
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

        {/* API Badge */}
        {apiBadge && (
          <Badge variant="outline" className="font-mono text-[10px] gap-1 hidden sm:flex">
            {apiBadge}
          </Badge>
        )}

        {/* Mode Badge */}
        <Badge variant="secondary" className="text-[10px] gap-1 font-mono">
          <Cpu className="h-2.5 w-2.5" />
          {config.mode.toUpperCase()}
        </Badge>

        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  );
}
