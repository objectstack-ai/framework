// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Build Skill References
 *
 * Copies Zod schema source files into each skill's `references/zod/` folder
 * so that AI agents can read the precise type definitions directly — without
 * needing access to the monorepo source tree.
 *
 * Usage: tsx scripts/build-skill-references.ts
 *
 * The script:
 * 1. Reads a declarative mapping of { skill → core zod files }
 * 2. Recursively resolves local `import … from` dependencies
 * 3. Copies all resolved files into `skills/{name}/references/zod/`
 *    preserving the category-based directory structure
 * 4. Generates an `_index.md` per skill listing all bundled schemas
 */

import fs from 'fs';
import path from 'path';

// ── Paths ────────────────────────────────────────────────────────────────────

const REPO_ROOT = path.resolve(__dirname, '../../..');
const SPEC_SRC = path.resolve(__dirname, '../src');
const SKILLS_DIR = path.resolve(REPO_ROOT, 'skills');

// ── Skill → Zod file mapping ────────────────────────────────────────────────
// Paths are relative to packages/spec/src/ (category/file.zod.ts)

const SKILL_MAP: Record<string, string[]> = {
  'objectstack-data': [
    'data/field.zod.ts',
    'data/object.zod.ts',
    'data/validation.zod.ts',
    'data/query.zod.ts',
    'data/filter.zod.ts',
    'data/datasource.zod.ts',
    'data/hook.zod.ts',
    'security/permission.zod.ts',
  ],
  'objectstack-ai': [
    'ai/agent.zod.ts',
    'ai/tool.zod.ts',
    'ai/skill.zod.ts',
    'ai/rag-pipeline.zod.ts',
    'ai/model-registry.zod.ts',
    'ai/conversation.zod.ts',
    'ai/mcp.zod.ts',
    'ai/orchestration.zod.ts',
    'ai/nlq.zod.ts',
  ],
  'objectstack-api': [
    'api/endpoint.zod.ts',
    'api/auth.zod.ts',
    'api/realtime.zod.ts',
    'api/rest-server.zod.ts',
    'api/graphql.zod.ts',
    'api/websocket.zod.ts',
    'api/errors.zod.ts',
    'api/batch.zod.ts',
    'api/versioning.zod.ts',
  ],
  'objectstack-automation': [
    'automation/flow.zod.ts',
    'automation/workflow.zod.ts',
    'automation/trigger-registry.zod.ts',
    'automation/approval.zod.ts',
    'automation/state-machine.zod.ts',
    'automation/execution.zod.ts',
    'automation/webhook.zod.ts',
    'automation/node-executor.zod.ts',
  ],
  'objectstack-ui': [
    'ui/view.zod.ts',
    'ui/app.zod.ts',
    'ui/dashboard.zod.ts',
    'ui/chart.zod.ts',
    'ui/action.zod.ts',
    'ui/page.zod.ts',
    'ui/widget.zod.ts',
    'ui/component.zod.ts',
    'ui/report.zod.ts',
    'ui/theme.zod.ts',
  ],
};

// ── Import resolver ──────────────────────────────────────────────────────────

/**
 * Extract local imports from a .zod.ts file.
 * Returns paths relative to SPEC_SRC (e.g. "shared/identifiers.zod.ts").
 * Ignores external imports (zod, node modules).
 */
function extractLocalImports(filePath: string): string[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const imports: string[] = [];
  // Match: import { ... } from './foo.zod'  or  '../shared/bar.zod'
  const re = /^import\s+.*\s+from\s+['"](\.[^'"]+)['"]/gm;
  let match: RegExpExecArray | null;
  while ((match = re.exec(content)) !== null) {
    const importSpec = match[1]; // e.g. '../shared/identifiers.zod'
    const dir = path.dirname(filePath);
    let resolved = path.resolve(dir, importSpec);
    // Append .ts if needed
    if (!resolved.endsWith('.ts')) {
      resolved += '.ts';
    }
    if (fs.existsSync(resolved)) {
      // Convert back to relative from SPEC_SRC
      const rel = path.relative(SPEC_SRC, resolved);
      imports.push(rel);
    }
  }
  return imports;
}

/**
 * Recursively resolve all dependencies for a set of entry files.
 * Returns deduplicated set of all files (entries + transitive deps),
 * all relative to SPEC_SRC.
 */
function resolveAll(entryFiles: string[]): string[] {
  const visited = new Set<string>();
  const queue = [...entryFiles];

  while (queue.length > 0) {
    const rel = queue.shift()!;
    if (visited.has(rel)) continue;
    visited.add(rel);

    const abs = path.resolve(SPEC_SRC, rel);
    if (!fs.existsSync(abs)) {
      console.warn(`  ⚠ File not found: ${rel}`);
      continue;
    }
    const deps = extractLocalImports(abs);
    for (const dep of deps) {
      if (!visited.has(dep)) {
        queue.push(dep);
      }
    }
  }

  return [...visited].sort();
}

// ── JSDoc description extractor ──────────────────────────────────────────────

