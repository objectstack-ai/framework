// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * ProjectBadge — color-coded pill indicating the project type.
 *
 * Color grammar follows industry convention (Salesforce/Power Platform):
 * - `production` → red/destructive (danger zone)
 * - `staging`   → amber (pre-prod parity)
 * - `sandbox`   → amber/yellow (prod clone, but not live)
 * - `development`, `test`, `preview`, `trial` → muted/secondary
 *
 * Keep this component purely presentational — no data fetching or
 * navigation side-effects — so it can be rendered in tables, badges,
 * breadcrumbs, and dialogs without pulling in context.
 */

import { cn } from '@/lib/utils';
import type { ProjectType } from '@objectstack/spec/cloud';

const VARIANT: Record<ProjectType, string> = {
  production:
    'border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300',
  staging:
    'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  sandbox:
    'border-yellow-500/40 bg-yellow-500/10 text-yellow-700 dark:text-yellow-300',
  development: 'border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300',
  test: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  preview:
    'border-violet-500/40 bg-violet-500/10 text-violet-700 dark:text-violet-300',
  trial: 'border-muted bg-muted text-muted-foreground',
};

const SHORT: Record<ProjectType, string> = {
  production: 'PROD',
  staging: 'STG',
  sandbox: 'SBX',
  development: 'DEV',
  test: 'TEST',
  preview: 'PRE',
  trial: 'TRIAL',
};

export interface ProjectBadgeProps {
  projectType: ProjectType;
  /** Use the full label instead of the 3–4 char short form. */
  full?: boolean;
  className?: string;
}

export function ProjectBadge({
  projectType,
  full,
  className,
}: ProjectBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex h-4 items-center rounded border px-1.5 text-[10px] font-mono font-semibold uppercase tracking-wider',
        VARIANT[projectType],
        className,
      )}
      title={projectType}
    >
      {full ? projectType : SHORT[projectType]}
    </span>
  );
}
