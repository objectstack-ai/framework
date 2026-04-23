// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * NewProjectDialog — provisions a new project for the current
 * organization via `client.projects.create()`.
 *
 * Form fields mirror {@link ProvisionProjectRequestSchema}:
 * displayName (required) + driver. The `organizationId` and `createdBy`
 * fields are injected by the backend from the session.
 *
 * On success, the dialog invokes `onCreated(env)` and closes; the parent
 * (ProjectSwitcher) is responsible for reloading the project list
 * and navigating into the new project.
 */

import { useEffect, useState } from 'react';
/**
 * Canonical project row shape returned by the HTTP API.
 *
 * The dispatcher returns raw ObjectQL rows (snake_case column names) — no
 * camelCase translation layer. See `packages/runtime/src/http-dispatcher.ts`
 * `cleanProjectRow()`.
 */
type ProjectRow = {
  id: string;
  organization_id: string;
  display_name: string;
  is_default?: boolean;
  is_system?: boolean;
  status?: string;
  plan?: string;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
  database_url?: string;
  database_driver?: string;
  storage_limit_mb?: number;
  provisioned_at?: string;
  hostname?: string;
  metadata?: Record<string, unknown>;
};
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useDrivers, useProvisionProject, useTemplates } from '@/hooks/useProjects';
import { toast } from '@/hooks/use-toast';
import { useActiveOrganizationId, useSession } from '@/hooks/useSession';

export interface NewProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (env: ProjectRow) => void;
}

export function NewProjectDialog({
  open,
  onOpenChange,
  onCreated,
}: NewProjectDialogProps) {
  const { provision, provisioning } = useProvisionProject();
  const { drivers, loading: driversLoading } = useDrivers();
  const { templates, loading: templatesLoading } = useTemplates();
  const activeOrgId = useActiveOrganizationId();
  const { user } = useSession();
  const [displayName, setDisplayName] = useState('');
  const [driver, setDriver] = useState<string>('');
  const [templateId, setTemplateId] = useState<string>('blank');

  // Auto-select a sensible default once drivers load: prefer turso, then memory,
  // otherwise the first registered driver.
  useEffect(() => {
    if (driver || drivers.length === 0) return;
    const preferred =
      drivers.find((d) => d.name === 'turso') ??
      drivers.find((d) => d.name === 'memory') ??
      drivers[0];
    if (preferred) setDriver(preferred.name);
  }, [driver, drivers]);

  const reset = () => {
    setDisplayName('');
    setDriver('');
    setTemplateId('blank');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) return;
    if (!activeOrgId) {
      toast({
        title: 'No active organization',
        description: 'Select or create an organization first.',
        variant: 'destructive',
      });
      return;
    }
    try {
      const res = await provision({
        organization_id: activeOrgId,
        created_by: user?.id ?? '__session__',
        display_name: displayName.trim(),
        driver: driver || undefined,
        template_id: templateId !== 'blank' ? templateId : undefined,
      } as any);
      const project = (res?.project ?? res) as ProjectRow;
      toast({
        title: 'Project provisioned',
        description: `${project.display_name} is ready.`,
      });
      reset();
      onOpenChange(false);
      onCreated?.(project);
    } catch (err) {
      toast({
        title: 'Provisioning failed',
        description: (err as Error).message ?? 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>New project</DialogTitle>
            <DialogDescription>
              Provisions a physically isolated database for this project.
              Data in different projects is never shared.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-1.5">
              <Label htmlFor="env-name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="env-name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Alice's dev sandbox"
                required
                autoFocus
              />
            </div>

            <div className="grid gap-1.5">
              <Label>Template</Label>
              <Select
                value={templateId}
                onValueChange={setTemplateId}
                disabled={templatesLoading}
              >
                <SelectTrigger>
                  <SelectValue placeholder={templatesLoading ? 'Loading templates…' : 'Select a template'} />
                </SelectTrigger>
                <SelectContent>
                  {templates.length === 0 && !templatesLoading && (
                    <SelectItem value="blank">
                      <span>Blank — start from scratch</span>
                    </SelectItem>
                  )}
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      <div className="flex flex-col">
                        <span>{t.label}</span>
                        <span className="text-[11px] text-muted-foreground">{t.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1.5">
              <Label>Driver</Label>
              <Select
                value={driver}
                onValueChange={setDriver}
                disabled={driversLoading || drivers.length === 0}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      driversLoading
                        ? 'Loading drivers…'
                        : drivers.length === 0
                          ? 'No drivers registered'
                          : 'Select a driver'
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {drivers.map((d) => (
                    <SelectItem key={d.driverId} value={d.name}>
                      <div className="flex flex-col">
                        <span>{d.name}</span>
                        <span className="text-[11px] text-muted-foreground">
                          {d.driverId}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                Where this project's data will be stored. `memory` is ideal
                for tests; `sqlite` persists to a local file; `turso`
                persists to libSQL (local or remote).
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={provisioning}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={provisioning || !displayName.trim()}>
              {provisioning ? 'Provisioning…' : 'Create project'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
