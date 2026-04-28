// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * TopBar — global chrome rendered at the top of every authenticated Account
 * route. Mirrors the Studio TopBar layout:
 *
 *   - Left:  brand → mobile sidebar toggle → breadcrumb (inferred from URL)
 *   - Right: theme toggle + UserMenu (avatar dropdown w/ sign-out)
 */

import { Link, useLocation, useParams } from '@tanstack/react-router';
import { useMemo } from 'react';
import { UserCircle2 } from 'lucide-react';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Separator } from '@/components/ui/separator';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { ThemeToggle } from '@/components/theme-toggle';
import { UserMenu } from '@/components/user-menu';
import { OrganizationSwitcher } from '@/components/organization-switcher';

function AccountBrand() {
  return (
    <Link
      to="/account"
      className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground hover:opacity-90"
      aria-label="Account home"
    >
      <UserCircle2 className="h-4 w-4" />
    </Link>
  );
}

function SlashDivider() {
  return <span aria-hidden className="select-none text-muted-foreground/50">/</span>;
}

export function TopBar() {
  const location = useLocation();
  const params = useParams({ strict: false }) as { orgId?: string; invitationId?: string };

  const breadcrumbs = useMemo<Array<{ label: string }>>(() => {
    const p = location.pathname;
    if (p.startsWith('/account')) {
      const items: Array<{ label: string }> = [{ label: 'Account' }];
      if (p === '/account/profile') items.push({ label: 'Profile' });
      else if (p === '/account/security') items.push({ label: 'Security' });
      else if (p === '/account/sessions') items.push({ label: 'Sessions' });
      else if (p === '/account/two-factor') items.push({ label: 'Two-Factor' });
      return items;
    }
    if (p === '/organizations/new') return [{ label: 'Organizations' }, { label: 'New' }];
    if (params.orgId) {
      const tail = p.endsWith('/general')
        ? 'General'
        : p.endsWith('/members')
          ? 'Members'
          : 'Settings';
      return [{ label: 'Organizations' }, { label: tail }];
    }
    if (p === '/organizations' || p.startsWith('/organizations/')) return [{ label: 'Organizations' }];
    if (p.startsWith('/accept-invitation/')) return [{ label: 'Accept invitation' }];
    if (p.startsWith('/auth/device')) return [{ label: 'Device authorization' }];
    return [{ label: 'Account' }];
  }, [location.pathname, params.orgId]);

  return (
    <header className="flex h-12 shrink-0 items-center justify-between gap-2 border-b px-2 sm:px-4">
      {/* Left: brand + mobile trigger + breadcrumb */}
      <div className="flex min-w-0 items-center gap-1 sm:gap-2">
        <div className="sm:hidden">
          <SidebarTrigger className="h-9 w-9" />
        </div>
        <AccountBrand />
        <SlashDivider />
        <span className="hidden text-sm font-medium sm:inline">ObjectStack Account</span>
        <div className="hidden items-center gap-1 sm:flex">
          <Separator orientation="vertical" className="mx-2 h-4" />
          <OrganizationSwitcher />
          <Separator orientation="vertical" className="mx-2 h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              {breadcrumbs.map((item, index) => (
                <div key={index} className="flex items-center">
                  {index > 0 && <BreadcrumbSeparator />}
                  <BreadcrumbItem>
                    <BreadcrumbPage className="font-medium">{item.label}</BreadcrumbPage>
                  </BreadcrumbItem>
                </div>
              ))}
            </BreadcrumbList>
          </Breadcrumb>
        </div>
        {/* Mobile: just show last crumb */}
        <div className="min-w-0 flex-1 sm:hidden">
          {breadcrumbs.length > 0 && (
            <span className="truncate text-sm font-medium">
              {breadcrumbs[breadcrumbs.length - 1].label}
            </span>
          )}
        </div>
      </div>

      {/* Right: theme + user */}
      <div className="flex items-center gap-1 sm:gap-2">
        <div className="hidden sm:block">
          <ThemeToggle />
        </div>
        <UserMenu />
      </div>
    </header>
  );
}
