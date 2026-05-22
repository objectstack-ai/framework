// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * PR-10d.1 — Hash-compat dry-run probe.
 *
 * Read-only probe that audits a snapshot of `sys_metadata` rows and asks:
 *
 *   1. Is every row's `metadata` column valid JSON?
 *   2. Is the parsed body an object (the shape SysMetadataRepository expects)?
 *   3. Does `hashSpec(body)` produce a stable hash across a serialize → parse
 *      round-trip? (If not, flipping the write path will produce different
 *      hashes on subsequent reads — silent corruption.)
 *   4. Are there any rows whose `(type, name, organization_id)` tuple is
 *      duplicated within the snapshot? (Would violate the overlay invariant
 *      once `SysMetadataRepository.put` enforces it.)
 *
 * Usage:
 *
 *   pnpm tsx packages/objectql/scripts/dry-run-hash-compat.ts <snapshot.json>
 *
 * Where `<snapshot.json>` is an array of rows in the shape of `MetadataRecord`,
 * obtained via `SELECT * FROM sys_metadata` (any driver) and exported as JSON.
 *
 * The script writes a structured report to stdout and exits 0 if the snapshot
 * is compatible, 1 otherwise. No database is touched.
 *
 * Pair this with the test in `dry-run-hash-compat.test.ts` which exercises
 * the probe against synthetic fixtures covering legacy edge cases.
 */

import { hashSpec } from '@objectstack/metadata-core';

export interface LegacyMetadataRow {
    id?: string;
    type?: string;
    name?: string;
    organization_id?: string | null;
    metadata?: string | null;
    state?: string;
    version?: number | null;
    [k: string]: unknown;
}

export interface RowFinding {
    row: { id?: string; type?: string; name?: string; organization_id?: string | null };
    severity: 'error' | 'warning';
    code:
        | 'invalid_json'
        | 'non_object_body'
        | 'unstable_hash'
        | 'missing_metadata'
        | 'duplicate_overlay_key';
    detail: string;
}

export interface DryRunReport {
    totalRows: number;
    okRows: number;
    findings: RowFinding[];
    typeDistribution: Record<string, number>;
    duplicateKeys: string[];
    compatible: boolean;
}

/**
 * Run the probe over an in-memory snapshot. Pure function — does no I/O.
 */
export function runDryRun(rows: LegacyMetadataRow[]): DryRunReport {
    const findings: RowFinding[] = [];
    const typeDistribution: Record<string, number> = {};
    const seen = new Map<string, LegacyMetadataRow>();
    const duplicateKeys = new Set<string>();
    let okRows = 0;

    for (const row of rows) {
        const tag = {
            id: row.id,
            type: row.type,
            name: row.name,
            organization_id: row.organization_id ?? null,
        };

        // 1. Missing metadata column.
        if (row.metadata == null) {
            findings.push({
                row: tag,
                severity: 'error',
                code: 'missing_metadata',
                detail: 'metadata column is null/undefined',
            });
            continue;
        }

        // 2. Invalid JSON.
        let body: unknown;
        try {
            body = JSON.parse(row.metadata);
        } catch (e) {
            findings.push({
                row: tag,
                severity: 'error',
                code: 'invalid_json',
                detail: `JSON.parse failed: ${(e as Error).message}`,
            });
            continue;
        }

        // 3. Body must be a plain object — SysMetadataRepository.put rejects
        //    arrays/primitives.
        if (body === null || typeof body !== 'object' || Array.isArray(body)) {
            findings.push({
                row: tag,
                severity: 'error',
                code: 'non_object_body',
                detail: `metadata body is ${Array.isArray(body) ? 'array' : typeof body}, not a plain object`,
            });
            continue;
        }

        // 4. Hash stability across serialize → parse round-trip. The repository
        //    will canonicalize on every put, so we must verify that
        //    hashSpec(JSON.parse(JSON.stringify(body))) === hashSpec(body)
        //    for every legacy row.
        let h1: string;
        let h2: string;
        try {
            h1 = hashSpec(body as Record<string, unknown>);
            const roundTrip = JSON.parse(JSON.stringify(body));
            h2 = hashSpec(roundTrip);
        } catch (e) {
            findings.push({
                row: tag,
                severity: 'error',
                code: 'unstable_hash',
                detail: `hashSpec threw: ${(e as Error).message}`,
            });
            continue;
        }
        if (h1 !== h2) {
            findings.push({
                row: tag,
                severity: 'error',
                code: 'unstable_hash',
                detail: `hash differs across round-trip: ${h1} vs ${h2}`,
            });
            continue;
        }

        // 5. Duplicate (type, name, organization_id) — would break the unique
        //    overlay invariant. Only count active rows.
        if (row.state === 'active' && row.type && row.name) {
            const key = `${row.type}|${row.name}|${row.organization_id ?? '__env__'}`;
            const prior = seen.get(key);
            if (prior) {
                duplicateKeys.add(key);
                findings.push({
                    row: tag,
                    severity: 'error',
                    code: 'duplicate_overlay_key',
                    detail: `duplicate active overlay key ${key} (conflicts with row id=${prior.id})`,
                });
                continue;
            }
            seen.set(key, row);
        }

        // 6. Distribution.
        if (row.type) {
            typeDistribution[row.type] = (typeDistribution[row.type] ?? 0) + 1;
        }
        okRows += 1;
    }

    return {
        totalRows: rows.length,
        okRows,
        findings,
        typeDistribution,
        duplicateKeys: Array.from(duplicateKeys),
        compatible: findings.every((f) => f.severity !== 'error'),
    };
}

