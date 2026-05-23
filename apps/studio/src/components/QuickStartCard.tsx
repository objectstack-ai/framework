// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * QuickStartCard — Airtable-style "what would you like to build?" tile.
 *
 * Each card is a single high-level intent (New object, New view, …).
 * Clicking it can either navigate inside Studio (when the destination
 * already has a UI) or open the package source in VS Code via the
 * vscode-objectstack extension (the metadata-as-code Path of least
 * surprise). The card is a stateless presentational component — the
 * caller wires `onClick`.
 */

import { Card } from '@/components/ui/card';
import type { LucideIcon } from 'lucide-react';

interface QuickStartCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  badge?: string;
  /** Tailwind color name used for the icon background tint. */
  tone?: 'sky' | 'amber' | 'violet' | 'emerald' | 'rose' | 'slate';
  onClick: () => void;
}

const TONE_STYLES: Record<NonNullable<QuickStartCardProps['tone']>, { bg: string; fg: string }> = {
  sky: { bg: 'bg-sky-50 dark:bg-sky-950/40', fg: 'text-sky-600 dark:text-sky-400' },
  amber: { bg: 'bg-amber-50 dark:bg-amber-950/40', fg: 'text-amber-600 dark:text-amber-400' },
  violet: { bg: 'bg-violet-50 dark:bg-violet-950/40', fg: 'text-violet-600 dark:text-violet-400' },
  emerald: { bg: 'bg-emerald-50 dark:bg-emerald-950/40', fg: 'text-emerald-600 dark:text-emerald-400' },
  rose: { bg: 'bg-rose-50 dark:bg-rose-950/40', fg: 'text-rose-600 dark:text-rose-400' },
  slate: { bg: 'bg-slate-100 dark:bg-slate-900/40', fg: 'text-slate-600 dark:text-slate-400' },
};

export function QuickStartCard({ icon: Icon, title, description, badge, tone = 'sky', onClick }: QuickStartCardProps) {
  const t = TONE_STYLES[tone];
  return (
    <Card
      onClick={onClick}
      className="group relative cursor-pointer overflow-hidden border-border/60 p-4 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
    >
      <div className={`mb-3 inline-flex h-9 w-9 items-center justify-center rounded-lg ${t.bg} ${t.fg} ring-1 ring-inset ring-current/10 transition group-hover:scale-110`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex items-center gap-1.5">
        <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
        {badge && (
          <span className="rounded bg-muted px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
            {badge}
          </span>
        )}
      </div>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
    </Card>
  );
}
