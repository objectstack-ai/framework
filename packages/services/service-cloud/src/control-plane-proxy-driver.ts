// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { IDataDriver } from '@objectstack/spec/contracts';
import type { QueryAST } from '@objectstack/spec/data';
import type { DriverOptions } from '@objectstack/spec/data';

/**
 * CloudProxyDriver (formerly ControlPlaneProxyDriver)
 *
 * An IDataDriver proxy that delegates all operations to the cloud
 * (control-plane) driver. All read queries automatically receive an
 * `organization_id` filter so that project kernels can safely expose
 * `scope: 'system'` objects (user, org, role …) without leaking data across
 * organizations.
 *
 * Write operations (create / update / delete …) are forwarded directly —
 * system objects are globally writable from any project context.
 *
 * Registration: `DefaultProjectKernelFactory` registers this driver under the
 * well-known datasource name `'cloud'` so that all objects whose package has
 * `scope: 'system'` or `defaultDatasource: 'cloud'` resolve to it
 * automatically.
 */
export class ControlPlaneProxyDriver implements IDataDriver {
    readonly name = 'cloud';
    readonly version = '1.0.0';

    readonly supports: any;

    constructor(
        private readonly controlPlaneDriver: IDataDriver,
        private readonly organizationId: string,
    ) {
        if (!organizationId) {
            throw new Error('[CloudProxyDriver] organizationId is required — refusing to mount cloud datasource without org scope');
        }
        // Inherit capability flags from the underlying driver so query
        // planners (aggregation, streaming, …) make accurate decisions.
        this.supports = (controlPlaneDriver as any).supports ?? {
            transactions: false,
            bulkOperations: true,
            streaming: false,
            aggregations: false,
            vectorSearch: false,
            fullTextSearch: false,
            jsonFields: false,
            relations: false,
        };
    }

    // -------------------------------------------------------------------------
    // Lifecycle
    // -------------------------------------------------------------------------

    async connect(): Promise<void> {}

    async disconnect(): Promise<void> {}

    async checkHealth(): Promise<boolean> {
        return this.controlPlaneDriver.checkHealth();
    }

    // -------------------------------------------------------------------------
    // Raw execution
    // -------------------------------------------------------------------------

    async execute(command: unknown, parameters?: unknown[], options?: DriverOptions): Promise<unknown> {
        return this.controlPlaneDriver.execute(command, parameters, options);
    }

    // -------------------------------------------------------------------------
    // Read operations — inject org filter (only for org-scoped tables)
    // -------------------------------------------------------------------------

