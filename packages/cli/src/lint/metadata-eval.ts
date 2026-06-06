// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Metadata-generation eval harness.
 *
 * Measures how well a stack of metadata follows the platform's modelling
 * conventions, using `scoreMetadata` (the linter-as-rubric) as the judge. Two
 * modes, same rubric:
 *
 *  - **Offline (default):** each case ships a golden fixture stack — the ideal
 *    output for its prompt. Scoring the fixtures is a deterministic regression
 *    guard: it proves the conventions + rubric stay self-consistent, runs in CI,
 *    and needs no API key.
 *
 *  - **Live (opt-in):** pass `generate(prompt, caseId) => stack`. The harness
 *    scores whatever the generator produced for each prompt instead of the
 *    fixture. Wire `generate` to `AIService.generateObject<SolutionBlueprint>`
 *    (+ blueprint→metadata expansion) to benchmark a real model against the
 *    same bar. The seam is injected so this package keeps no LLM dependency.
 */

import { scoreMetadata, type MetadataScore } from './score.js';

export interface MetadataEvalCase {
  /** Stable id (snake_case). */
  id: string;
  /** The natural-language authoring goal a generator would receive. */
  prompt: string;
  /** Golden/representative stack used in offline mode. */
  fixture: unknown;
  /** Minimum score to pass this case (defaults to the runner's `minScore`). */
  minScore?: number;
  /** Optional human note about what the case exercises. */
  note?: string;
}

export interface MetadataEvalCaseResult {
  id: string;
  prompt: string;
  /** True when the (generated or fixture) stack failed to materialize. */
  generationError?: string;
  score: MetadataScore;
  minScore: number;
  passed: boolean;
  /** 'fixture' offline, 'generated' when a live generator produced the stack. */
  source: 'fixture' | 'generated';
}

export interface MetadataEvalReport {
  results: MetadataEvalCaseResult[];
  total: number;
  passed: number;
  failed: number;
  /** Mean score across all cases (0–100, rounded). */
  meanScore: number;
  /** True when every case passed. */
  ok: boolean;
  mode: 'offline' | 'live';
}

export interface RunMetadataEvalOptions {
  /**
   * Live generator. When provided, the harness scores `generate(prompt, id)`
   * instead of the case fixture. Returning a rejected promise / throwing marks
   * that case as a generation error (failed).
   */
  generate?: (prompt: string, caseId: string) => unknown | Promise<unknown>;
  /** Default pass threshold for cases that don't set their own `minScore`. */
  minScore?: number;
}

const DEFAULT_MIN_SCORE = 75;

/**
 * Run the eval over a set of cases. Offline (fixtures) unless `generate` is
 * supplied. Never throws — generation failures become failed cases.
 */
export async function runMetadataEval(
  cases: MetadataEvalCase[],
  options: RunMetadataEvalOptions = {},
): Promise<MetadataEvalReport> {
  const defaultMin = options.minScore ?? DEFAULT_MIN_SCORE;
  const live = typeof options.generate === 'function';
  const results: MetadataEvalCaseResult[] = [];

  for (const c of cases) {
    const minScore = c.minScore ?? defaultMin;
    let stack: unknown = c.fixture;
    let generationError: string | undefined;
    let source: 'fixture' | 'generated' = 'fixture';

    if (live) {
      source = 'generated';
      try {
        stack = await options.generate!(c.prompt, c.id);
      } catch (err: any) {
        generationError = err?.message || String(err);
        stack = {};
      }
    }

    const score = scoreMetadata(stack);
    results.push({
      id: c.id,
      prompt: c.prompt,
      ...(generationError ? { generationError } : {}),
      score,
      minScore,
      passed: !generationError && score.score >= minScore && score.counts.errors === 0 && score.counts.schemaErrors === 0,
      source,
    });
  }

  const passed = results.filter((r) => r.passed).length;
  const meanScore = results.length
    ? Math.round(results.reduce((sum, r) => sum + r.score.score, 0) / results.length)
    : 0;

  return {
    results,
    total: results.length,
    passed,
    failed: results.length - passed,
    meanScore,
    ok: passed === results.length,
    mode: live ? 'live' : 'offline',
  };
}
