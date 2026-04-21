// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * EnvironmentStatusBadge — color-coded pill for the environment lifecycle
 * status (provisioning / active / failed / suspended / archived / migrating).
 *
 * Rendered alongside {@link EnvironmentBadge} (which encodes envType) on the
 * environment list and detail pages so operators can tell at a glance whether
 * a given environment is ready, still coming up, or broken.
 *
 * Keep this component purely presentational — no data fetching or navigation
 * side-effects — so it can be rendered in tables, badges, and dialogs
 * without pulling in context.
 */

import { Loader2, AlertTriangle, CheckCircle2, PauseCircle, Archive, MoveRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { EnvironmentStatus } from '@objectstack/spec/cloud';

const VARIANT: Record<EnvironmentStatus, string> = {
  provisioning:
    'border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300',
  active:
    'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  failed:
    'border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300',
  suspended:
    'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  archived:
    'border-muted bg-muted text-muted-foreground',
  migrating:
    'border-violet-500/40 bg-violet-500/10 text-violet-700 dark:text-violet-300',
};

const LABEL: Record<EnvironmentStatus, string> = {
  provisioning: 'Provisioning',
  active: 'Active',
  failed: 'Provisioning failed',
  suspended: 'Suspended',
  archived: 'Archived',
  migrating: 'Migrating',
};

function StatusIcon({ status, className }: { status: EnvironmentStatus; className?: string }) {
  switch (status) {
    case 'provisioning':
      return <Loader2 className={cn('h-3 w-3 animate-spin', className)} />;
    case 'failed':
      return <AlertTriangle className={cn('h-3 w-3', className)} />;
    case 'active':
      return <CheckCircle2 className={cn('h-3 w-3', className)} />;
    case 'suspended':
      return <PauseCircle className={cn('h-3 w-3', className)} />;
    case 'archived':
      return <Archive className={cn('h-3 w-3', className)} />;
    case 'migrating':
      return <MoveRight className={cn('h-3 w-3', className)} />;
    default:
      return null;
  }
}

export interface EnvironmentStatusBadgeProps {
  status: EnvironmentStatus;
  /** Omit the label and show just the icon chip. Useful in dense lists. */
  iconOnly?: boolean;
  className?: string;
}

export function EnvironmentStatusBadge({ status, iconOnly, className }: EnvironmentStatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider',
        VARIANT[status],
        className,
      )}
      title={LABEL[status]}
    >
      <StatusIcon status={status} />
      {!iconOnly && <span>{LABEL[status]}</span>}
    </span>
  );
}
