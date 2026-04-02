// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Plugin Host Component
 * 
 * The main content area that resolves and renders the appropriate
 * plugin viewer for the current metadata selection.
 * 
 * Features:
 * - View mode switcher (preview / design / code / data)
 * - Plugin viewer selector (when multiple viewers are available)
 * - Toolbar with plugin-contributed actions
 * - Fallback to default JSON inspector when no viewer is found
 */

import { useState, useMemo } from 'react';
import type { ViewMode } from '@objectstack/spec/studio';
import { useMetadataViewer, useMetadataViewers, useAvailableModes, useMetadataActions } from './hooks';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Eye, PenTool, Code2, Table2,
  ChevronDown,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// ─── Mode Icons ──────────────────────────────────────────────────────

const MODE_CONFIG: Record<ViewMode, { icon: LucideIcon; label: string }> = {
  preview: { icon: Eye as LucideIcon, label: 'Preview' },
  design: { icon: PenTool as LucideIcon, label: 'Design' },
  code: { icon: Code2 as LucideIcon, label: 'Code' },
  data: { icon: Table2 as LucideIcon, label: 'Data' },
};

// ─── Props ───────────────────────────────────────────────────────────

interface PluginHostProps {
  /** Metadata type */
  metadataType: string;
  /** Metadata item name */
  metadataName: string;
  /** Pre-loaded metadata data (optional) */
  data?: any;
  /** Package ID to filter metadata by (optional) */
  packageId?: string;
}

// ─── Component ───────────────────────────────────────────────────────

export function PluginHost({ metadataType, metadataName, data, packageId }: PluginHostProps) {
  const [activeMode, setActiveMode] = useState<ViewMode>('preview');

  // Get available modes and viewers for this metadata type
  const availableModes = useAvailableModes(metadataType);
  const allViewers = useMetadataViewers(metadataType);
  const bestViewer = useMetadataViewer(metadataType, activeMode);
  const toolbarActions = useMetadataActions(metadataType, 'toolbar');

  // If the current mode isn't available, fall back to the first available
  const effectiveMode = availableModes.includes(activeMode) ? activeMode : (availableModes[0] || 'preview');

  // Get viewers for the effective mode
  const modeViewers = useMemo(
    () => allViewers.filter(v => v.modes.includes(effectiveMode)),
    [allViewers, effectiveMode]
  );
  const [selectedViewerIndex, setSelectedViewerIndex] = useState(0);

  // Resolve the active viewer
  const activeViewer = modeViewers[selectedViewerIndex] || bestViewer;

  // No viewer found at all
  if (!activeViewer) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground">
        <div className="text-center space-y-2">
          <p className="text-sm">No viewer available for <Badge variant="outline">{metadataType}</Badge></p>
          <p className="text-xs">Install a plugin that supports this metadata type.</p>
        </div>
      </div>
    );
  }

  const ViewerComponent = activeViewer.component;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* ── Toolbar ── */}
      <div className="flex items-center gap-1 border-b px-4 bg-muted/30 min-h-10">
        {/* Mode Switcher */}
        <div className="flex items-center gap-0.5">
          {availableModes.map(mode => {
            const config = MODE_CONFIG[mode];
            const ModeIcon = config.icon as React.ComponentType<{ className?: string }>;
            const isActive = mode === effectiveMode;
            return (
              <button
                key={mode}
                onClick={() => { setActiveMode(mode); setSelectedViewerIndex(0); }}
                className={`
                  flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors
                  ${isActive
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
                  }
                `}
              >
                <ModeIcon className="h-3.5 w-3.5" />
                {config.label}
              </button>
            );
          })}
        </div>

        {/* Viewer Selector (when multiple viewers for same mode) */}
        {modeViewers.length > 1 && (
          <>
            <div className="mx-2 h-4 w-px bg-border" />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs">
                  {activeViewer.label}
                  {/* @ts-expect-error React 19 type mismatch with lucide-react */}
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {modeViewers.map((viewer, idx) => (
                  <DropdownMenuItem
                    key={viewer.id}
                    onClick={() => setSelectedViewerIndex(idx)}
                    className={idx === selectedViewerIndex ? 'bg-accent' : ''}
                  >
                    <span className="text-xs">{viewer.label}</span>
                    <Badge variant="outline" className="ml-2 text-[10px]">
                      {viewer.pluginId}
                    </Badge>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Plugin Actions */}
        {toolbarActions.map(action => (
          <Button
            key={action.id}
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => action.handler({ metadataType, metadataName, data })}
          >
            {action.label}
          </Button>
        ))}

        {/* Plugin badge */}
        <Badge variant="secondary" className="text-[10px] font-mono">
          {activeViewer.pluginId}
        </Badge>
      </div>

      {/* ── Viewer Content ── */}
      <div className="flex-1 overflow-auto">
        <ViewerComponent
          metadataType={metadataType}
          metadataName={metadataName}
          data={data}
          mode={effectiveMode}
          packageId={packageId}
        />
      </div>
    </div>
  );
}
