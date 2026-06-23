// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Normalise a builtin `created_at` / `updated_at` value to epoch milliseconds.
 *
 * Those two columns are provisioned as native `TIMESTAMP` columns by the SQL
 * driver (Postgres/MySQL), so the outboxes WRITE them as `Date`s — never a bare
 * epoch-ms number, which a real timestamp column rejects (the bug that broke the
 * `sys_notification_delivery` retention sweep on Postgres). The read-back form is
 * therefore dialect-dependent: epoch-ms on SQLite, a `Date` (or ISO string) on
 * Postgres. This collapses all of those back to epoch-ms so the outbox record
 * contract (`createdAt` / `updatedAt: number`) stays driver-independent.
 */
export function toEpochMs(value: unknown): number {
    if (typeof value === 'number') return value;
    if (value instanceof Date) return value.getTime();
    if (typeof value === 'string') {
        const parsed = Date.parse(value);
        if (Number.isFinite(parsed)) return parsed;
        const numeric = Number(value);
        if (Number.isFinite(numeric)) return numeric;
    }
    return 0;
}
