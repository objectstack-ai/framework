// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * PageHeader — consistent hero strip at the top of every authenticated
 * Account page.
 *
 *   ┌─────────────────────────────────────────────────────────────────┐
 *   │  (icon)  Title                              [action slot]       │
 *   │          Description / supporting copy                          │
 *   └─────────────────────────────────────────────────────────────────┘
 *
 * The whole block sits on a faint brand-tinted gradient + soft border so the
 * header reads as a single "frame" without dominating the content below.
 * `icon` is optional; when present it gets a glassy gradient tile.
 */

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface PageHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  title: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  actions?: React.ReactNode;
}

export function PageHeader({
  title,
  description,
  icon: Icon,
  actions,
  className,
  ...rest
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl border bg-brand-gradient-subtle',
        'px-5 py-5 sm:px-6 sm:py-6',
        className,
      )}
      {...rest}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          backgroundImage:
            'radial-gradient(ellipse 60% 80% at 0% 0%, hsl(var(--brand-from) / 0.12), transparent 60%)',
        }}
        aria-hidden
      />
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <div className="flex min-w-0 items-start gap-4">
          {Icon ? (
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-gradient text-primary-foreground shadow-sm shadow-primary/30 ring-1 ring-white/15">
              <Icon className="size-5" />
            </div>
          ) : null}
          <div className="min-w-0 space-y-1">
            <h1 className="truncate text-xl font-semibold tracking-tight sm:text-2xl">
              {title}
            </h1>
            {description ? (
              <p className="text-sm text-muted-foreground">{description}</p>
            ) : null}
          </div>
        </div>
        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
        ) : null}
      </div>
    </div>
  );
}
