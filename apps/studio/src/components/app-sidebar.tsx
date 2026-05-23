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

import { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from '@tanstack/react-router';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import type { InstalledPackage } from '@objectstack/spec/kernel';

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
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
  // Focus mode: object detail pages and full-page metadata viewers benefit
  // from collapsing the rail to icon-only — the inner sub-tabs (Designer /
  // Related, etc) already eat horizontal space and the rail is just chrome
  // by then. We auto-collapse on entry and restore the previous expanded
  // state on exit so the user's preference is preserved everywhere else.
  useAutoCollapseOnFocusRoute(location.pathname);
  // Active package id for navigation. Falls back to first package; the URL
  // segment "all" is used as the sentinel for "全部 (All packages)" mode.
  const urlSegment = location.pathname.split('/').filter(Boolean)[0];
  const pkgId =
    selectedPackage?.manifest?.id ??
    (urlSegment === 'all' ? 'all' : packages[0]?.manifest?.id) ??
    null;

  const isActive = (key: string): boolean => {
    const path = location.pathname.replace(/\/$/, '');
    // Active package segment in the URL — may be a real id or "all".
    const seg = urlSegment ?? '';
    const root = seg ? `/${seg}` : '';
    if (!seg) return false;
    if (key === 'home') return path === root;
    return path.startsWith(`${root}/${key}`);
  };

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader className="border-b">
        <SidebarMenu>
          <SidebarMenuItem>
            <CollapseButton />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
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
      <SidebarFooter />
    </Sidebar>
  );
}

function CollapseButton() {
  const { state, toggleSidebar } = useSidebar();
  const collapsed = state === 'collapsed';
  const Icon = collapsed ? PanelLeftOpen : PanelLeftClose;
  return (
    <SidebarMenuButton
      size="sm"
      onClick={toggleSidebar}
      tooltip={collapsed ? 'Expand sidebar (⌘B)' : 'Collapse sidebar (⌘B)'}
      aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      className="h-7 text-muted-foreground hover:text-foreground"
    >
      <Icon className="size-4" />
      <span className="text-xs">{collapsed ? 'Expand' : 'Collapse'}</span>
    </SidebarMenuButton>
  );
}

// Routes that benefit from focus-mode (sidebar auto-collapsed to icon-only):
//   /$pkg/objects/$name            — Object Hub (Designer + Related tabs)
//   /$pkg/metadata/$type/$name     — single-metadata viewer
const FOCUS_ROUTE_PATTERNS: RegExp[] = [
  /^\/[^/]+\/objects\/[^/]+/,
  /^\/[^/]+\/metadata\/[^/]+\/[^/]+/,
];

function isFocusRoute(path: string): boolean {
  return FOCUS_ROUTE_PATTERNS.some((re) => re.test(path));
}

/**
 * Auto-collapses the sidebar to icon-only mode while the user is on a
 * focus route (Object Hub, single-metadata viewer). Restores the previous
 * open state on exit so the user's manual preference isn't clobbered.
 *
 * If the user explicitly toggles the rail while inside a focus route,
 * the override is dropped — we only auto-restore when we ourselves were
 * the ones who closed it.
 */
function useAutoCollapseOnFocusRoute(pathname: string) {
  const { open, setOpen } = useSidebar();
  const wasOpenBeforeFocus = useRef<boolean | null>(null);

  useEffect(() => {
    const focused = isFocusRoute(pathname);
    if (focused) {
      // Entering focus: remember state once, then collapse.
      if (wasOpenBeforeFocus.current === null) {
        wasOpenBeforeFocus.current = open;
        if (open) setOpen(false);
      }
    } else if (wasOpenBeforeFocus.current !== null) {
      // Leaving focus: restore prior state, then forget.
      const prior = wasOpenBeforeFocus.current;
      wasOpenBeforeFocus.current = null;
      if (prior !== open) setOpen(prior);
    }
    // We deliberately depend on pathname only — re-checking on every
    // `open` change would cause an infinite collapse/restore loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);
}
