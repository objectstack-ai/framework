// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { useCreateOrganization, useSession } from '@/hooks/useSession';

export const Route = createFileRoute('/orgs/new')({
  component: NewOrgPage,
});

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

function NewOrgPage() {
  const navigate = useNavigate();
  const { create, creating } = useCreateOrganization();
  const { setActiveOrganization } = useSession();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugDirty, setSlugDirty] = useState(false);

  const handleNameChange = (value: string) => {
    setName(value);
    if (!slugDirty) setSlug(slugify(value));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await create({ name, slug: slug || undefined });
      // better-auth returns the created organization; try to pick up id.
      const created = (res as any)?.data ?? res;
      const newId = created?.id ?? created?.organization?.id;
      if (newId) {
        await setActiveOrganization(newId).catch(() => {});
      }
      toast({ title: 'Organization created' });
      navigate({ to: '/orgs' });
    } catch (err) {
      toast({
        title: 'Failed to create organization',
        description: (err as Error).message,
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex-1 px-6 py-8 overflow-auto">
        <div className="mx-auto max-w-lg">
          <Card>
            <CardHeader>
              <CardTitle>New organization</CardTitle>
              <CardDescription>
                Organizations group projects, metadata and members together.
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleSubmit}>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    required
                    value={name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    placeholder="Acme Corp"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="slug">Slug</Label>
                  <Input
                    id="slug"
                    value={slug}
                    onChange={(e) => {
                      setSlug(e.target.value);
                      setSlugDirty(true);
                    }}
                    placeholder="acme-corp"
                    pattern="[a-z0-9-]+"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Lowercase, dashes only. Used in URLs and APIs.
                  </p>
                </div>
              </CardContent>
              <CardFooter className="flex justify-between">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => navigate({ to: '/orgs' })}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={creating || !name}>
                  {creating ? 'Creating…' : 'Create organization'}
                </Button>
              </CardFooter>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
