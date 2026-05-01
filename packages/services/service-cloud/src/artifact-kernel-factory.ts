// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * ProjectKernelFactory backed by the control plane's Artifact API.
 *
 * Differs from {@link DefaultProjectKernelFactory} in two ways:
 *
 *  1. There is no local control-plane database to query — project rows
 *     come from the {@link ArtifactEnvironmentRegistry} cache populated
 *     via HTTP.
 *  2. There is no `ControlPlaneProxyDriver` mounted on the per-project
 *     kernel. The runtime is intentionally isolated from the control
 *     plane: each project kernel only knows about its own data driver.
 *
 * The kernel is bootstrapped with:
 *   • DriverPlugin(driver)  — project-scoped data driver
 *   • ObjectQLPlugin
 *   • MetadataPlugin (no system-object registration)
 *   • AppPlugin(artifact.metadata)  — compiled developer code
 */

import { ObjectKernel } from '@objectstack/core';
import type * as Contracts from '@objectstack/spec/contracts';
import { DriverPlugin, AppPlugin } from '@objectstack/runtime';
import type { ProjectKernelFactory } from './kernel-manager.js';
import type { EnvironmentDriverRegistry } from './environment-registry.js';
import type { ArtifactApiClient } from './artifact-api-client.js';

type IDataDriver = Contracts.IDataDriver;

export interface ArtifactKernelFactoryConfig {
    client: ArtifactApiClient;
    envRegistry: EnvironmentDriverRegistry;
    /** Optional logger. */
    logger?: { info?: (...a: any[]) => void; warn?: (...a: any[]) => void; error?: (...a: any[]) => void };
    /** Optional kernel constructor config. */
    kernelConfig?: ConstructorParameters<typeof ObjectKernel>[0];
}

export class ArtifactKernelFactory implements ProjectKernelFactory {
    private readonly client: ArtifactApiClient;
    private readonly envRegistry: EnvironmentDriverRegistry;
    private readonly logger: NonNullable<ArtifactKernelFactoryConfig['logger']>;
    private readonly kernelConfig?: ArtifactKernelFactoryConfig['kernelConfig'];

    constructor(config: ArtifactKernelFactoryConfig) {
        this.client = config.client;
        this.envRegistry = config.envRegistry;
        this.logger = config.logger ?? console;
        this.kernelConfig = config.kernelConfig;
    }

    async create(projectId: string): Promise<ObjectKernel> {
        let cached = this.envRegistry.peekById(projectId);
        if (!cached) {
            const driver = await this.envRegistry.resolveById(projectId);
            if (!driver) {
                throw new Error(`[ArtifactKernelFactory] Could not resolve driver for project '${projectId}'`);
            }
            cached = this.envRegistry.peekById(projectId);
            if (!cached) {
                throw new Error(`[ArtifactKernelFactory] envRegistry returned a driver but no cached entry for '${projectId}'`);
            }
        }

        const driver: IDataDriver = cached.driver;
        const project = cached.project as { id: string; organization_id?: string; hostname?: string };

        const artifact = await this.client.fetchArtifact(projectId);
        if (!artifact) {
            throw new Error(`[ArtifactKernelFactory] Artifact not available for project '${projectId}'`);
        }

        const { ObjectQLPlugin } = await import('@objectstack/objectql');
        const { MetadataPlugin } = await import('@objectstack/metadata');

        const kernel = new ObjectKernel(this.kernelConfig);

        await kernel.use(new DriverPlugin(driver));
        await kernel.use(new ObjectQLPlugin({ projectId: projectId }));
        await kernel.use(new MetadataPlugin({
            watch: false,
            projectId: projectId,
            organizationId: project.organization_id,
            registerSystemObjects: false,
        }));

        const projectName = project.hostname ?? projectId;
        const bundle = artifact.metadata as any;
        const sys = bundle?.manifest ?? bundle;
        const packageId = sys?.packageId ?? sys?.package_id ?? bundle?.packageId;

        await kernel.use(new AppPlugin(bundle, {
            projectId,
            organizationId: project.organization_id ?? '',
            projectName,
            packageId,
            source: packageId ? 'package' : 'user',
        } as any));

        await kernel.bootstrap();

        this.logger.info?.('[ArtifactKernelFactory] kernel ready', {
            projectId,
            commitId: artifact.commitId,
            checksum: artifact.checksum,
        });

        return kernel;
    }
}
