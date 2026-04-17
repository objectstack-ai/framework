import { describe, it, expect } from 'vitest';
import { matchOriginPattern, createOriginMatcher, hasWildcardPattern, normalizeOriginPatterns } from './pattern-matcher';

describe('matchOriginPattern', () => {
    describe('exact matching', () => {
        it('should match exact origin', () => {
            expect(matchOriginPattern('https://app.example.com', 'https://app.example.com')).toBe(true);
        });

        it('should not match different origins', () => {
            expect(matchOriginPattern('https://app.example.com', 'https://api.example.com')).toBe(false);
        });

        it('should match wildcard "*"', () => {
            expect(matchOriginPattern('https://any.domain.com', '*')).toBe(true);
        });
    });

    describe('subdomain wildcard matching', () => {
        it('should match subdomain with wildcard pattern', () => {
            expect(matchOriginPattern('https://app.objectui.org', 'https://*.objectui.org')).toBe(true);
            expect(matchOriginPattern('https://api.objectui.org', 'https://*.objectui.org')).toBe(true);
            expect(matchOriginPattern('https://studio.objectui.org', 'https://*.objectui.org')).toBe(true);
        });

        it('should match multi-level subdomains', () => {
            expect(matchOriginPattern('https://app.dev.objectui.org', 'https://*.objectui.org')).toBe(true);
            expect(matchOriginPattern('https://api.staging.objectui.org', 'https://*.objectui.org')).toBe(true);
        });

        it('should not match different domain', () => {
            expect(matchOriginPattern('https://app.example.com', 'https://*.objectui.org')).toBe(false);
        });

        it('should not match different protocol', () => {
            expect(matchOriginPattern('http://app.objectui.org', 'https://*.objectui.org')).toBe(false);
        });
    });

    describe('port wildcard matching', () => {
        it('should match localhost with any port', () => {
            expect(matchOriginPattern('http://localhost:3000', 'http://localhost:*')).toBe(true);
            expect(matchOriginPattern('http://localhost:8080', 'http://localhost:*')).toBe(true);
            expect(matchOriginPattern('http://localhost:5173', 'http://localhost:*')).toBe(true);
        });

        it('should not match different host', () => {
            expect(matchOriginPattern('http://example.com:3000', 'http://localhost:*')).toBe(false);
        });
    });

    describe('multiple wildcard patterns', () => {
        it('should match wildcard in multiple positions', () => {
            expect(matchOriginPattern('https://app.objectui.org', 'https://*.objectui.*')).toBe(true);
            expect(matchOriginPattern('https://api.objectui.com', 'https://*.objectui.*')).toBe(true);
        });
    });
});

describe('createOriginMatcher', () => {
    describe('single pattern', () => {
        it('should create matcher for single string pattern', () => {
            const matcher = createOriginMatcher('https://*.objectui.org');

            expect(matcher('https://app.objectui.org')).toBe('https://app.objectui.org');
            expect(matcher('https://api.objectui.org')).toBe('https://api.objectui.org');
            expect(matcher('https://example.com')).toBe(null);
        });
    });

    describe('array of patterns', () => {
        it('should create matcher for array of patterns', () => {
            const matcher = createOriginMatcher([
                'https://*.objectui.org',
                'https://*.objectstack.ai'
            ]);

            expect(matcher('https://app.objectui.org')).toBe('https://app.objectui.org');
            expect(matcher('https://api.objectstack.ai')).toBe('https://api.objectstack.ai');
            expect(matcher('https://example.com')).toBe(null);
        });
    });

    describe('comma-separated patterns', () => {
        it('should parse comma-separated patterns', () => {
            const matcher = createOriginMatcher('https://*.objectui.org,https://*.objectstack.ai');

            expect(matcher('https://app.objectui.org')).toBe('https://app.objectui.org');
            expect(matcher('https://api.objectstack.ai')).toBe('https://api.objectstack.ai');
            expect(matcher('https://example.com')).toBe(null);
        });

        it('should handle whitespace in comma-separated patterns', () => {
            const matcher = createOriginMatcher('https://*.objectui.org, https://*.objectstack.ai , http://localhost:*');

            expect(matcher('https://app.objectui.org')).toBe('https://app.objectui.org');
            expect(matcher('https://api.objectstack.ai')).toBe('https://api.objectstack.ai');
            expect(matcher('http://localhost:3000')).toBe('http://localhost:3000');
            expect(matcher('https://example.com')).toBe(null);
        });
    });

    describe('mixed exact and wildcard patterns', () => {
        it('should match both exact and wildcard patterns', () => {
            const matcher = createOriginMatcher([
                'https://app.example.com',
                'https://*.objectui.org'
            ]);

            expect(matcher('https://app.example.com')).toBe('https://app.example.com');
            expect(matcher('https://dev.objectui.org')).toBe('https://dev.objectui.org');
            expect(matcher('https://other.com')).toBe(null);
        });
    });

    describe('localhost patterns', () => {
        it('should match localhost with port wildcard', () => {
            const matcher = createOriginMatcher('http://localhost:*');

            expect(matcher('http://localhost:3000')).toBe('http://localhost:3000');
            expect(matcher('http://localhost:8080')).toBe('http://localhost:8080');
            // 127.0.0.1 is also considered localhost and always allowed
            expect(matcher('http://127.0.0.1:3000')).toBe('http://127.0.0.1:3000');
        });

        it('should always allow localhost origins regardless of configured patterns', () => {
            // Even with a restrictive pattern, localhost should be allowed
            const matcher = createOriginMatcher('https://app.example.com');

            expect(matcher('http://localhost:3000')).toBe('http://localhost:3000');
            expect(matcher('http://localhost:5173')).toBe('http://localhost:5173');
            expect(matcher('https://localhost:8443')).toBe('https://localhost:8443');
            expect(matcher('http://localhost')).toBe('http://localhost');
            expect(matcher('http://127.0.0.1:3000')).toBe('http://127.0.0.1:3000');
            expect(matcher('http://[::1]:3000')).toBe('http://[::1]:3000');
            // Non-localhost should still be rejected
            expect(matcher('https://evil.com')).toBe(null);
        });
    });

    describe('empty origin handling', () => {
        it('should return null for empty request origin', () => {
            const matcher = createOriginMatcher('https://*.example.com');
            expect(matcher('')).toBe(null);
        });
    });
});

describe('hasWildcardPattern', () => {
    it('detects wildcards in a single string', () => {
        expect(hasWildcardPattern('https://*.example.com')).toBe(true);
        expect(hasWildcardPattern('https://example.com')).toBe(false);
    });

    it('detects wildcards in an array', () => {
        expect(hasWildcardPattern(['https://a.com', 'https://*.b.com'])).toBe(true);
        expect(hasWildcardPattern(['https://a.com', 'https://b.com'])).toBe(false);
    });
});

describe('normalizeOriginPatterns', () => {
    it('splits comma-separated strings and trims whitespace', () => {
        expect(normalizeOriginPatterns('a, b , c')).toEqual(['a', 'b', 'c']);
    });

    it('passes arrays through after trimming', () => {
        expect(normalizeOriginPatterns([' a ', 'b'])).toEqual(['a', 'b']);
    });

    it('drops empty entries', () => {
        expect(normalizeOriginPatterns('a,,b')).toEqual(['a', 'b']);
    });
});
