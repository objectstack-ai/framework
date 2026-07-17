// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Build Skill References
 *
 * Generates an `_index.md` file per skill that points to Zod schema source
 * files inside the consumer's `node_modules/@objectstack/spec/src/`.
 *
 * Skills do NOT bundle copies of the schemas — when a skill is installed
 * into a metadata-driven project (e.g. via skills.sh), `@objectstack/spec`
 * is always present as a dependency. Pointing at the published source files
 * keeps a single source of truth and stays version-aligned automatically.
 *
 * The script:
 * 1. Reads a declarative mapping of { skill → core zod files }
 * 2. Recursively resolves local `import … from` dependencies (so the index
 *    surfaces shared schemas an agent will need to follow)
 * 3. Writes `skills/{name}/references/_index.md` with pointers + one-line
 *    descriptions extracted from each file's leading JSDoc comment
 *
 * `skills/` is published to third parties (`npx skills add … --all`), so stale
 * output here ships to users — `--check` gates it in CI.
 *
 * Usage:
 *   tsx scripts/build-skill-references.ts            # write
 *   tsx scripts/build-skill-references.ts --check    # verify in sync (CI); exit 1 on drift
 */

import fs from 'fs';
import path from 'path';
import { createGeneratedOutput } from './lib/generated-output';

// ── Paths ────────────────────────────────────────────────────────────────────

const REPO_ROOT = path.resolve(__dirname, '../../..');
const SPEC_SRC = path.resolve(__dirname, '../src');
const SKILLS_DIR = path.resolve(REPO_ROOT, 'skills');
const SPEC_PKG = '@objectstack/spec';

const CHECK = process.argv.includes('--check');

// ── Skill → Zod file mapping ────────────────────────────────────────────────
// Paths are relative to packages/spec/src/ (category/file.zod.ts)

