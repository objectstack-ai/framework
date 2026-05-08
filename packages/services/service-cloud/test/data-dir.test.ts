// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect } from 'vitest';
import { resolve as resolvePath } from 'node:path';
import {
    resolveDefaultDataDir,
    isServerlessReadOnlyFs,
    buildServerlessPersistenceError,
} from '../src/data-dir.js';

describe('resolveDefaultDataDir', () => {
    it('honours OS_DATA_DIR when set', () => {
        const dir = resolveDefaultDataDir({ OS_DATA_DIR: '/custom/path' });
        expect(dir).toBe(resolvePath('/custom/path'));
    });

    it('OS_DATA_DIR wins over serverless detection (escape hatch for EFS / mounted volumes)', () => {
        const dir = resolveDefaultDataDir({ OS_DATA_DIR: '/mnt/efs', VERCEL: '1' });
        expect(dir).toBe(resolvePath('/mnt/efs'));
    });

    it('defaults to <cwd>/.objectstack/data on a writable filesystem', () => {
        const dir = resolveDefaultDataDir({});
        expect(dir).toBe(resolvePath(process.cwd(), '.objectstack/data'));
    });

    it('throws on Vercel without OS_DATA_DIR — points at TURSO_DATABASE_URL', () => {
        expect(() => resolveDefaultDataDir({ VERCEL: '1' })).toThrowError(/TURSO_DATABASE_URL/);
    });

    it('throws on AWS Lambda without OS_DATA_DIR', () => {
        expect(() => resolveDefaultDataDir({ AWS_LAMBDA_FUNCTION_NAME: 'fn' })).toThrowError(
            /serverless read-only filesystem/,
        );
    });

    it('throws on Netlify without OS_DATA_DIR', () => {
        expect(() => resolveDefaultDataDir({ NETLIFY: 'true' })).toThrowError(/Netlify/);
    });

    it('throws when OS_READONLY_FS=1 escape hatch is set without OS_DATA_DIR', () => {
        expect(() => resolveDefaultDataDir({ OS_READONLY_FS: '1' })).toThrowError(
            /TURSO_DATABASE_URL/,
        );
    });

    it('error message mentions both URL and auth-token env vars and explains why /tmp is rejected', () => {
        try {
            resolveDefaultDataDir({ VERCEL: '1' });
            expect.fail('should have thrown');
        } catch (e: any) {
            expect(e.message).toMatch(/TURSO_DATABASE_URL/);
            expect(e.message).toMatch(/TURSO_AUTH_TOKEN/);
            expect(e.message).toMatch(/OS_CONTROL_DATABASE_URL/);
            expect(e.message).toMatch(/OS_DATA_DIR/);
            expect(e.message).toMatch(/per-instance|ephemeral/);
        }
    });
});

describe('isServerlessReadOnlyFs', () => {
    it('detects Vercel via VERCEL=1', () => {
        expect(isServerlessReadOnlyFs({ VERCEL: '1' })).toBe(true);
    });
    it('detects AWS Lambda via AWS_LAMBDA_FUNCTION_NAME', () => {
        expect(isServerlessReadOnlyFs({ AWS_LAMBDA_FUNCTION_NAME: 'fn' })).toBe(true);
    });
    it('detects Netlify via NETLIFY=true', () => {
        expect(isServerlessReadOnlyFs({ NETLIFY: 'true' })).toBe(true);
    });
    it('returns false for an empty environment', () => {
        expect(isServerlessReadOnlyFs({})).toBe(false);
    });
    it('respects the OS_READONLY_FS escape hatch', () => {
        expect(isServerlessReadOnlyFs({ OS_READONLY_FS: '1' })).toBe(true);
        expect(isServerlessReadOnlyFs({ OS_READONLY_FS: 'true' })).toBe(true);
        expect(isServerlessReadOnlyFs({ OS_READONLY_FS: '0' })).toBe(false);
    });
});

describe('buildServerlessPersistenceError', () => {
    it('control-plane variant mentions TURSO_DATABASE_URL', () => {
        expect(buildServerlessPersistenceError('control').message).toMatch(/TURSO_DATABASE_URL/);
    });
    it('project variant mentions OS_DATABASE_URL', () => {
        expect(buildServerlessPersistenceError('project').message).toMatch(/OS_DATABASE_URL/);
    });
});

