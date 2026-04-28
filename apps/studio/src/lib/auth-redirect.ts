// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Cross-SPA auth redirect helpers.
 *
 * Studio defers all sign-in / sign-up UI to the Account SPA mounted at
 * `/_account/`. These helpers build absolute URLs preserving the original
 * Studio location so the user lands back where they started after auth.
 */

const ACCOUNT_BASE = '/_account';

/** Compose a Studio absolute path from `pathname + search`. */
function currentStudioHref(): string {
  if (typeof window === 'undefined') return '/';
  return window.location.pathname + window.location.search;
}

/**
 * Hard-navigate the browser to the Account login page, preserving the
 * current Studio path as `?redirect=...`.
 */
export function gotoAccountLogin(redirect?: string): void {
  const target = redirect ?? currentStudioHref();
  const url = `${ACCOUNT_BASE}/login?redirect=${encodeURIComponent(target)}`;
  window.location.assign(url);
}

/** Hard-navigate to a path under the Account SPA (e.g. `/account`, `/organizations`). */
export function gotoAccount(path: string): void {
  const clean = path.startsWith('/') ? path : `/${path}`;
  window.location.assign(`${ACCOUNT_BASE}${clean}`);
}
