import { describe, expect, it } from 'vitest';
import { runMetadataEval, type MetadataEvalCase } from '../src/lint/metadata-eval';
import { DEFAULT_METADATA_EVAL_CORPUS } from '../src/lint/corpus';
import { scoreMetadata } from '../src/lint/score';

describe('runMetadataEval — offline (golden corpus)', () => {
  it('every golden fixture clears the quality bar', async () => {
    const report = await runMetadataEval(DEFAULT_METADATA_EVAL_CORPUS);
    expect(report.mode).toBe('offline');
    expect(report.total).toBe(DEFAULT_METADATA_EVAL_CORPUS.length);
    // Surface which case failed (if any) for a useful assertion message.
    const failures = report.results.filter((r) => !r.passed).map((r) => `${r.id}=${r.score.score}`);
    expect(failures).toEqual([]);
    expect(report.ok).toBe(true);
    expect(report.meanScore).toBeGreaterThanOrEqual(90);
  });

  it('each golden fixture is schema-valid with no errors', async () => {
    for (const c of DEFAULT_METADATA_EVAL_CORPUS) {
      const s = scoreMetadata(c.fixture);
      expect(s.counts.schemaErrors, `${c.id} schema`).toBe(0);
      expect(s.counts.errors, `${c.id} lint errors`).toBe(0);
    }
  });

  it('the corpus exercises the key conventions', () => {
    const ids = DEFAULT_METADATA_EVAL_CORPUS.map((c) => c.id);
    expect(ids).toContain('invoice_with_line_items');
    expect(ids).toContain('blog_post_with_comments'); // association (no inlineEdit)
    expect(ids).toContain('crm_account_with_contacts'); // lookup (independent)
  });
});

describe('runMetadataEval — live seam', () => {
  const oneCase: MetadataEvalCase[] = [
    { id: 'c1', prompt: 'invoice with lines', fixture: { manifest: { id: 'a', namespace: 'aa', version: '1.0.0', name: 'A', type: 'app' } } },
  ];

  it('scores the generated stack (not the fixture) when a generator is injected', async () => {
    // Generator returns a broken stack → the case fails under the rubric.
    const badGen = () => ({
      objects: [{ name: 'BadName', fields: { Status: { type: 'select' } } }],
    });
    const report = await runMetadataEval(oneCase, { generate: badGen });
    expect(report.mode).toBe('live');
    expect(report.results[0].source).toBe('generated');
    expect(report.results[0].passed).toBe(false);
    expect(report.ok).toBe(false);
  });

  it('a generator that produces a clean stack passes', async () => {
    const goodGen = () => ({
      objects: [
        // A "clean" stack declares OWD — the D7 security linter (ADR-0090)
        // errors on custom objects with an unset sharingModel.
        { name: 'invoice', label: 'Invoice', sharingModel: 'private', fields: { name: { type: 'text', label: 'Name', required: true } } },
        { name: 'invoice_line', label: 'Line', sharingModel: 'controlled_by_parent', fields: { invoice: { type: 'master_detail', label: 'Invoice', reference: 'invoice', required: true, deleteBehavior: 'cascade', inlineEdit: true }, amount: { type: 'currency', label: 'Amount', required: true } } },
      ],
    });
    const report = await runMetadataEval(oneCase, { generate: goodGen });
    expect(report.results[0].passed).toBe(true);
  });

  it('a generation error becomes a failed case (never throws)', async () => {
    const throwingGen = () => { throw new Error('model unavailable'); };
    const report = await runMetadataEval(oneCase, { generate: throwingGen });
    expect(report.results[0].passed).toBe(false);
    expect(report.results[0].generationError).toContain('model unavailable');
  });

  it('respects per-case minScore', async () => {
    const cases: MetadataEvalCase[] = [{ ...oneCase[0], minScore: 100 }];
    // The empty-ish fixture scores 100, so minScore 100 still passes offline.
    const report = await runMetadataEval(cases);
    expect(report.results[0].minScore).toBe(100);
  });
});
