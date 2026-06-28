// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { definePage } from '@objectstack/spec/ui';

/**
 * Command Center — a `kind:'jsx'` page (ADR-0080). The entire layout is
 * authored as a constrained JSX + Tailwind *string*; at save time
 * `@objectstack/sdui-parser` compiles it (parse, never execute) into the SDUI
 * tree, which the normal PageRenderer / SchemaRenderer renders. Every tag is a
 * real registered component — `flex`, `grid`, `card`, `text`, `badge`, `stack`.
 *
 * Demonstrates what the fixed page schema cannot: Tailwind-freeform layout that
 * still composes the platform's real components. Browser-verified.
 */
export const CommandCenterJsxPage = definePage({
  name: 'showcase_command_center_jsx',
  label: 'Command Center (JSX)',
  type: 'home',
  kind: 'jsx',
  source: `
<flex direction="col" className="min-h-screen gap-10 bg-gradient-to-br from-slate-50 via-white to-indigo-50 p-10">

  <flex direction="col" className="gap-3">
    <badge className="w-fit rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-indigo-700" label="Operations · JSX-source page" />
    <text className="block text-5xl font-bold tracking-tight text-slate-900" content="Command Center" />
    <text className="block max-w-2xl text-base leading-relaxed text-slate-500" content="This whole page is authored as constrained JSX + Tailwind and compiled to the SDUI tree — parsed, never executed. Every card is a real registered component." />
  </flex>

  <grid columns={4} className="gap-5">
    <card className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <text className="block text-sm font-medium text-slate-500" content="Open Tasks" />
      <text className="mt-3 block text-4xl font-bold text-slate-900" content="128" />
      <text className="mt-2 block text-xs font-semibold text-emerald-600" content="▲ 12% vs last week" />
    </card>
    <card className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <text className="block text-sm font-medium text-slate-500" content="In Progress" />
      <text className="mt-3 block text-4xl font-bold text-slate-900" content="47" />
      <text className="mt-2 block text-xs font-semibold text-amber-600" content="● 9 due today" />
    </card>
    <card className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <text className="block text-sm font-medium text-slate-500" content="Completed" />
      <text className="mt-3 block text-4xl font-bold text-slate-900" content="1,902" />
      <text className="mt-2 block text-xs font-semibold text-emerald-600" content="▲ 4% this month" />
    </card>
    <card className="rounded-2xl border border-indigo-300 bg-gradient-to-br from-indigo-500 to-violet-600 p-6 shadow-md">
      <text className="block text-sm font-medium text-indigo-100" content="Cycle Time" />
      <text className="mt-3 block text-4xl font-bold text-white" content="2.4d" />
      <text className="mt-2 block text-xs font-semibold text-indigo-100" content="▼ 18% faster" />
    </card>
  </grid>

  <grid columns={3} className="gap-5">
    <card className="col-span-2 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <text className="block text-lg font-semibold text-slate-900" content="Weekly Throughput" />
      <flex direction="row" className="mt-8 items-end gap-4">
        <flex className="h-12 w-full rounded-lg bg-indigo-400" />
        <flex className="h-20 w-full rounded-lg bg-indigo-500" />
        <flex className="h-16 w-full rounded-lg bg-indigo-400" />
        <flex className="h-28 w-full rounded-lg bg-violet-500" />
        <flex className="h-14 w-full rounded-lg bg-indigo-400" />
        <flex className="h-24 w-full rounded-lg bg-indigo-500" />
        <flex className="h-10 w-full rounded-lg bg-indigo-300" />
      </flex>
    </card>
    <card className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <text className="block text-lg font-semibold text-slate-900" content="Recent Activity" />
      <stack className="mt-4 gap-3">
        <flex direction="row" className="items-center gap-3"><flex className="h-2 w-2 rounded-full bg-emerald-500" /><text className="text-sm text-slate-600" content="Onboarding flow shipped" /></flex>
        <flex direction="row" className="items-center gap-3"><flex className="h-2 w-2 rounded-full bg-indigo-500" /><text className="text-sm text-slate-600" content="12 tasks moved to Review" /></flex>
        <flex direction="row" className="items-center gap-3"><flex className="h-2 w-2 rounded-full bg-amber-500" /><text className="text-sm text-slate-600" content="SLA breach on #4821" /></flex>
        <flex direction="row" className="items-center gap-3"><flex className="h-2 w-2 rounded-full bg-slate-300" /><text className="text-sm text-slate-600" content="Sprint 42 planning" /></flex>
      </stack>
    </card>
  </grid>
</flex>`,
});
