import { describe, it, expect } from 'vitest';
import { compileRoutePattern, matchesRoutePattern } from './route-pattern';

describe('compileRoutePattern', () => {
    it('compiles a literal path to an anchored regex', () => {
        const re = compileRoutePattern('/api/v1/meta');
        expect(re.test('/api/v1/meta')).toBe(true);
        expect(re.test('/api/v1/meta/view')).toBe(false);
        expect(re.test('/api/v1/metadata')).toBe(false);
    });

    it('matches a named param as a single segment', () => {
        const re = compileRoutePattern('/api/v1/meta/:type/:name');
        expect(re.test('/api/v1/meta/view/my_view')).toBe(true);
        // :name must not swallow an extra segment (that is /publish territory)
        expect(re.test('/api/v1/meta/view/my_view/publish')).toBe(false);
    });

    it('expands a trailing wildcard across segments', () => {
        const re = compileRoutePattern('/api/v1/auth/*');
        expect(re.test('/api/v1/auth/session')).toBe(true);
        expect(re.test('/api/v1/auth/oauth/callback/google')).toBe(true);
    });
});

describe('matchesRoutePattern', () => {
    it('ignores a single trailing slash on either side', () => {
        expect(matchesRoutePattern('/api/v1/meta/:type', '/api/v1/meta/view/')).toBe(true);
        expect(matchesRoutePattern('/api/v1/meta/:type/', '/api/v1/meta/view')).toBe(true);
    });

    it('does not match when a param segment is empty', () => {
        // POST /meta/view/?mode=draft — the :name segment is missing entirely
        expect(matchesRoutePattern('/api/v1/meta/:type/:name', '/api/v1/meta/view/')).toBe(false);
    });

    it('treats regex metacharacters in the pattern as literals', () => {
        expect(matchesRoutePattern('/api/v1/a.b', '/api/v1/a.b')).toBe(true);
        expect(matchesRoutePattern('/api/v1/a.b', '/api/v1/axb')).toBe(false);
    });
});
