// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Route-path pattern matching, used to answer "does this concrete request
 * path correspond to a registered route pattern?" independent of HTTP method.
 *
 * This exists to support a proper `405 Method Not Allowed` response: Hono's
 * router treats a method mismatch the same as a missing route (both fall
 * through to `notFound`), so to distinguish "the path exists but the method is
 * wrong" from "the path doesn't exist at all" we re-match the request path
 * against the set of registered patterns ourselves.
 *
 * Supports the subset of Hono / Express path syntax the framework registers:
 * - `:param`   → a single non-empty path segment (`[^/]+`)
 * - `*`        → any remaining characters, including `/` (`.*`)
 * Everything else is treated as a literal and regex-escaped.
 */

/** Strip a single trailing slash so `/a/b` and `/a/b/` match the same pattern. */
function normalize(path: string): string {
    if (path.length > 1 && path.endsWith('/')) return path.slice(0, -1);
    return path;
}

/**
 * Compile a Hono-style route pattern into an anchored `RegExp` that matches a
 * concrete request path. Named params match one segment; `*` matches the rest.
 */
export function compileRoutePattern(pattern: string): RegExp {
    const regexBody = normalize(pattern)
        .split('/')
        .map((segment) => {
            if (segment.startsWith(':')) return '[^/]+';
            if (segment === '*') return '.*';
            // Escape regex metacharacters, then expand any inline `*` wildcard.
            return segment.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
        })
        .join('/');
    return new RegExp(`^${regexBody}$`);
}

/** True when `path` is matched by the compiled route `pattern`. */
export function matchesRoutePattern(pattern: string, path: string): boolean {
    return compileRoutePattern(pattern).test(normalize(path));
}