/**
 * Extract a short description from a file's first JSDoc comment.
 * Takes only the first sentence/line. Falls back to exported schema names.
 */
function extractDescription(filePath: string): string {
  const content = fs.readFileSync(filePath, 'utf-8');
  // Try to grab the first top-level JSDoc comment
  const jsdocRe = /\/\*\*\s*\n([\s\S]*?)\*\//;
  const jsdocMatch = content.match(jsdocRe);
  if (jsdocMatch) {
    const lines = jsdocMatch[1]
      .split('\n')
      .map((line) => line.replace(/^\s*\*\s?/, '').trim())
      .filter((line) => line && !line.startsWith('@') && !line.startsWith('```'));
    // Take only the first non-empty line as a short description
    const firstLine = lines[0];
    if (firstLine && firstLine.length > 5) {
      // Strip leading markdown heading markers
      const clean = firstLine.replace(/^#+\s*/, '');
      // Truncate to first sentence or 120 chars
      const sentence = clean.split(/\.\s/)[0];
      return sentence.length > 120 ? sentence.slice(0, 117) + '...' : sentence;
    }
  }
  // Fallback: list exported schema names
  const exports: string[] = [];
  const exportRe = /export\s+const\s+(\w+Schema|\w+)\s*(?:[:=])/g;
  let m: RegExpExecArray | null;
  while ((m = exportRe.exec(content)) !== null) {
    exports.push(m[1]);
  }
  if (exports.length > 0) return `Exports: ${exports.slice(0, 5).join(', ')}`;
  return '';
}

// ── Index generator ──────────────────────────────────────────────────────────

function generateIndex(skillName: string, coreFiles: string[], allFiles: string[]): string {
  const coreSet = new Set(coreFiles);
  const lines: string[] = [
    `# ${skillName} — Zod Schema Reference`,
    '',
    '> **Auto-generated** by `build-skill-references.ts`.',
    '> These files are copied from `packages/spec/src/` for AI agent consumption.',
    '> Do not edit — re-run `pnpm --filter @objectstack/spec run gen:skill-refs` to update.',
    '',
    '## Core Schemas',
    '',
  ];

  for (const f of allFiles.filter((f) => coreSet.has(f))) {
    const desc = extractDescription(path.resolve(SPEC_SRC, f));
    lines.push(`- [\`${f}\`](./${f})${desc ? ` — ${desc}` : ''}`);
  }

  const deps = allFiles.filter((f) => !coreSet.has(f));
  if (deps.length > 0) {
    lines.push('', '## Dependencies (auto-resolved)', '');
    for (const f of deps) {
      const desc = extractDescription(path.resolve(SPEC_SRC, f));
      lines.push(`- [\`${f}\`](./${f})${desc ? ` — ${desc}` : ''}`);
    }
  }

  lines.push('');
  return lines.join('\n');
}

// ── Main ─────────────────────────────────────────────────────────────────────

function main() {
  console.log('🔗 Building skill Zod references...\n');

  let totalFiles = 0;

  for (const [skillName, coreFiles] of Object.entries(SKILL_MAP)) {
    const skillDir = path.resolve(SKILLS_DIR, skillName);
    if (!fs.existsSync(skillDir)) {
      console.warn(`⚠ Skill directory not found: ${skillName}, skipping`);
      continue;
    }

    console.log(`📦 ${skillName}`);

    // Resolve full dependency tree
    const allFiles = resolveAll(coreFiles);
    console.log(`   ${coreFiles.length} core + ${allFiles.length - coreFiles.length} deps = ${allFiles.length} files`);

    // Target directory — directly under references/ (no zod/ subdirectory)
    const refsDir = path.resolve(skillDir, 'references');

    // Clean previous generated files (preserve directory, remove .zod.ts and _index.md)
    if (fs.existsSync(refsDir)) {
      // Remove old zod/ subdirectory if it exists (migration from previous structure)
      const oldZodDir = path.resolve(refsDir, 'zod');
      if (fs.existsSync(oldZodDir)) {
        fs.rmSync(oldZodDir, { recursive: true });
      }
      // Remove generated category directories and _index.md
      for (const entry of fs.readdirSync(refsDir)) {
        const entryPath = path.resolve(refsDir, entry);
        const stat = fs.statSync(entryPath);
        if (stat.isDirectory() || entry === '_index.md') {
          fs.rmSync(entryPath, { recursive: true });
        }
      }
    }

    // Copy files preserving directory structure
    for (const rel of allFiles) {
      const src = path.resolve(SPEC_SRC, rel);
      const dest = path.resolve(refsDir, rel);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(src, dest);
    }

    // Generate _index.md
    const indexContent = generateIndex(skillName, coreFiles, allFiles);
    fs.writeFileSync(path.resolve(refsDir, '_index.md'), indexContent);

    totalFiles += allFiles.length;
  }

  console.log(`\n✅ Done — ${totalFiles} files copied across ${Object.keys(SKILL_MAP).length} skills`);
}

main();
