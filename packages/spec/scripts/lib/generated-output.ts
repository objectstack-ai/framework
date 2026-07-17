// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.
//
// Shared sink for generators that own files in the repo, so each can offer a
// trustworthy `--check` gate (the convention #3134 established in
// scripts/build-docs.ts, generalized).
//
// Every generated file goes through emit(), every regenerated folder through
// manageDir(). Nothing touches the output tree until flush(), so `--check` and a
// real write run execute byte-for-byte identical generation logic and differ
// only in the final disposition — write to disk, or compare against it. That
// shared path is what makes --check trustworthy: it cannot pass on output a real
// run wouldn't produce, because it *is* the real run minus the writes.
//
// Why not `git diff --exit-code`: that only sees tracked files, so a generator
// that should have deleted a page — or one that emits a brand-new untracked one
// — slips through. This compares the emitted tree against the disk directly.
//
// build-docs.ts still carries its own inline copy of this pattern; it predates
// the extraction and can migrate separately.

import fs from 'fs';
import path from 'path';

/** Would a real run delete this path? `relPath` is relative to the managed dir. */
export type DeletePredicate = (relPath: string) => boolean;

export interface FlushMessages {
  /** What the tree is, for the drift header — e.g. `skills/*​/references/_index.md`. */
  what: string;
  /** Plural noun for the success line — e.g. `skill reference indexes`. */
  noun: string;
  /** Shell lines that regenerate and stage the tree. */
  fix: string[];
}

export interface GeneratedOutput {
  /** Record intended content for a file. Nothing is written until flush(). */
  emit(filePath: string, content: string): void;
  /**
   * Declare a folder this generator regenerates. Anything on disk inside it that
   * `deletes` claims and this run didn't emit is stale — a real run would remove
   * it, so `--check` reports it. Defaults to a wholesale wipe.
   */
  manageDir(dir: string, deletes?: DeletePredicate): void;
  /** Did this run emit that file? Lets generation ask the sink, not the disk. */
  wasEmitted(filePath: string): boolean;
  /** How many files this run emitted. */
  readonly size: number;
  /** Write the emitted tree, or (in check mode) report how it differs. */
  flush(messages: FlushMessages): void;
}

function walk(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    return e.isDirectory() ? walk(full) : [full];
  });
}

/** A managed sub-folder is removed wholesale by a real run; deleting its files
 *  leaves the husk behind, so drop any directory left empty. */
function pruneEmptyDirs(dir: string): void {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const full = path.join(dir, entry.name);
    pruneEmptyDirs(full);
    if (fs.readdirSync(full).length === 0) fs.rmdirSync(full);
  }
}

export function createGeneratedOutput(opts: {
  repoRoot: string;
  check: boolean;
}): GeneratedOutput {
  const { repoRoot, check } = opts;

  /** Absolute path → intended content. */
  const emitted = new Map<string, string>();
  /** Absolute dir → predicate naming the paths a real run deletes. */
  const managedDirs = new Map<string, DeletePredicate>();

  const rel = (p: string) => path.relative(repoRoot, p);
  const wasEmitted = (filePath: string) => emitted.has(path.resolve(filePath));

  /** On-disk paths a real run deletes because this run didn't emit them. */
  const staleFiles = (): string[] => {
    const out: string[] = [];
    for (const [dir, deletes] of managedDirs) {
      for (const file of walk(dir)) {
        if (deletes(path.relative(dir, file)) && !wasEmitted(file)) out.push(file);
      }
    }
    return out;
  };

  return {
    emit(filePath, content) {
      emitted.set(path.resolve(filePath), content);
    },

    manageDir(dir, deletes = () => true) {
      managedDirs.set(path.resolve(dir), deletes);
    },

    wasEmitted,

    get size() {
      return emitted.size;
    },

    flush(messages) {
      if (!check) {
        for (const file of staleFiles()) {
          fs.rmSync(file);
          console.log(`✗ Removed stale ${rel(file)}`);
        }
        for (const dir of managedDirs.keys()) {
          if (fs.existsSync(dir)) pruneEmptyDirs(dir);
        }
        for (const [file, content] of emitted) {
          fs.mkdirSync(path.dirname(file), { recursive: true });
          fs.writeFileSync(file, content);
          console.log(`✓ Generated ${rel(file)}`);
        }
        console.log(`\n✅ Generated ${emitted.size} files`);
        return;
      }

      const changed: string[] = [];
      const added: string[] = [];
      for (const [file, content] of emitted) {
        if (!fs.existsSync(file)) added.push(rel(file));
        else if (fs.readFileSync(file, 'utf-8') !== content) changed.push(rel(file));
      }

      const drift = [
        ...added.map((f) => `  + ${f} (missing — a real run creates it)`),
        ...changed.map((f) => `  ~ ${f} (out of date)`),
        ...staleFiles().map((f) => `  - ${rel(f)} (stale — a real run deletes it)`),
      ];

      if (drift.length === 0) {
        console.log(`✅ ${emitted.size} ${messages.noun} in sync with packages/spec`);
        return;
      }

      console.error(
        `\n✗ ${messages.what} is out of date with packages/spec:\n\n` +
          drift.join('\n') +
          `\n\nThese files are GENERATED — do not hand-edit them. Regenerate and commit:\n\n` +
          messages.fix.map((l) => `  ${l}`).join('\n') +
          `\n`,
      );
      process.exit(1);
    },
  };
}
