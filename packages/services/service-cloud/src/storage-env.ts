// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Env-driven storage backend selection for the cloud control plane.
 *
 * Wires `StorageServicePlugin` (from `@objectstack/service-storage`) using
 * environment variables so deployments — especially serverless ones like
 * Vercel — can switch between local-FS (development) and S3-compatible
 * object storage (production) with zero code changes.
 *
 * Supported env vars:
 *   - OS_STORAGE_ADAPTER       : 'local' | 's3' (default: 'local')
 *   - OS_STORAGE_LOCAL_DIR     : root dir for local adapter (default: ./storage)
 *
 *   When OS_STORAGE_ADAPTER=s3:
 *   - OS_S3_BUCKET             : (required) bucket name
 *   - OS_S3_REGION             : (required) AWS region (e.g. us-east-1)
 *   - OS_S3_ENDPOINT           : custom endpoint for S3-compatible services
 *                                (Cloudflare R2, MinIO, Backblaze B2, etc.)
 *   - OS_S3_ACCESS_KEY_ID      : credentials (else AWS SDK chain is used)
 *   - OS_S3_SECRET_ACCESS_KEY  : credentials (else AWS SDK chain is used)
 *   - OS_S3_FORCE_PATH_STYLE   : '1' | 'true' to force path-style URLs
 *
 * Returns an empty list when explicitly disabled
 * (OS_STORAGE_ADAPTER=none/disabled). The cloud-artifact plugin will then
 * fall back to its local-FS path with a startup warning.
 */
export async function resolveStoragePluginFromEnv(): Promise<any[]> {
    const adapter = (process.env.OS_STORAGE_ADAPTER ?? 'local').trim().toLowerCase();

    if (adapter === 'none' || adapter === 'disabled' || adapter === 'off') {
        return [];
    }

    if (adapter === 's3') {
        const bucket = process.env.OS_S3_BUCKET?.trim();
        const region = process.env.OS_S3_REGION?.trim();
        if (!bucket || !region) {
            throw new Error(
                '[service-cloud] OS_STORAGE_ADAPTER=s3 requires OS_S3_BUCKET and OS_S3_REGION. ' +
                'Set them in your hosting provider (e.g. Vercel project settings) ' +
                'or set OS_STORAGE_ADAPTER=local for local development.',
            );
        }
        const { StorageServicePlugin } = await import('@objectstack/service-storage');
        return [new StorageServicePlugin({
            adapter: 's3',
            s3: {
                bucket,
                region,
                endpoint: process.env.OS_S3_ENDPOINT?.trim() || undefined,
                accessKeyId: process.env.OS_S3_ACCESS_KEY_ID?.trim() || undefined,
                secretAccessKey: process.env.OS_S3_SECRET_ACCESS_KEY?.trim() || undefined,
                forcePathStyle: /^(1|true|yes)$/i.test(process.env.OS_S3_FORCE_PATH_STYLE ?? ''),
            },
        })];
    }

    // 'local' (default)
    const { StorageServicePlugin } = await import('@objectstack/service-storage');
    return [new StorageServicePlugin({
        adapter: 'local',
        local: { rootDir: process.env.OS_STORAGE_LOCAL_DIR?.trim() || './storage' },
    })];
}
