// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Unit tests for the public marketplace URL resolver and API-path-to-key
 * mapper. The mapper is the single source of truth for the snapshot
 * keyspace used by both the framework consumer (this file) and the
 * cloud snapshot writer (cloud/packages/service-cloud/src/marketplace-snapshot.ts).
 * Any change here must match there.
 */

import { describe, it, expect, afterEach } from 'vitest';
import {
    resolveMarketplacePublicBaseUrl,
    publicMarketplaceKeyForApiPath,
} from './marketplace-public-url.js';

describe('resolveMarketplacePublicBaseUrl', () => {
    const original = process.env.OS_MARKETPLACE_PUBLIC_BASE_URL;
    afterEach(() => {
        if (original === undefined) delete process.env.OS_MARKETPLACE_PUBLIC_BASE_URL;
        else process.env.OS_MARKETPLACE_PUBLIC_BASE_URL = original;
    });

    it('returns empty when env unset (legacy cloud-proxy fallback)', () => {
        delete process.env.OS_MARKETPLACE_PUBLIC_BASE_URL;
        expect(resolveMarketplacePublicBaseUrl()).toBe('');
    });

    it('returns empty for explicit disable values', () => {
        for (const v of ['off', 'none', 'disabled', 'false', 'OFF']) {
            process.env.OS_MARKETPLACE_PUBLIC_BASE_URL = v;
            expect(resolveMarketplacePublicBaseUrl()).toBe('');
        }
    });

    it('strips trailing slashes', () => {
        process.env.OS_MARKETPLACE_PUBLIC_BASE_URL = 'https://marketplace.objectos.app///';
        expect(resolveMarketplacePublicBaseUrl()).toBe('https://marketplace.objectos.app');
    });

    it('explicit constructor argument wins over env', () => {
        process.env.OS_MARKETPLACE_PUBLIC_BASE_URL = 'https://env.example';
        expect(resolveMarketplacePublicBaseUrl('https://explicit.example/'))
            .toBe('https://explicit.example');
    });

    it('explicit "off" overrides env', () => {
        process.env.OS_MARKETPLACE_PUBLIC_BASE_URL = 'https://env.example';
        expect(resolveMarketplacePublicBaseUrl('off')).toBe('');
    });
});

describe('publicMarketplaceKeyForApiPath', () => {
    it('maps the bare list path', () => {
        expect(publicMarketplaceKeyForApiPath('/api/v1/marketplace/packages'))
            .toBe('packages.json');
    });

    it('maps per-package detail', () => {
        expect(publicMarketplaceKeyForApiPath('/api/v1/marketplace/packages/pkg_abc'))
            .toBe('packages/pkg_abc.json');
    });

    it('URL-encodes id segments safely', () => {
        // ids with reserved characters get re-encoded — never crosses
        // into a different snapshot key by accident.
        expect(publicMarketplaceKeyForApiPath('/api/v1/marketplace/packages/com.acme%2Fcrm'))
            .toBe('packages/com.acme%2Fcrm.json');
    });

    it('maps per-version manifest', () => {
        expect(publicMarketplaceKeyForApiPath('/api/v1/marketplace/packages/p1/versions/v1/manifest'))
            .toBe('packages/p1/versions/v1/manifest.json');
    });

    it('maps latest alias', () => {
        expect(publicMarketplaceKeyForApiPath('/api/v1/marketplace/packages/p1/versions/latest/manifest'))
            .toBe('packages/p1/versions/latest/manifest.json');
    });

    it('returns null for non-snapshot-backed paths', () => {
        for (const p of [
            '/api/v1/marketplace/packages/p1/versions/v1', // missing /manifest
            '/api/v1/marketplace/packages/p1/extras',     // unknown segment
            '/api/v1/marketplace/install-local',
            '/api/v1/marketplace/featured',
            '/api/v1/other',
            '/api/v1/marketplace/packagesextra',          // boundary check
        ]) {
            expect(publicMarketplaceKeyForApiPath(p)).toBeNull();
        }
    });
});
