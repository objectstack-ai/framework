// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Production-write guard.
 *
 * Studio talks to real, live databases. When the active project is
 * `production`, any mutating action — deleting metadata, archiving an
 * project, rotating credentials, running a write-mode flow — should
 * prompt the user to confirm before the request leaves the browser. This
 * mirrors Salesforce/Power Platform behaviour where destructive actions in
 * prod require an explicit extra tap.
 *
 * The guard is exposed as a hook (`useProductionGuard`) that returns a
 * `confirm(action)` function. It is a no-op for non-production envs, which
 * lets callers treat it as a uniform pre-commit step regardless of the
 * currently-selected project.
 *
 *     const guard = useProductionGuard();
 *     async function onDelete() {
 *       const ok = await guard.confirm({
 *         title: 'Delete this record?',
 *         description: 'This permanently removes the row from production.',
 *         confirmLabel: 'Delete',
 *       });
 *       if (!ok) return;
 *       await client.data.delete(...);
 *     }
 *
 * Mount `<ProductionGuardProvider />` once near the root of the app tree
 * (inside the router provider but above every route) so that descendant
 * components can call the hook.
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AlertTriangle } from 'lucide-react';
import type { ProjectType } from '@objectstack/spec/cloud';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ProjectBadge } from '@/components/project-badge';

export interface GuardOptions {
  /** Short imperative title, e.g. "Delete customer record?" */
  title: string;
  /** One-line description of what will happen. */
  description?: string;
  /** Label for the confirm button. Defaults to "Continue". */
  confirmLabel?: string;
  /** Visual variant of the confirm button. Defaults to "destructive". */
  confirmVariant?: 'default' | 'destructive';
  /**
   * If true, the user must type the project's displayName (or slug) to
   * enable the confirm button. Use for the most destructive operations.
   */
  requireTypedConfirmation?: boolean;
  /** The displayName/slug the user must type when requireTypedConfirmation. */
  typedConfirmationValue?: string;
}

interface ActiveProjectSnapshot {
  projectType: ProjectType | undefined;
  displayName?: string;
}

interface ProductionGuardContextValue {
  /** Confirm a mutating action; resolves `true` if the user proceeds. */
  confirm: (opts: GuardOptions) => Promise<boolean>;
  /**
   * Called by project-aware routes (e.g. useProjectDetail) to
   * register the currently-selected project so the guard knows whether
   * to engage.
   */
  setActiveProject: (snap: ActiveProjectSnapshot) => void;
  activeProjectType: ProjectType | undefined;
}

const ProductionGuardContext =
  createContext<ProductionGuardContextValue | null>(null);

export function ProductionGuardProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<ActiveProjectSnapshot>({
    projectType: undefined,
  });
  const [open, setOpen] = useState(false);
  const [opts, setOpts] = useState<GuardOptions | null>(null);
  const [typed, setTyped] = useState('');
  const resolverRef = useRef<((ok: boolean) => void) | null>(null);

  const confirm = useCallback(
    (next: GuardOptions): Promise<boolean> => {
      // Guard only engages in production. For everything else, treat the
      // action as pre-approved.
      if (active.projectType !== 'production') return Promise.resolve(true);
      setOpts(next);
      setTyped('');
      setOpen(true);
      return new Promise<boolean>((resolve) => {
        resolverRef.current = resolve;
      });
    },
    [active.projectType],
  );

  const settle = useCallback((result: boolean) => {
    resolverRef.current?.(result);
    resolverRef.current = null;
    setOpen(false);
    setOpts(null);
    setTyped('');
  }, []);

  const value = useMemo<ProductionGuardContextValue>(
    () => ({
      confirm,
      setActiveProject: setActive,
      activeProjectType: active.projectType,
    }),
    [confirm, active.projectType],
  );

  const expectedPhrase =
    opts?.typedConfirmationValue ?? active.displayName ?? '';
  const typedOk =
    !opts?.requireTypedConfirmation || typed.trim() === expectedPhrase.trim();

  return (
    <ProductionGuardContext.Provider value={value}>
      {children}
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) settle(false);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              {opts?.title ?? 'Confirm production action'}
            </DialogTitle>
            <DialogDescription>
              {opts?.description ??
                'This action runs against live production data and cannot be undone from the client.'}
            </DialogDescription>
          </DialogHeader>

          <div className="my-2 flex items-center gap-2 rounded-md border border-red-500/30 bg-red-500/5 p-3 text-sm">
            <ProjectBadge projectType="production" />
            <span className="font-medium">
              {active.displayName ?? 'Production project'}
            </span>
          </div>

          {opts?.requireTypedConfirmation && (
            <div className="grid gap-1.5">
              <Label htmlFor="prod-guard-typed">
                Type{' '}
                <code className="font-mono text-xs">{expectedPhrase}</code>{' '}
                to confirm
              </Label>
              <Input
                id="prod-guard-typed"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                autoComplete="off"
                autoFocus
              />
            </div>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={() => settle(false)}>
              Cancel
            </Button>
            <Button
              variant={opts?.confirmVariant ?? 'destructive'}
              disabled={!typedOk}
              onClick={() => settle(true)}
            >
              {opts?.confirmLabel ?? 'Continue'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ProductionGuardContext.Provider>
  );
}

/**
 * Access the production-write guard. Returns `{ confirm }` — see
 * {@link GuardOptions}. Falls back to an always-approving stub if the
 * provider is not mounted, so leaf components can call it unconditionally.
 */
export function useProductionGuard(): {
  confirm: (opts: GuardOptions) => Promise<boolean>;
  isProduction: boolean;
} {
  const ctx = useContext(ProductionGuardContext);
  if (!ctx) {
    return { confirm: async () => true, isProduction: false };
  }
  return { confirm: ctx.confirm, isProduction: ctx.activeProjectType === 'production' };
}

/** Internal hook for project-detail routes to register the active project. */
export function useRegisterActiveProject() {
  const ctx = useContext(ProductionGuardContext);
  return ctx?.setActiveProject ?? (() => {});
}
