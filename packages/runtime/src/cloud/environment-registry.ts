// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Per-project driver registry contract.
 *
 * Resolves a project (by hostname or ID) and produces an instantiated
 * `IDataDriver` bound to that project's physical database. Concrete
 * implementations sit on top of either:
 *   - the ObjectStack Cloud HTTP API (see {@link ArtifactEnvironmentRegistry})
 *   - a local file artifact (see {@link FileArtifactApiClient} +
 *     {@link ArtifactEnvironmentRegistry})
 *
 * The contract was extracted from `@objectstack/service-cloud` in Phase R
 * so the runtime can express "fetch artifact + boot per-project kernel"
 * without taking a dependency on the cloud control plane.
 */

import type * as Contracts from '@objectstack/spec/contracts';

type IDataDriver = Contracts.IDataDriver;

export interface EnvironmentDriverRegistry {
    /** Resolve a project by hostname. Returns `null` when unknown. */
    resolveByHostname(host: string): Promise<{ environmentId: string; driver: IDataDriver } | null>;

    /** Resolve a project's driver by ID. Returns `null` when unknown. */
    resolveById(environmentId: string): Promise<IDataDriver | null>;

    /**
     * Look up the cached project row + driver by ID without triggering a
     * remote/file fetch. Returns the full cached entry when fresh.
     */
    peekById(environmentId: string): { environmentId: string; driver: IDataDriver; project: any } | null;

    /** Drop cached entries for the given project. */
    invalidate(environmentId: string): void;
}
