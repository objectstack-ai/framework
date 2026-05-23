// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Format an ISO timestamp as a human-readable relative time
 * ("5m ago", "3d ago", "2026-04-13" for older dates).
 */
export function formatRelative(iso: string | undefined | null): string {
  if (!iso) return '';
  try {
    const then = new Date(iso).getTime();
    if (Number.isNaN(then)) return '';
    const diffSec = Math.round((Date.now() - then) / 1000);
    if (diffSec < 5) return 'just now';
    if (diffSec < 60) return `${diffSec}s ago`;
    const diffMin = Math.round(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.round(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.round(diffHr / 24);
    if (diffDay < 30) return `${diffDay}d ago`;
    return new Date(iso).toLocaleDateString();
  } catch {
    return '';
  }
}
