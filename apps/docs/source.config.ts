import { defineConfig, defineDocs } from 'fumadocs-mdx/config';
import { metaSchema, pageSchema } from 'fumadocs-core/source/schema';
import { z } from 'zod';
import path from 'node:path';
import { visit } from 'unist-util-visit';

/**
 * Rewrite ```mermaid code fences into <Mermaid chart="..."/> elements so
 * diagrams render as SVG (components/mermaid.tsx) instead of code blocks.
 */
function remarkMermaid() {
  return (tree: any) => {
    visit(tree, 'code', (node: any, index: number | undefined, parent: any) => {
      if (node.lang !== 'mermaid' || !parent || index === undefined) return;
      parent.children[index] = {
        type: 'mdxJsxFlowElement',
        name: 'Mermaid',
        attributes: [{ type: 'mdxJsxAttribute', name: 'chart', value: node.value }],
        children: [],
      };
    });
  };
}

export const docs = defineDocs({
  dir: path.resolve(process.cwd(), '../../content/docs'),
  docs: {
    schema: pageSchema,
    postprocess: {
      includeProcessedMarkdown: true,
    },
  },
  meta: {
    schema: metaSchema,
  },
});

const blogSchema = pageSchema.extend({
  author: z.string().optional(),
  date: z.coerce.string().optional(),
  tags: z.array(z.string()).optional(),
});

export const blog = defineDocs({
  dir: path.resolve(process.cwd(), '../../content/blog'),
  docs: {
    schema: blogSchema,
  },
});

export default defineConfig({
  mdxOptions: {
    remarkPlugins: (v) => [...v, remarkMermaid],
  },
});