/**
 * Pretty-print a report. Returns a multi-line string suitable for stdout.
 */
export function formatReport(report: DryRunReport): string {
    const lines: string[] = [];
    lines.push('# Hash-compat dry-run report');
    lines.push('');
    lines.push(`Total rows:        ${report.totalRows}`);
    lines.push(`OK rows:           ${report.okRows}`);
    lines.push(`Findings:          ${report.findings.length}`);
    lines.push(`Compatible:        ${report.compatible ? 'YES ✅' : 'NO ❌'}`);
    lines.push('');
    lines.push('## Type distribution');
    const types = Object.entries(report.typeDistribution).sort((a, b) => b[1] - a[1]);
    if (types.length === 0) lines.push('  (none)');
    for (const [t, n] of types) lines.push(`  ${t}: ${n}`);
    lines.push('');
    if (report.findings.length > 0) {
        lines.push('## Findings');
        for (const f of report.findings) {
            lines.push(
                `  [${f.severity}] ${f.code} — id=${f.row.id ?? '?'} type=${f.row.type ?? '?'} name=${f.row.name ?? '?'} org=${f.row.organization_id ?? 'null'}`,
            );
            lines.push(`        ${f.detail}`);
        }
        lines.push('');
    }
    if (report.duplicateKeys.length > 0) {
        lines.push('## Duplicate overlay keys');
        for (const k of report.duplicateKeys) lines.push(`  ${k}`);
        lines.push('');
    }
    return lines.join('\n');
}

// CLI entrypoint — only runs when invoked directly.
if (typeof process !== 'undefined' && process.argv[1] && /dry-run-hash-compat\.ts$/.test(process.argv[1])) {
    const path = process.argv[2];
    if (!path) {
        console.error('Usage: pnpm tsx packages/objectql/scripts/dry-run-hash-compat.ts <snapshot.json>');
        process.exit(2);
    }
    void (async () => {
        const fs = await import('node:fs/promises');
        const raw = await fs.readFile(path, 'utf8');
        const rows: LegacyMetadataRow[] = JSON.parse(raw);
        if (!Array.isArray(rows)) {
            console.error(`Snapshot at ${path} is not a JSON array.`);
            process.exit(2);
        }
        const report = runDryRun(rows);
        console.log(formatReport(report));
        process.exit(report.compatible ? 0 : 1);
    })();
}
