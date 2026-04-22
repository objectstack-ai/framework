// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * OrganizationSwitcher
 *
 * Sits immediately left of the ProjectSwitcher in the site header.
 * Reads org list + active org from `useOrganizations()` / `useSession()`.
 * Selecting an org calls `organizations.setActive()` and refreshes the
 * session (so the rest of the app picks up the new `activeOrganizationId`).
 */

import { useMemo, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Check, ChevronsUpDown, Plus } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { useOrganizations, useSession } from '@/hooks/useSession';
import { toast } from '@/hooks/use-toast';

export function OrganizationSwitcher() {
  const navigate = useNavigate();
  const { organizations, loading, reload } = useOrganizations();
  const { session, setActiveOrganization } = useSession();
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);

  const activeId = session?.activeOrganizationId ?? undefined;
  const active = useMemo(
    () => organizations.find((o) => o.id === activeId) ?? null,
    [organizations, activeId],
  );

  const handleSelect = async (id: string) => {
    if (id === activeId) {
      setOpen(false);
      return;
    }
    setSwitching(true);
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
    } finally {
      setSwitching(false);
      setOpen(false);
    }
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-2 px-2 text-sm font-medium"
          disabled={switching}
        >
          {active ? (
            <span className="max-w-[140px] truncate">{active.name}</span>
          ) : (
            <span className="text-muted-foreground">
              {loading ? 'Loading…' : 'Select organization'}
            </span>
          )}
          <ChevronsUpDown className="h-3 w-3 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[280px]" sideOffset={4}>
        <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Organizations
        </DropdownMenuLabel>
        {organizations.length === 0 && !loading && (
          <div className="px-3 py-4 text-center text-xs text-muted-foreground">
            No organizations yet.
          </div>
        )}
        {organizations.map((org) => (
          <DropdownMenuItem
            key={org.id}
            onSelect={(e) => {
              e.preventDefault();
              handleSelect(org.id);
            }}
            className="flex items-center gap-2"
          >
            <div className="flex-1 min-w-0">
              <div className="truncate font-medium">{org.name}</div>
              {org.slug && (
                <code className="text-[11px] text-muted-foreground font-mono">
                  {org.slug}
                </code>
              )}
            </div>
            {org.id === activeId && <Check className="h-3.5 w-3.5 text-primary" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault();
            setOpen(false);
            navigate({ to: '/orgs/new' });
          }}
          className="gap-2 text-sm"
        >
          <Plus className="h-3.5 w-3.5" />
          New organization…
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault();
            setOpen(false);
            navigate({ to: '/orgs' });
          }}
          className="gap-2 text-sm text-muted-foreground"
        >
          Manage organizations
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
