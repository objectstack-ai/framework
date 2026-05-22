// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Studio sidebar — flat, fixed-route navigation.
 *
 * Inspired by Power Apps' left rail and Salesforce Setup: top-level
 * entries are *jobs* (Objects, Forms, Automations, …) not metadata
 * items. The actual list of objects/views/etc. lives in the main canvas,
 * not in the sidebar — that scales to thousands of items where a tree
 * does not. Power-user discovery happens via ⌘K (CommandPalette).
 *
 * Driven by the registry in `studio-nav.ts`.
 */

import { useNavigate, useLocation } from '@tanstack/react-router';
import { PanelLeft } from 'lucide-react';
import type { InstalledPackage } from '@objectstack/spec/kernel';

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';

import { STUDIO_NAV } from './studio-nav';

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  packages: InstalledPackage[];
  selectedPackage: InstalledPackage | null;
  onSelectPackage: (pkg: InstalledPackage) => void;
}

export function AppSidebar({
  packages,
  selectedPackage,
  ...props
}: AppSidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const pkgId =
    selectedPackage?.manifest?.id ?? packages[0]?.manifest?.id ?? null;

  const isActive = (key: string): boolean => {
    if (!pkgId) return false;
    const path = location.pathname.replace(/\/$/, '');
    const root = `/${pkgId}`;
    if (key === 'home') return path === root;
    if (path.startsWith(`${root}/${key}`)) return true;
    // Legacy back-compat: /pkg/objects/$name still highlights Objects
    if (key === 'objects' && path.startsWith(`${root}/objects`)) return true;
    // Legacy metadata viewer (/pkg/metadata/$type/$name) — try to map back to nav item
    return false;
  };

  return (
    <Sidebar {...props}>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {STUDIO_NAV.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.key);
                return (
                  <SidebarMenuItem key={item.key}>
                    <SidebarMenuButton
                      tooltip={item.hint}
                      isActive={active}
                      onClick={() => {
                        if (!pkgId) return;
                        navigate({
                          to:
                            item.key === 'home'
                              ? `/${pkgId}`
                              : `/${pkgId}/${item.key}`,
                        });
                      }}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
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
