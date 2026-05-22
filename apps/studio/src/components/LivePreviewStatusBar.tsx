// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * LivePreviewStatusBar — a tiny footer that says exactly which backend
 * the preview is hitting, so an author looking at a form/grid is never
 * confused about whether the data is real or imagined.
 */

import { Activity } from 'lucide-react';
import { getApiBaseUrl, config } from '@/lib/config';

export interface LivePreviewStatusBarProps {
  /** Optional resource the preview is currently bound to. */
  objectName?: string;
}

export function LivePreviewStatusBar({ objectName }: LivePreviewStatusBarProps) {
  const base = getApiBaseUrl() || (typeof window !== 'undefined' ? window.location.origin : '');
  const display = base.replace(/^https?:\/\//, '');
  return (
    <div className="flex items-center justify-between gap-2 border-t border-dashed bg-muted/20 px-4 py-1.5 text-[10px] font-mono text-muted-foreground">
      <div className="flex items-center gap-1.5">
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
        </span>
        <Activity className="h-3 w-3" />
        <span>LIVE</span>
        <span className="text-muted-foreground/60">·</span>
        <span title="Backend">{display || 'same-origin'}</span>
        {objectName && (
          <>
            <span className="text-muted-foreground/60">·</span>
            <span title="Resource">{objectName}</span>
          </>
        )}
        {config.singleProject && config.defaultProjectId && (
          <>
            <span className="text-muted-foreground/60">·</span>
            <span>project={config.defaultProjectId}</span>
          </>
        )}
      </div>
      <div className="text-muted-foreground/60">
        real data · real validation · real submit
      </div>
    </div>
  );
}
