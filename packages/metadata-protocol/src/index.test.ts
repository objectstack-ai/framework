// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.
//
// Self-contained smoke for @objectstack/metadata-protocol: the package must
// import cleanly and expose its public surface without needing a data engine.
// (Protocol behavior is exercised end-to-end by the @objectstack/objectql suite,
// which injects a real engine.)

import { describe, it, expect } from 'vitest';
import {
  ObjectStackProtocolImplementation,
  ConcurrentUpdateError,
  normalizeViewMetadata,
  SysMetadataRepository,
  resetEnvWritableMetadataTypes,
  computeMetadataDiagnostics,
  computeViewReferenceDiagnostics,
  decorateMetadataItem,
  SeedLoaderService,
  runBuildProbes,
} from './index.js';

describe('@objectstack/metadata-protocol public surface', () => {
  it('exposes the protocol, repository, seed-loader and probe entry points', () => {
    expect(typeof ObjectStackProtocolImplementation).toBe('function');
    expect(typeof SysMetadataRepository).toBe('function');
    expect(typeof SeedLoaderService).toBe('function');
    expect(typeof runBuildProbes).toBe('function');
    expect(ConcurrentUpdateError.prototype).toBeInstanceOf(Error);
  });

  it('exposes pure metadata helpers', () => {
    expect(typeof normalizeViewMetadata).toBe('function');
    expect(typeof computeMetadataDiagnostics).toBe('function');
    expect(typeof computeViewReferenceDiagnostics).toBe('function');
    expect(typeof decorateMetadataItem).toBe('function');
    expect(typeof resetEnvWritableMetadataTypes).toBe('function');
  });

  it('normalizeViewMetadata passes a non-view item through without throwing', () => {
    const item = { name: 'acct', label: 'Account' };
    expect(() => normalizeViewMetadata('object', item, 'acct')).not.toThrow();
  });

  it('resetEnvWritableMetadataTypes is callable (state reset, no engine needed)', () => {
    expect(() => resetEnvWritableMetadataTypes()).not.toThrow();
  });
});
