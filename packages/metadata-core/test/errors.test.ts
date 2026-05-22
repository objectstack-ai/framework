// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect } from 'vitest';
import {
  ConflictError,
  NotFoundError,
  SchemaValidationError,
  BranchError,
  MetadataError,
} from '../src/errors.js';

const ref = {
  org: 'a', project: 'b', branch: 'main', type: 'view' as const, name: 'case',
};

describe('errors', () => {
  it('ConflictError carries ref + expected + actual', () => {
    const e = new ConflictError(ref, 'sha256:aaa', 'sha256:bbb');
    expect(e.code).toBe('METADATA_CONFLICT');
    expect(e.name).toBe('ConflictError');
    expect(e.ref.name).toBe('case');
    expect(e.expectedParent).toBe('sha256:aaa');
    expect(e.actualHead).toBe('sha256:bbb');
    expect(e instanceof MetadataError).toBe(true);
    expect(e instanceof Error).toBe(true);
  });

  it('ConflictError formats expectedParent=null as <none>', () => {
    const e = new ConflictError(ref, null, 'sha256:bbb');
    expect(e.message).toMatch(/<none>/);
  });

  it('NotFoundError', () => {
    const e = new NotFoundError(ref);
    expect(e.code).toBe('METADATA_NOT_FOUND');
    expect(e.name).toBe('NotFoundError');
  });

  it('SchemaValidationError carries issues', () => {
    const issues = [{ path: ['x'], message: 'required' }];
    const e = new SchemaValidationError(ref, issues);
    expect(e.code).toBe('METADATA_SCHEMA_INVALID');
    expect(e.issues).toEqual(issues);
  });

  it('BranchError', () => {
    const e = new BranchError('cannot merge into protected branch');
    expect(e.code).toBe('METADATA_BRANCH');
  });
});
