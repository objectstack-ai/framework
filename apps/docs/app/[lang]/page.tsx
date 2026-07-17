import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { HomeLayout } from 'fumadocs-ui/layouts/home';
import { baseOptions, gitConfig } from '@/lib/layout.shared';

export const metadata: Metadata = {
  title: {
    absolute: 'ObjectStack — AI writes the app. ObjectStack is what it writes.',
  },
  description:
    'The open target format and runtime for AI-written business apps. Agents write compact typed metadata — often ~1% of a traditional codebase — strict TypeScript, Zod, and a validation gate catch mistakes at authoring time, and the runtime derives the database, REST API, UI, and MCP server. Your business ontology as an open protocol.',
};

export default function HomePage() {
  return (
    <HomeLayout {...baseOptions()}>
      <section className="flex flex-1 flex-col items-center justify-center px-4 py-24 text-center md:py-32">
        <span className="mb-6 rounded-full border border-fd-border px-3 py-1 text-xs font-medium text-fd-muted-foreground">
          Open source · Apache-2.0
        </span>
        <h1 className="max-w-3xl text-4xl font-bold tracking-tight text-balance md:text-5xl">
          AI writes the app.
          <br className="hidden sm:block" /> ObjectStack is what it writes.
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-fd-muted-foreground text-pretty">
          The open target format and runtime for AI-written business apps. Your coding agent
          writes models, UI, workflows, and permissions as compact typed metadata — often
          around 1% of a traditional codebase — and strict TypeScript, Zod schemas, and a
          validation gate catch its mistakes at authoring time. The runtime derives the
          database, REST API, UI, and MCP server, and enforces permissions and audit on
          every call. You review a small diff and ship.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/docs/getting-started"
            className="inline-flex items-center gap-2 rounded-full bg-fd-primary px-6 py-2.5 text-sm font-medium text-fd-primary-foreground transition-colors hover:bg-fd-primary/90"
          >
            Get started
            <ArrowRight className="size-4" />
          </Link>
          <Link
            href="/docs"
            className="inline-flex items-center rounded-full border border-fd-border px-6 py-2.5 text-sm font-medium transition-colors hover:bg-fd-accent hover:text-fd-accent-foreground"
          >
            Documentation
          </Link>
          <a
            href={`https://github.com/${gitConfig.user}/${gitConfig.repo}`}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center rounded-full border border-fd-border px-6 py-2.5 text-sm font-medium transition-colors hover:bg-fd-accent hover:text-fd-accent-foreground"
          >
            GitHub
          </a>
        </div>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-sm text-fd-muted-foreground">
          <span>~1% code surface</span>
          <span aria-hidden>·</span>
          <span>Typed, validated, governed</span>
          <span aria-hidden>·</span>
          <span>Self-host anywhere</span>
        </div>
        <p className="mt-16 max-w-2xl text-sm text-fd-muted-foreground text-pretty">
          Your objects, permissions, and flows are your business ontology — the definition
          layer of the AI era should be an open protocol you own.{' '}
          <a
            href="https://www.objectos.ai/en/blog/ai-ontology-open-protocol/"
            className="inline-flex items-center gap-1 font-medium text-fd-foreground underline underline-offset-4 transition-colors hover:text-fd-primary"
          >
            Read why
            <ArrowRight className="size-3.5" />
          </a>
        </p>
        <p className="mt-3 text-sm text-fd-muted-foreground">
          Want it governed and hosted, with Build &amp; Ask AI built in?{' '}
          <a
            href="https://www.objectos.ai"
            className="inline-flex items-center gap-1 font-medium text-fd-foreground underline underline-offset-4 transition-colors hover:text-fd-primary"
          >
            Try ObjectOS
            <ArrowRight className="size-3.5" />
          </a>
        </p>
      </section>
    </HomeLayout>
  );
}
