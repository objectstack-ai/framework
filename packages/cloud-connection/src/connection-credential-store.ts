// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * ConnectionCredentialStore — where a SELF-HOSTED runtime keeps the
 * credential it received at bind time (cloud ADR-0008 consumption side).
 *
 * Cloud-hosted runtimes authenticate to the control plane with an
 * env→cloud service key (`OS_CLOUD_API_KEY`, injected by the cloud).
 * Self-hosted runtimes have no such key: their identity ceremony is the
 * RFC 8628 device-code bind, whose response carries a one-time
 * `runtime_token` (`oscc_…`). This store persists that bearer — plus the
 * environment id the binding established — under the runtime's own
 * working directory, next to the LocalManifestSource ledger:
 *
 *   <cwd>/.objectstack/cloud-connection.json
 *
 * Like everything on the runtime's serving path, reads are local file
 * operations: presenting the credential is how the runtime reaches the
 * control plane for org-scoped catalog/install calls, but nothing at
 * boot or serve time DEPENDS on those calls succeeding.
 *
 * Treat the file as a secret (it is written 0600).
 */

import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

/** Persisted binding credential + context. */
export interface StoredConnectionCredential {
    /** The `oscc_…` runtime bearer returned ONCE by the bind route. */
    runtimeToken: string;
    /**
     * Cloud-minted durable runtime identity (ADR runtime-identity-binding).
     * Presented as a claim on re-bind so the registration survives token
     * rotation. Absent on stores written before v2.
     */
    runtimeId?: string;
    /**
     * Control-plane environment id — set only when the binding targeted a
     * cloud-hosted environment. Self-hosted v2 registrations have none.
     */
    environmentId?: string;
    /** Control-plane base URL the binding was made against. */
    controlPlaneUrl?: string;
    organizationId?: string;
    accountEmail?: string;
    boundAt?: string;
}

/** Default store location, relative to the runtime's working directory. */
export const DEFAULT_CONNECTION_CREDENTIAL_PATH = '.objectstack/cloud-connection.json';

export class ConnectionCredentialStore {
    /** Resolved file path. */
    readonly path: string;

    constructor(path?: string) {
        this.path = path
            ? resolve(path)
            : resolve(process.cwd(), DEFAULT_CONNECTION_CREDENTIAL_PATH);
    }

    /**
     * Read the stored credential; null when absent or unreadable.
     *
     * An IDENTITY RESIDUAL — `runtimeToken: ''` with a `runtimeId` — is a
     * valid record: unbind leaves one behind so a later re-bind to the same
     * org claims the same registration (ADR runtime-identity-binding §2.1).
     * Callers already treat the empty token as "no credential".
     */
    read(): StoredConnectionCredential | null {
        if (!existsSync(this.path)) return null;
        try {
            const parsed = JSON.parse(readFileSync(this.path, 'utf8'));
            if (!parsed || typeof parsed.runtimeToken !== 'string') return null;
            if (!parsed.runtimeToken && !(typeof parsed.runtimeId === 'string' && parsed.runtimeId)) return null;
            return parsed as StoredConnectionCredential;
        } catch {
            return null;
        }
    }

    /** Persist (replace) the credential. Written 0600 — it is a secret. */
    write(credential: StoredConnectionCredential): void {
        mkdirSync(dirname(this.path), { recursive: true });
        writeFileSync(this.path, JSON.stringify(credential, null, 2), { encoding: 'utf8', mode: 0o600 });
    }

    /** Remove the credential (unbind). Returns false when nothing was stored. */
    clear(): boolean {
        if (!existsSync(this.path)) return false;
        unlinkSync(this.path);
        return true;
    }
}
