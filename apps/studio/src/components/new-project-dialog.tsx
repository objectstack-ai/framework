// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * NewProjectDialog — provisions a new project for the current
 * organization via `client.projects.create()`.
 *
 * Form fields mirror {@link ProvisionProjectRequestSchema}:
 * slug, displayName, projectType, region, plan. The `organizationId` and
 * `createdBy` fields are injected by the backend from the session.
 *
 * On success, the dialog invokes `onCreated(env)` and closes; the parent
 * (ProjectSwitcher) is responsible for reloading the project list
 * and navigating into the new project.
 */

import { useEffect, useState } from 'react';
import type { Project, ProjectType } from '@objectstack/spec/cloud';
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
import { useDrivers, useProvisionProject } from '@/hooks/useProjects';
import { toast } from '@/hooks/use-toast';
import { useActiveOrganizationId, useSession } from '@/hooks/useSession';

const PROJECT_TYPES: { value: ProjectType; label: string; hint: string }[] = [
  { value: 'development', label: 'Development', hint: 'For makers building and iterating' },
  { value: 'test', label: 'Test', hint: 'Automated test runs, throwaway data' },
  { value: 'sandbox', label: 'Sandbox', hint: 'Isolated clone of production' },
  { value: 'preview', label: 'Preview', hint: 'Feature preview / PR environment' },
  { value: 'staging', label: 'Staging', hint: 'Pre-production parity' },
  { value: 'production', label: 'Production', hint: 'Live, customer-facing data' },
  { value: 'trial', label: 'Trial', hint: 'Time-boxed demo workspace' },
];

export interface NewProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (env: Project) => void;
}

export function NewProjectDialog({
  open,
  onOpenChange,
  onCreated,
}: NewProjectDialogProps) {
  const { provision, provisioning } = useProvisionProject();
  const { drivers, loading: driversLoading } = useDrivers();
  const activeOrgId = useActiveOrganizationId();
  const { user } = useSession();
  const [slug, setSlug] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [projectType, setProjectType] = useState<ProjectType>('development');
  const [region, setRegion] = useState('');
  const [driver, setDriver] = useState<string>('');

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
    setSlug('');
    setDisplayName('');
    setProjectType('development');
    setRegion('');
    setDriver('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!slug.trim()) return;
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
        organizationId: activeOrgId,
        createdBy: user?.id ?? '__session__',
        slug: slug.trim(),
        displayName: displayName.trim() || undefined,
        projectType,
        region: region.trim() || undefined,
        driver: driver || undefined,
      } as any);
      const project = (res?.project ?? res) as Project;
      toast({
        title: 'Project provisioned',
        description: `${project.displayName} (${project.slug}) is ready.`,
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
              <Label htmlFor="env-slug">
                Slug <span className="text-destructive">*</span>
              </Label>
              <Input
                id="env-slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="dev-alice"
                pattern="^[a-z0-9][a-z0-9-]{0,62}$"
                required
              />
              <p className="text-[11px] text-muted-foreground">
                Lowercase letters, numbers, and dashes. Unique per organization.
              </p>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="env-name">Display name</Label>
              <Input
                id="env-name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Alice's dev sandbox"
              />
            </div>

            <div className="grid gap-1.5">
              <Label>Type</Label>
              <Select
                value={projectType}
                onValueChange={(v) => setProjectType(v as ProjectType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROJECT_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      <div className="flex flex-col">
                        <span>{t.label}</span>
                        <span className="text-[11px] text-muted-foreground">
                          {t.hint}
                        </span>
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
                for tests; `turso` persists to libSQL.
              </p>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="env-region">Region (optional)</Label>
              <Input
                id="env-region"
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                placeholder="us-east-1"
              />
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
            <Button type="submit" disabled={provisioning || !slug.trim()}>
              {provisioning ? 'Provisioning…' : 'Create project'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
