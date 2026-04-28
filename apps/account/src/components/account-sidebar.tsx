// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * AccountSidebar — global left navigation for the Account portal.
 *
 * Structure (matches Studio's collapsible icon rail):
 *
 *   Account
 *   ├─ Profile          (/account/profile)
 *   ├─ Security         (/account/security)
 *   ├─ Sessions         (/account/sessions)
 *   └─ Two-Factor       (/account/two-factor)
 *
 *   Organizations       (/orgs)
 *
 * When the sidebar collapses to icon-only mode the group labels are hidden;
 * each entry still renders as a clickable icon with a tooltip.
 */

import { Link, useLocation } from '@tanstack/react-router';
import { Building2, Monitor, PanelLeft, Shield, ShieldCheck, User } from 'lucide-react';
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

  // /account on its own redirects to /account/profile, so treat the bare
  // path as the profile page for active-state purposes.
  const normalised = pathname === '/account' ? '/account/profile' : pathname;

  return (
    <Sidebar collapsible="icon">
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

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={pathname === '/orgs' || pathname.startsWith('/orgs/')}
                  tooltip="Organizations"
                >
                  <Link to="/orgs">
                    <Building2 className="size-4" />
                    <span>Organizations</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
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
