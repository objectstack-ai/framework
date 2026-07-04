'use client';

import { useEffect, useId, useState } from 'react';
import { useTheme } from 'next-themes';

/**
 * Client-side Mermaid renderer. Code fences with the `mermaid` language are
 * rewritten to <Mermaid chart="..."/> by the remark plugin in source.config.ts,
 * so authors keep writing standard ```mermaid blocks.
 */
export function Mermaid({ chart }: { chart: string }) {
  const id = useId();
  const [svg, setSvg] = useState('');
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    let cancelled = false;

    async function render() {
      const { default: mermaid } = await import('mermaid');
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'strict',
        fontFamily: 'inherit',
        theme: resolvedTheme === 'dark' ? 'dark' : 'default',
      });
      try {
        const rendered = await mermaid.render(
          // mermaid requires a DOM-safe element id
          `mermaid-${id.replace(/[^a-zA-Z0-9]/g, '')}`,
          chart,
        );
        if (!cancelled) setSvg(rendered.svg);
      } catch {
        // Leave the diagram source visible instead of a blank hole on bad syntax.
        if (!cancelled) setSvg('');
      }
    }

    void render();
    return () => {
      cancelled = true;
    };
  }, [chart, id, resolvedTheme]);

  if (!svg) {
    return (
      <pre className="overflow-x-auto rounded-lg border p-4 text-sm">
        <code>{chart}</code>
      </pre>
    );
  }

  return (
    <div
      className="my-6 flex justify-center overflow-x-auto [&_svg]:max-w-full"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
