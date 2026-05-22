// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * APIs page — REST endpoints are *auto-generated* from Objects, Views,
 * Flows, and Tools; there is no first-class `api` metadata type. Instead
 * of an always-empty list we surface what *is* available:
 *
 *   • A "What you get" panel that explains how endpoints come into
 *     being (one row per Object → CRUD; one per Tool → invoke; etc).
 *   • A direct link to Playground → REST, which already groups every
 *     mounted endpoint and lets you try them live.
 *   • Quick links to the canonical specs (OpenAPI, GraphQL once shipped).
 */

import { createFileRoute, Link } from '@tanstack/react-router';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Globe, Terminal, Database, FormInput, Workflow, Bot, ExternalLink } from 'lucide-react';

function ApisPageComponent() {
  const { package: packageId } = Route.useParams();

  const sources = [
    {
      icon: Database,
      label: 'Objects',
      hint: 'Every object exposes /api/v1/data/:name with CRUD + filter/sort/page.',
      to: `/${packageId}/objects`,
    },
    {
      icon: FormInput,
      label: 'Public forms',
      hint: 'Each published FormView gets a /api/v1/forms/:slug endpoint (GET + POST).',
      to: `/${packageId}/forms`,
    },
    {
      icon: Workflow,
      label: 'Automations',
      hint: 'Flows and webhooks can register their own /api/v1/flow/:id triggers.',
      to: `/${packageId}/automations`,
    },
    {
      icon: Bot,
      label: 'AI agents & tools',
      hint: 'Every Tool becomes /api/v1/ai/tools/:name; every Agent /api/v1/ai/agents/:name.',
      to: `/${packageId}/ai`,
    },
  ];

  return (
    <div className="flex h-full flex-col overflow-auto">
      <div className="border-b px-6 py-4">
        <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
          <Globe className="h-5 w-5" />
          APIs
        </h1>
        <p className="text-sm text-muted-foreground">
          REST endpoints in ObjectStack are auto-generated from metadata — there is no
          separate "API" object to design. Pick a source below to see (and edit) the
          metadata that produces its endpoints, or try them live in the Playground.
        </p>
      </div>

      <div className="grid gap-4 p-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Terminal className="h-4 w-4" />
              Try it live
            </CardTitle>
            <CardDescription>
              The REST console under Playground groups every mounted endpoint —
              data, meta, packages, auth, AI, automation, i18n — and lets you fire
              real requests against the running backend.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild size="sm" className="gap-1.5">
              <Link to="/$package/playground" params={{ package: packageId }}>
                <Terminal className="h-3.5 w-3.5" />
                Open Playground → REST
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ExternalLink className="h-4 w-4" />
              Specs
            </CardTitle>
            <CardDescription>
              OpenAPI / GraphQL contracts auto-generated from the same metadata.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant="outline" className="gap-1.5">
              <a href="/api/v1/openapi.json" target="_blank" rel="noreferrer">
                OpenAPI JSON
                <ExternalLink className="h-3 w-3" />
              </a>
            </Button>
            <Button asChild size="sm" variant="outline" className="gap-1.5">
              <a href="/docs/protocol/api" target="_blank" rel="noreferrer">
                Protocol docs
                <ExternalLink className="h-3 w-3" />
              </a>
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="px-6 pb-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Endpoints come from
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {sources.map((s) => (
            <Link
              key={s.label}
              to={s.to as any}
              className="group rounded-md border bg-card p-4 transition hover:border-primary hover:shadow-sm"
            >
              <div className="flex items-start gap-3">
                <s.icon className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground group-hover:text-primary" />
                <div className="space-y-1">
                  <p className="font-medium">{s.label}</p>
                  <p className="text-xs text-muted-foreground">{s.hint}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

export const Route = createFileRoute('/$package/apis/')({
  component: ApisPageComponent,
});
