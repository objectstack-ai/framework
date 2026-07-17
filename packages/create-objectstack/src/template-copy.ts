// Copyright (c) 2026 ObjectStack contributors. Apache-2.0 license.
//
// Materializes a bundled template onto disk. Kept out of index.ts because that
// module calls `program.parse()` on import — anything a test needs must be
// importable without running the CLI.

import fs from 'node:fs';
import path from 'node:path';

/**
 * Template files committed under a placeholder name, mapped to the name they
 * must land under in a scaffolded project.
 *
 * `npm pack` / `pnpm pack` strip `.gitignore` (and `.npmrc`) from a tarball
 * unconditionally, at every depth — so a template dotfile committed under its
 * real name never reaches the registry. `src/templates/blank/.gitignore` was
 * copied to `dist/templates/blank/.gitignore` by the build and then dropped at
 * publish, and every project scaffolded from the published package came out
 * with no `.gitignore` at all, leaving `node_modules/` and the `.env` the
 * README tells users to fill with secrets un-ignored (#3120).
 *
 * The strip list is not "every dotfile": `.dockerignore` packs fine and stays
 * literal. Don't add entries by guesswork — the packing ratchet in
 * `template-consistency.test.ts` packs the real package and fails with the
 * required alias if a template file goes missing from the tarball.
 */
export const TEMPLATE_FILE_ALIASES = new Map<string, string>([
  ['_gitignore', '.gitignore'],
]);

/**
 * Recursively copy `src` onto `dest`, restoring aliased filenames, pushing the
 * project-relative path of every written file onto `collected`.
 */
export function copyDir(src: string, dest: string, collected: string[], rel = '') {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const outName = entry.isFile()
      ? (TEMPLATE_FILE_ALIASES.get(entry.name) ?? entry.name)
      : entry.name;
    const destPath = path.join(dest, outName);
    const relPath = rel ? `${rel}/${outName}` : outName;
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath, collected, relPath);
    } else if (entry.isFile()) {
      fs.copyFileSync(srcPath, destPath);
      collected.push(relPath);
    }
  }
}
