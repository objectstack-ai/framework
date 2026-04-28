// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * AccountSidebar — global left navigation for the Account portal.
 *
 * Two semantic groups:
 *
 *   Account
 *   ├─ Profile
 *   ├─ Security
 *   ├─ Sessions
 *   └─ Two-Factor
 *
 *   Organization
 *   ├─ Overview        (/orgs)
 *   ├─ General         (/orgs/:id/general — only when an org is active)
 *   └─ Members         (/orgs/:id/members — only when an org is active)
 *
 * The active org's name is intentionally NOT used as a group label —
 * the top-bar OrganizationSwitcher already shows it prominently. When
 * collapsed to icon-only the labels hide automatically.
 */

import { Link, useLocation } from '@tanstack/react-router';
import {
  Building2,
  Monitor,
  PanelLeft,
  Settings,
  Shield,
  ShieldCheck,
  User,
  Users,
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  useSidebar,
} from '@/components/ui/sidebar';
import { useOrganizations } from '@/hooks/useSession';

interface NavItem {
  to:
    | '/account/profile'
    | '/account/security'
    | '/account/sessions'
    | '/account/two-factor'
    | '/orgs';
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const ACCOUNT_ITEMS: NavItem[] = [
  { to: '/account/profile', label: 'Profile', icon: User },
  { to: '/account/security', label: 'Security', icon: Shield },
  { to: '/account/sessions', label: 'Sessions', icon: Monitor },
  { to: '/account/two-factor', label: 'Two-Factor', icon: ShieldCheck },
];

export function AccountSidebar() {
  const { pathname } = useLocation();
  const { organizations } = useOrganizations();

  // /account on its own redirects to /account/profile, so treat the bare
  // path as the profile page for active-state purposes.
  const normalised = pathname === '/account' ? '/account/profile' : pathname;

  // Detect /orgs/<orgId>/* — used to surface the org-scoped sub-items.
  const orgMatch = pathname.match(/^\/orgs\/([^/]+)(?:\/.*)?$/);
  const activeOrgId =
    orgMatch && organizations.some((o) => o.id === orgMatch[1]) ? orgMatch[1] : null;

  return (
    <Sidebar collapsible="icon" className="h-full">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Account</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {ACCOUNT_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = normalised === item.to || normalised.startsWith(`${item.to}/`);
                return (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton asChild isActive={isActive} tooltip={item.label}>
                      <Link to={item.to}>
                        <Icon className="size-4" />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        <SidebarSeparator />

        <SidebarGroup>
          <SidebarGroupLabel>Organization</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={pathname === '/orgs'}
                  tooltip="Overview"
                >
                  <Link to="/orgs">
                    <Building2 className="size-4" />
                    <span>Overview</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              {activeOrgId && (
                <>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={pathname === `/orgs/${activeOrgId}/general`}
                      tooltip="General"
                    >
                      <Link to="/orgs/$orgId/general" params={{ orgId: activeOrgId }}>
                        <Settings className="size-4" />
                        <span>General</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={pathname === `/orgs/${activeOrgId}/members`}
                      tooltip="Members"
                    >
                      <Link to="/orgs/$orgId/members" params={{ orgId: activeOrgId }}>
                        <Users className="size-4" />
                        <span>Members</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <CollapseButton />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

function CollapseButton() {
  const { state, toggleSidebar } = useSidebar();
  const collapsed = state === 'collapsed';
  return (
    <SidebarMenuButton
      onClick={toggleSidebar}
      tooltip={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
    >
      <PanelLeft className="size-4" />
    </SidebarMenuButton>
  );
}
