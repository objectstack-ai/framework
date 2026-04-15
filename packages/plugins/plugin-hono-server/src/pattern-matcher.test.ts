import { describe, it, expect } from 'vitest';

/**
 * Check if an origin matches a pattern with wildcards.
 * Supports patterns like:
 * - "https://*.example.com" - matches any subdomain
 * - "http://localhost:*" - matches any port
 * - "https://*.objectui.org,https://*.objectstack.ai" - comma-separated patterns
 *
 * @param origin The origin to check (e.g., "https://app.example.com")
 * @param pattern The pattern to match against (supports * wildcard)
 * @returns true if origin matches the pattern
 */
function matchOriginPattern(origin: string, pattern: string): boolean {
    if (pattern === '*') return true;
    if (pattern === origin) return true;

    // Convert wildcard pattern to regex
    // Escape special regex characters except *
    const regexPattern = pattern
        .replace(/[.+?^${}()|[\]\\]/g, '\\$&')  // Escape special chars
        .replace(/\*/g, '.*');                    // Convert * to .*

    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(origin);
}

/**
 * Create a CORS origin matcher function that supports wildcard patterns.
 *
 * @param patterns Single pattern, array of patterns, or comma-separated patterns
 * @returns Function that returns the origin if it matches, or null/undefined
 */
function createOriginMatcher(
    patterns: string | string[]
): (origin: string) => string | undefined | null {
    // Normalize to array
    let patternList: string[];
    if (typeof patterns === 'string') {
        // Handle comma-separated patterns
        patternList = patterns.includes(',')
            ? patterns.split(',').map(s => s.trim()).filter(Boolean)
            : [patterns];
    } else {
        patternList = patterns;
    }

    // Return matcher function
    return (requestOrigin: string) => {
        for (const pattern of patternList) {
            if (matchOriginPattern(requestOrigin, pattern)) {
                return requestOrigin;
            }
        }
        return null;
    };
}

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
            expect(matcher('http://127.0.0.1:3000')).toBe(null);
        });
    });
});