    find(object: string, query: QueryAST, options?: DriverOptions) {
        return this.controlPlaneDriver.find(object, this.#injectOrg(object, query), options);
    }

    findStream(object: string, query: QueryAST, options?: DriverOptions) {
        return this.controlPlaneDriver.findStream(object, this.#injectOrg(object, query), options);
    }

    findOne(object: string, query: QueryAST, options?: DriverOptions) {
        return this.controlPlaneDriver.findOne(object, this.#injectOrg(object, query), options);
    }

    count(object: string, query?: QueryAST, options?: DriverOptions) {
        const q: QueryAST = query
            ? this.#injectOrg(object, query)
            : (this.#isOrgScoped(object) ? ({ where: this.#orgFilter() } as any) : ({} as any));
        return this.controlPlaneDriver.count(object, q, options);
    }

    // -------------------------------------------------------------------------
    // Write operations — forward directly to control plane
    // -------------------------------------------------------------------------

    create(object: string, data: Record<string, unknown>, options?: DriverOptions) {
        return this.controlPlaneDriver.create(object, data, options);
    }

    update(object: string, id: string | number, data: Record<string, unknown>, options?: DriverOptions) {
        return this.controlPlaneDriver.update(object, id, data, options);
    }

    upsert(object: string, data: Record<string, unknown>, conflictKeys?: string[], options?: DriverOptions) {
        return this.controlPlaneDriver.upsert(object, data, conflictKeys, options);
    }

    delete(object: string, id: string | number, options?: DriverOptions) {
        return this.controlPlaneDriver.delete(object, id, options);
    }

    bulkCreate(object: string, dataArray: Record<string, unknown>[], options?: DriverOptions) {
        return this.controlPlaneDriver.bulkCreate(object, dataArray, options);
    }

    bulkUpdate(object: string, updates: Array<{ id: string | number; data: Record<string, unknown> }>, options?: DriverOptions) {
        return this.controlPlaneDriver.bulkUpdate(object, updates, options);
    }

    async bulkDelete(object: string, ids: Array<string | number>, options?: DriverOptions): Promise<void> {
        return this.controlPlaneDriver.bulkDelete(object, ids, options);
    }

    updateMany?(object: string, query: QueryAST, data: Record<string, unknown>, options?: DriverOptions): Promise<number> {
        return this.controlPlaneDriver.updateMany!(object, query, data, options);
    }

    deleteMany?(object: string, query: QueryAST, options?: DriverOptions): Promise<number> {
        return this.controlPlaneDriver.deleteMany!(object, query, options);
    }

    // -------------------------------------------------------------------------
    // Schema operations — delegate
    // -------------------------------------------------------------------------

    describeSchema?(...args: any[]) {
        return (this.controlPlaneDriver as any).describeSchema?.(...args);
    }

    listObjects?(...args: any[]) {
        return (this.controlPlaneDriver as any).listObjects?.(...args);
    }

    // -------------------------------------------------------------------------
    // Transactions — not supported
    // -------------------------------------------------------------------------

    beginTransaction(): Promise<unknown> {
        return this.controlPlaneDriver.beginTransaction();
    }

    commit(transaction: unknown): Promise<void> {
        return this.controlPlaneDriver.commit(transaction);
    }

    rollback(transaction: unknown): Promise<void> {
        return this.controlPlaneDriver.rollback(transaction);
    }

    commitTransaction(): Promise<void> {
        return Promise.reject(new Error('[ControlPlaneProxyDriver] Transactions not supported'));
    }

    rollbackTransaction(): Promise<void> {
        return Promise.reject(new Error('[ControlPlaneProxyDriver] Transactions not supported'));
    }

    syncSchema(object: string, schema: unknown, options?: DriverOptions): Promise<void> {
        return this.controlPlaneDriver.syncSchema(object, schema, options);
    }

    syncSchemasBatch?(schemas: Array<{ object: string; schema: unknown }>, options?: DriverOptions): Promise<void> {
        return this.controlPlaneDriver.syncSchemasBatch?.(schemas, options) ?? Promise.resolve();
    }

    dropTable(object: string, options?: DriverOptions): Promise<void> {
        return this.controlPlaneDriver.dropTable(object, options);
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    #orgFilter() {
        return { organization_id: this.organizationId };
    }

    /**
     * Org-scoped tables — these have an `organization_id` column and require
     * tenant filtering. Tables like sys_user / sys_session / sys_account are
     * global identity tables and must NOT receive an org filter (a user can
     * belong to many orgs).
     */
    #isOrgScoped(object: string): boolean {
        return ORG_SCOPED_OBJECTS.has(object);
    }

    #injectOrg(object: string, query: QueryAST): QueryAST {
        if (!this.#isOrgScoped(object)) return query;
        const orgFilter = this.#orgFilter();
        if (!query.where) {
            return { ...query, where: orgFilter };
        }
        return { ...query, where: { ...(query.where as Record<string, unknown>), ...orgFilter } };
    }
}

const ORG_SCOPED_OBJECTS = new Set<string>([
    'sys_organization',
    'sys_member',
    'sys_invitation',
    'sys_team',
    'sys_team_member',
    'sys_role',
    'sys_permission_set',
    'sys_api_key',
    'sys_audit_log',
    'sys_metadata',
    'sys_metadata_history',
    'sys_project',
    'sys_project_credential',
    'sys_project_member',
    'sys_project_package',
    'sys_app',
]);