const SKILL_MAP: Record<string, string[]> = {
  'objectstack-data': [
    'data/field.zod.ts',
    'data/object.zod.ts',
    'data/validation.zod.ts',
    'data/hook.zod.ts',
    'data/datasource.zod.ts',
    'data/seed.zod.ts',
    'security/permission.zod.ts',
  ],
  'objectstack-query': [
    'data/query.zod.ts',
    'data/filter.zod.ts',
  ],
  'objectstack-ai': [
    'ai/agent.zod.ts',
    'ai/tool.zod.ts',
    'ai/skill.zod.ts',
    'ai/model-registry.zod.ts',
    'ai/conversation.zod.ts',
    'ai/mcp.zod.ts',
    'ai/embedding.zod.ts',
    'ai/usage.zod.ts',
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
  'objectstack-platform': [
    // project setup (was objectstack-quickstart)
    'kernel/manifest.zod.ts',
    'data/datasource.zod.ts',
    'data/seed.zod.ts',
    // plugin development (was objectstack-plugin)
    'kernel/plugin.zod.ts',
    'kernel/context.zod.ts',
    'kernel/service-registry.zod.ts',
    'kernel/plugin-lifecycle-events.zod.ts',
    'kernel/plugin-capability.zod.ts',
    'kernel/plugin-loading.zod.ts',
    'kernel/feature.zod.ts',
    'kernel/metadata-plugin.zod.ts',
  ],
  'objectstack-i18n': [
    'system/translation.zod.ts',
    'ui/i18n.zod.ts',
  ],
};

// ── Import resolver ──────────────────────────────────────────────────────────

function extractLocalImports(filePath: string): string[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const imports: string[] = [];
  const re = /^import\s+.*\s+from\s+['"](\.[^'"]+)['"]/gm;
  let match: RegExpExecArray | null;
  while ((match = re.exec(content)) !== null) {
    const importSpec = match[1];
    const dir = path.dirname(filePath);
    let resolved = path.resolve(dir, importSpec);
    if (!resolved.endsWith('.ts')) resolved += '.ts';
    if (fs.existsSync(resolved)) {
      imports.push(path.relative(SPEC_SRC, resolved));
    }
  }
  return imports;
}

function resolveAll(skillName: string, entryFiles: string[]): string[] {
  const visited = new Set<string>();
  const queue = [...entryFiles];
  while (queue.length > 0) {
    const relPath = queue.shift()!;
    if (visited.has(relPath)) continue;
    const abs = path.resolve(SPEC_SRC, relPath);
    // Only SKILL_MAP entries can miss here — transitive deps are already
    // existence-filtered in extractLocalImports — so this is always a stale
    // hand-authored mapping. Fatal, not a warning: warn-and-skip silently
    // dropped the seed schema from two published skills across the
    // dataset.zod.ts → seed.zod.ts rename, and stayed green doing it.
    if (!fs.existsSync(abs)) {
      console.error(
        `\n✗ SKILL_MAP[${skillName}] points at a file that does not exist: ${relPath}\n` +
          `  Expected ${rel(path.resolve(SPEC_SRC, relPath))} — it was probably renamed or removed.\n` +
          `  Update SKILL_MAP in ${rel(__filename)}.\n`,
      );
      process.exit(1);
    }
    visited.add(relPath);
    for (const dep of extractLocalImports(abs)) {
      if (!visited.has(dep)) queue.push(dep);
    }
  }
  return [...visited].sort();
}

// ── JSDoc description extractor ──────────────────────────────────────────────

function extractDescription(filePath: string): string {
  const content = fs.readFileSync(filePath, 'utf-8');
  const jsdocMatch = content.match(/\/\*\*\s*\n([\s\S]*?)\*\//);
  if (jsdocMatch) {
    const lines = jsdocMatch[1]
      .split('\n')
      .map((line) => line.replace(/^\s*\*\s?/, '').trim())
      .filter((line) => line && !line.startsWith('@') && !line.startsWith('```'));
    const firstLine = lines[0];
    if (firstLine && firstLine.length > 5) {
      const clean = firstLine.replace(/^#+\s*/, '');
      const sentence = clean.split(/\.\s/)[0];
      return sentence.length > 120 ? sentence.slice(0, 117) + '...' : sentence;
    }
  }
  const exports: string[] = [];
  const re = /export\s+const\s+(\w+Schema|\w+)\s*(?:[:=])/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) exports.push(m[1]);
  if (exports.length > 0) return `Exports: ${exports.slice(0, 5).join(', ')}`;
  return '';
}

// ── Index generator ──────────────────────────────────────────────────────────

function pointerPath(rel: string): string {
  return `node_modules/${SPEC_PKG}/src/${rel}`;
}

function generateIndex(skillName: string, coreFiles: string[], allFiles: string[]): string {
  const coreSet = new Set(coreFiles);
  const lines: string[] = [
    `# ${skillName} — Schema References`,
    '',
    '> **Auto-generated** by `packages/spec/scripts/build-skill-references.ts`.',
    `> Do not edit — re-run \`pnpm --filter ${SPEC_PKG} run gen:skill-refs\` to update.`,
    '',
    `Schemas live in the published \`${SPEC_PKG}\` package. Read them directly`,
    'from `node_modules` — there is no local copy in the skill bundle.',
    '',
    '## Core schemas',
    '',
  ];

  for (const f of allFiles.filter((f) => coreSet.has(f))) {
    const desc = extractDescription(path.resolve(SPEC_SRC, f));
    lines.push(`- \`${pointerPath(f)}\`${desc ? ` — ${desc}` : ''}`);
  }

  const deps = allFiles.filter((f) => !coreSet.has(f));
  if (deps.length > 0) {
    lines.push('', '## Transitive dependencies', '');
    for (const f of deps) {
      const desc = extractDescription(path.resolve(SPEC_SRC, f));
      lines.push(`- \`${pointerPath(f)}\`${desc ? ` — ${desc}` : ''}`);
    }
  }

  lines.push(
    '',
    '## How to read these',
    '',
    `1. The schemas are runtime Zod definitions. Use \`Read\` on the absolute`,
    `   path under \`node_modules/${SPEC_PKG}/src/\` to inspect field shapes,`,
    `   \`.describe()\` text, enums, and refinements.`,
    `2. TypeScript types: \`import type { … } from '${SPEC_PKG}'\` (or the`,
    '   matching subpath export).',
    '3. Runtime values: `import { … } from \'' + SPEC_PKG + '\'` — the package',
    '   re-exports every schema and helper.',
    '',
  );

  return lines.join('\n');
}

// ── Output sink ──────────────────────────────────────────────────────────────

const out = createGeneratedOutput({ repoRoot: REPO_ROOT, check: CHECK });
const rel = (p: string) => path.relative(REPO_ROOT, p);

/**
 * What a real run removes from a skill's `references/` folder. Hand-written
 * markdown alongside `_index.md` is deliberately preserved — `data-hooks.md`,
 * `plugin-hooks.md`, and `react-blocks.md` (which build-react-blocks-contract.ts
 * owns) all live here — so this is a selective wipe, not a wholesale one.
 */
function refsDirDeletes(relPath: string): boolean {
  // Nested → lives in a sub-folder a real run removes wholesale.
  if (relPath.includes(path.sep)) return true;
  return relPath === '_index.md' || relPath.endsWith('.zod.ts');
}

// ── Main ─────────────────────────────────────────────────────────────────────

function main() {
  console.log(`🔗 ${CHECK ? 'Checking' : 'Building'} skill schema reference indexes...\n`);

  for (const [skillName, coreFiles] of Object.entries(SKILL_MAP)) {
    const skillDir = path.resolve(SKILLS_DIR, skillName);
    // A mapped skill that isn't on disk means SKILL_MAP lies. Skipping it would
    // silently ship a skill with no schema index (and leave --check green), so
    // fail instead — same reasoning as the missing-file check in resolveAll.
    if (!fs.existsSync(skillDir)) {
      console.error(
        `\n✗ SKILL_MAP names a skill with no directory: ${skillName}\n` +
          `  Expected ${rel(skillDir)}. Update SKILL_MAP in ${rel(__filename)}.\n`,
      );
      process.exit(1);
    }

    if (!CHECK) console.log(`📦 ${skillName}`);
    const allFiles = resolveAll(skillName, coreFiles);
    if (!CHECK) console.log(`   ${coreFiles.length} core + ${allFiles.length - coreFiles.length} deps`);

    const refsDir = path.resolve(skillDir, 'references');
    out.manageDir(refsDir, refsDirDeletes);
    out.emit(path.resolve(refsDir, '_index.md'), generateIndex(skillName, coreFiles, allFiles));
  }

  // A run that mapped no skills emits nothing, and "nothing differs" would read
  // as success — the gate would pass while checking no skills at all. Fail
  // loudly instead of greenly.
  if (out.size === 0) {
    console.error(
      `\n✗ No skill reference indexes generated — nothing to ${CHECK ? 'check' : 'write'}.\n` +
        `  SKILL_MAP is empty, or ${rel(SKILLS_DIR)} is missing.\n`,
    );
    process.exit(1);
  }

  out.flush({
    what: 'skills/*/references/_index.md',
    noun: 'skill reference indexes',
    fix: [`pnpm --filter ${SPEC_PKG} gen:skill-refs`, 'git add skills'],
  });
}

main();
