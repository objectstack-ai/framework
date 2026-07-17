// Copyright (c) 2026 ObjectStack contributors. Apache-2.0 license.
//
// `os lint` platform-noise fold (15.1 third-party eval): a fresh scaffold
// reported 848 errors, all `i18n/missing-metadataForm` — keys expected by the
// static platform registries and already translated by the platform packages
// at runtime. They must not drown the user's own i18n signal: hidden by
// default, surfaced only under --include-platform, always counted.

import { describe, it, expect } from 'vitest';
import { foldCoverageIssues } from '../src/commands/lint';
import type { CoverageIssue } from '../src/utils/i18n-coverage';

const userIssue: CoverageIssue = {
  severity: 'error',
  locale: 'en',
  key: 'objects.blank_note.label',
  message: "Missing en translation for object 'blank_note' label",
  source: 'object',
};

const platformIssue: CoverageIssue = {
  severity: 'error',
  locale: 'en',
  key: 'metadataForms.email_template.fields.subject.label',
  message: 'Missing en translation for metadata form email_template',
  source: 'metadataForm',
};

describe('foldCoverageIssues', () => {
  it('hides platform metadata-form issues by default and counts them', () => {
    const { folded, hiddenPlatform } = foldCoverageIssues(
      [userIssue, platformIssue, { ...platformIssue, locale: 'zh-CN', severity: 'warning' }],
      false,
    );
    expect(hiddenPlatform).toBe(2);
    expect(folded).toHaveLength(1);
    expect(folded[0]).toMatchObject({
      severity: 'error',
      rule: 'i18n/missing-object',
      path: 'translations.en.objects.blank_note.label',
    });
  });

  it('keeps the user signal intact when nothing is platform-sourced', () => {
    const { folded, hiddenPlatform } = foldCoverageIssues([userIssue], false);
    expect(hiddenPlatform).toBe(0);
    expect(folded).toHaveLength(1);
  });

  it('surfaces everything under --include-platform', () => {
    const { folded, hiddenPlatform } = foldCoverageIssues(
      [userIssue, platformIssue],
      true,
    );
    expect(hiddenPlatform).toBe(0);
    expect(folded).toHaveLength(2);
    expect(folded.map((i) => i.rule).sort()).toEqual([
      'i18n/missing-metadataForm',
      'i18n/missing-object',
    ]);
    expect(folded[1].severity).toBe('error');
  });
});
