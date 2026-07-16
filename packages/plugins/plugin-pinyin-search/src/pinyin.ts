// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Pinyin normalization for the `__search` companion column (#2486).
 *
 * One normalized blob per record — full pinyin AND initials in the same
 * column — so a single `$contains` recalls every latin input shape:
 *
 *   "张伟"  →  "zhangwei zw"
 *     `zhang` / `wei` / `zhangwei`  → substring of the full form
 *     `zw`                          → substring of the initials form
 *
 * `pinyin-pro` is loaded lazily on first use: non-Chinese deployments (flag
 * off → hooks never bound) never import it and pay zero cost.
 *
 * Polyphones: pinyin-pro's default heuristics are accepted (issue #2486
 * "待定" — surname polyphone dictionaries are a P2 follow-up).
 */

import { containsCJK } from '@objectstack/objectql';

type PinyinFn = (text: string, options?: Record<string, unknown>) => string | string[];

let _pinyin: Promise<PinyinFn> | null = null;

/** Lazy-load `pinyin-pro` (cached module-wide). */
function loadPinyin(): Promise<PinyinFn> {
  _pinyin ??= import('pinyin-pro').then((m: any) => (m.pinyin ?? m.default?.pinyin) as PinyinFn);
  return _pinyin;
}

/** Lowercase and strip everything that is not a latin letter or digit. */
function squash(syllables: string | string[]): string {
  const joined = Array.isArray(syllables) ? syllables.join('') : String(syllables ?? '');
  return joined.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

/**
 * Compute the companion value for the given source-field values.
 *
 * Returns the normalized blob (`"<full-pinyin> <initials>"`, deduplicated)
 * when at least one value contains CJK characters, else `null` — a `null`
 * companion means "nothing pinyin-searchable here" and clears any stale blob
 * when a name is edited away from CJK. Non-CJK values need no companion:
 * their source column already matches latin input directly.
 */
export async function computeSearchCompanionValue(values: ReadonlyArray<unknown>): Promise<string | null> {
  const cjkValues = values.filter((v): v is string => containsCJK(v));
  if (cjkValues.length === 0) return null;

  const pinyin = await loadPinyin();
  const parts: string[] = [];
  for (const value of cjkValues) {
    // `nonZh: 'consecutive'` keeps latin/digit runs intact inside mixed
    // values ("张伟2号" → "zhangwei2hao"), so mixed names stay one token.
    const full = squash(pinyin(value, { toneType: 'none', type: 'array', nonZh: 'consecutive' }));
    const initials = squash(pinyin(value, { pattern: 'first', toneType: 'none', type: 'array', nonZh: 'consecutive' }));
    if (full) parts.push(full);
    if (initials && initials !== full) parts.push(initials);
  }
  if (parts.length === 0) return null;
  return [...new Set(parts)].join(' ');
}
