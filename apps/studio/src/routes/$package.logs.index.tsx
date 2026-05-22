// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Logs — request log · event log · audit trail.
 *
 * Placeholder route until the runtime exposes the ring-buffered log
 * endpoints. Surfaces the IA so devs know the slot exists.
 */

import { createFileRoute, Link } from '@tanstack/react-router';
import { ScrollText, Webhook, ShieldAlert, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

function LogsPage() {
  const { package: packageId } = Route.useParams();
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="border-b px-6 py-4">
        <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
          <ScrollText className="h-5 w-5" /> Logs
        </h1>
        <p className="text-sm text-muted-foreground">
          See what your runtime is doing right now — every request, every event,
          every change to your data.
        </p>
      </div>
      <div className="flex-1 overflow-auto p-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Webhook className="h-4 w-4" /> Request log
              </CardTitle>
              <CardDescription>
                Every REST request the runtime served, with status, latency, and
                auth context.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border border-dashed bg-muted/30 p-6 text-center text-xs text-muted-foreground">
                Coming soon. Requests will stream here in real time.
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ScrollText className="h-4 w-4" /> Event log
              </CardTitle>
              <CardDescription>
                Hooks, flows, and triggers — what fired, with which payload, and
                what they returned.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border border-dashed bg-muted/30 p-6 text-center text-xs text-muted-foreground">
                Coming soon. Hook and flow runs will stream here.
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldAlert className="h-4 w-4" /> Audit trail
              </CardTitle>
              <CardDescription>
                Every metadata mutation persisted to the audit object —
                who-changed-what-when.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild size="sm" variant="outline" className="w-full justify-between">
                <Link to="/$package/objects/$name" params={{ package: packageId, name: 'sys_audit_log' }}>
                  Open sys_audit_log
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export const Route = createFileRoute('/$package/logs/')({
  component: LogsPage,
});
