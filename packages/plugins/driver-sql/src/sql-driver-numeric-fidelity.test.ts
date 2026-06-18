// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Scalar field types must round-trip with TYPE fidelity, not just value
 * survival. Regression (#field-zoo): `rating`/`slider`/`toggle`/`progress`
 * were absent from the DDL column-type switch, so they fell to
 * `default → table.string` and got TEXT affinity — SQLite then coerced the
 * written number/boolean to a string ('4' not 4, '1' not true). The value
 * persisted, so value-loss tests stayed green; only the JS type leaked, which
 * is a runtime-fidelity trap on a low-code platform where an AI authors
 * arbitrary field types.
 *
 * The fix maps `rating`/`slider`/`progress` to a REAL (numeric) column and
 * `toggle` to a boolean column + the `booleanFields` read-coercion registry,
 * and folds the object-valued `record`/`video`/`audio` into the shared
 * `JSON_COLUMN_TYPES` source so they store/parse as JSON like `composite`.
 *
 * `number`/`currency`/`percent`/`boolean` are included as the working control:
 * the SAME harness must keep returning them with correct types.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SqlDriver } from '../src/index.js';

describe('SqlDriver scalar type fidelity (rating/slider/toggle/progress)', () => {
  let driver: SqlDriver;

  beforeEach(async () => {
    driver = new SqlDriver({
      client: 'better-sqlite3',
      connection: { filename: ':memory:' },
      useNullAsDefault: true,
    });
    await driver.initObjects([
      {
        name: 'zoo',
        fields: {
          name: { type: 'string' },
          // control — these already round-tripped with correct types
          f_number: { type: 'number' },
          f_currency: { type: 'currency' },
          f_percent: { type: 'percent' },
          f_boolean: { type: 'boolean' },
          // the leak: numeric scalars that used to land as TEXT
          f_rating: { type: 'rating', max: 5 },
          f_slider: { type: 'slider', min: 0, max: 100, step: 5 },
          f_progress: { type: 'progress', min: 0, max: 100 },
          // the leak: a switch-rendered boolean
          f_toggle: { type: 'toggle' },
          // object-valued types folded into JSON_COLUMN_TYPES
          f_record: { type: 'record' },
          f_video: { type: 'video' },
          f_audio: { type: 'audio' },
        },
      },
    ]);
  });

  afterEach(async () => {
    await driver.disconnect();
  });

  it('round-trips numeric scalars as numbers, not strings', async () => {
    await driver.create(
      'zoo',
      {
        id: 'z1',
        name: 'Specimen',
        f_number: 42,
        f_currency: 1234.56,
        f_percent: 75,
        f_rating: 4,
        f_slider: 25,
        f_progress: 60,
      },
      { bypassTenantAudit: true },
    );
    const row = await driver.findOne('zoo', 'z1', { bypassTenantAudit: true });

    // control
    expect(row.f_number).toBe(42);
    expect(row.f_currency).toBeCloseTo(1234.56, 5);
    expect(row.f_percent).toBe(75);

    // the fix: these used to come back as '4' / '25' / '60'
    expect(typeof row.f_rating).toBe('number');
    expect(row.f_rating).toBe(4);
    expect(typeof row.f_slider).toBe('number');
    expect(row.f_slider).toBe(25);
    expect(typeof row.f_progress).toBe('number');
    expect(row.f_progress).toBe(60);
  });

  it('round-trips toggle as a boolean, not 1/0 or a string', async () => {
    await driver.create('zoo', { id: 'z2', name: 'B', f_boolean: true, f_toggle: true }, { bypassTenantAudit: true });
    await driver.create('zoo', { id: 'z3', name: 'C', f_boolean: false, f_toggle: false }, { bypassTenantAudit: true });

    const on = await driver.findOne('zoo', 'z2', { bypassTenantAudit: true });
    const off = await driver.findOne('zoo', 'z3', { bypassTenantAudit: true });

    // control
    expect(on.f_boolean).toBe(true);
    expect(off.f_boolean).toBe(false);

    // the fix: toggle used to come back as '1' / '0'
    expect(typeof on.f_toggle).toBe('boolean');
    expect(on.f_toggle).toBe(true);
    expect(typeof off.f_toggle).toBe('boolean');
    expect(off.f_toggle).toBe(false);
  });

  it('round-trips object-valued record/video/audio as objects, not strings', async () => {
    await driver.create(
      'zoo',
      {
        id: 'z4',
        name: 'D',
        f_record: { home: '+1', work: '+2' },
        f_video: { url: 'https://cdn/v.mp4', duration: 12 },
        f_audio: { url: 'https://cdn/a.mp3', duration: 30 },
      },
      { bypassTenantAudit: true },
    );
    const row = await driver.findOne('zoo', 'z4', { bypassTenantAudit: true });

    expect(row.f_record).toEqual({ home: '+1', work: '+2' });
    expect(row.f_video).toEqual({ url: 'https://cdn/v.mp4', duration: 12 });
    expect(row.f_audio).toEqual({ url: 'https://cdn/a.mp3', duration: 30 });
  });
});
