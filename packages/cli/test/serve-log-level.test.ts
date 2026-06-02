import { describe, expect, it } from 'vitest';
import { resolveLogLevel, LOG_LEVELS, DEFAULT_LOG_LEVEL } from '../src/utils/log-level.js';

describe('serve: resolveLogLevel', () => {
  it('defaults to warn (not silent) — the #1533 regression guard', () => {
    expect(DEFAULT_LOG_LEVEL).toBe('warn');
  });

  // Regression guard for #1533: the CLI must NOT silently default to
  // 'silent', or runtime flow/hook execution failures (logged at warn+)
  // are invisible, defeating ADR-0032's "fail loudly" promise.
  it('defaults to `warn` when nothing is set', () => {
    expect(resolveLogLevel({})).toBe('warn');
  });

  it('honors $OS_LOG_LEVEL / $LOG_LEVEL value', () => {
    expect(resolveLogLevel({ envLevel: 'info' })).toBe('info');
    expect(resolveLogLevel({ envLevel: 'silent' })).toBe('silent');
  });

  it('--log-level flag wins over the env value', () => {
    expect(resolveLogLevel({ flag: 'error', envLevel: 'info' })).toBe('error');
  });

  it('--verbose wins over everything and maps to `debug`', () => {
    expect(resolveLogLevel({ verbose: true, flag: 'error', envLevel: 'silent' })).toBe('debug');
  });

  it('is case-insensitive and trims surrounding whitespace', () => {
    expect(resolveLogLevel({ flag: '  DEBUG ' })).toBe('debug');
  });

  it('falls back to `warn` for an unrecognized level rather than throwing', () => {
    expect(resolveLogLevel({ envLevel: 'verbose' })).toBe('warn');
    expect(resolveLogLevel({ flag: 'loud' })).toBe('warn');
  });

  it('accepts every documented level verbatim', () => {
    for (const level of LOG_LEVELS) {
      expect(resolveLogLevel({ flag: level })).toBe(level);
    }
  });
});
