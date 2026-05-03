// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { Plugin, PluginContext } from '@objectstack/core';
import type { IDataEngine } from '@objectstack/spec/contracts';
import type { AutomationEngine } from '../engine.js';
import { interpolate } from './template.js';

/**
 * CRUD Node Plugin — wires `get_record` / `create_record` / `update_record` /
 * `delete_record` flow nodes to the runtime data layer (ObjectQL / IDataEngine).
 *
 * Each executor:
 *  1. Interpolates `{var}` / `{var.path}` / `{$User.*}` / `{NOW()}` tokens in
 *     `node.config` against the running flow's variable context.
 *  2. Calls the resolved data engine via `ctx.getService('data')`.
 *  3. Writes the result back to the variable context under `outputVariable`
 *     (or under `<nodeId>.id` / `<nodeId>.records` by default), so downstream
 *     nodes can reference fields like `{leadRecord.company}`.
 *
 * If no data engine is registered, executors degrade to a no-op success so
 * test environments without ObjectQL still complete the flow without errors.
 */
export class CrudNodesPlugin implements Plugin {
    name = 'com.objectstack.automation.crud-nodes';
    version = '1.0.0';
    type = 'standard' as const;
    dependencies = ['com.objectstack.service-automation'];

    async init(ctx: PluginContext): Promise<void> {
        const engine = ctx.getService<AutomationEngine>('automation');
        const getData = (): IDataEngine | undefined => {
            try {
                return ctx.getService<IDataEngine>('data') ?? ctx.getService<IDataEngine>('objectql');
            } catch {
                return undefined;
            }
        };

        // ── get_record ────────────────────────────────────────
        engine.registerNodeExecutor({
            type: 'get_record',
            async execute(node, variables, context) {
                const cfg = (node.config ?? {}) as Record<string, unknown>;
                const objectName = String(cfg.objectName ?? cfg.object ?? '');
                if (!objectName) return { success: false, error: 'get_record: objectName required' };

                const filter = interpolate(cfg.filter ?? cfg.filters ?? {}, variables, context) as Record<string, unknown>;
                const fields = cfg.fields as string[] | undefined;
                const limit = typeof cfg.limit === 'number' ? cfg.limit : undefined;
                const outputVariable = cfg.outputVariable as string | undefined;

                const data = getData();
                if (!data) {
                    ctx.logger.warn(`[get_record] no data engine; skipping ${objectName}`);
                    return { success: true, output: { records: [], object: objectName } };
                }

                try {
                    if (limit && limit > 1) {
                        const records = await data.find(objectName, { where: filter, fields, limit });
                        if (outputVariable) variables.set(outputVariable, records);
                        return { success: true, output: { records, object: objectName } };
                    }
                    const record = await data.findOne(objectName, { where: filter, fields });
                    if (outputVariable) variables.set(outputVariable, record);
                    return { success: true, output: { record, id: record?.id, object: objectName } };
                } catch (err) {
                    return { success: false, error: `get_record(${objectName}) failed: ${(err as Error).message}` };
                }
            },
        });

        // ── create_record ─────────────────────────────────────
        engine.registerNodeExecutor({
            type: 'create_record',
            async execute(node, variables, context) {
                const cfg = (node.config ?? {}) as Record<string, unknown>;
                const objectName = String(cfg.objectName ?? cfg.object ?? '');
                if (!objectName) return { success: false, error: 'create_record: objectName required' };

                const fields = interpolate(cfg.fields ?? {}, variables, context) as Record<string, unknown>;
                const outputVariable = cfg.outputVariable as string | undefined;

                const data = getData();
                if (!data) {
                    ctx.logger.warn(`[create_record] no data engine; skipping ${objectName}`);
                    if (outputVariable) variables.set(outputVariable, `mock-${objectName}-${Date.now()}`);
                    return { success: true, output: { id: `mock-${objectName}-${Date.now()}`, object: objectName } };
                }

                try {
                    const created = await data.insert(objectName, fields);
                    const insertedId = Array.isArray(created) ? created[0]?.id : created?.id ?? created;
                    if (outputVariable) variables.set(outputVariable, insertedId);
                    return { success: true, output: { id: insertedId, record: created, object: objectName } };
                } catch (err) {
                    return { success: false, error: `create_record(${objectName}) failed: ${(err as Error).message}` };
                }
            },
        });

        // ── update_record ─────────────────────────────────────
        engine.registerNodeExecutor({
            type: 'update_record',
            async execute(node, variables, context) {
                const cfg = (node.config ?? {}) as Record<string, unknown>;
                const objectName = String(cfg.objectName ?? cfg.object ?? '');
                if (!objectName) return { success: false, error: 'update_record: objectName required' };

                const filter = interpolate(cfg.filter ?? cfg.filters ?? {}, variables, context) as Record<string, unknown>;
                const fields = interpolate(cfg.fields ?? {}, variables, context) as Record<string, unknown>;

                const data = getData();
                if (!data) {
                    ctx.logger.warn(`[update_record] no data engine; skipping ${objectName}`);
                    return { success: true };
                }

                try {
                    const result = await data.update(objectName, fields, { where: filter });
                    return { success: true, output: { result, object: objectName } };
                } catch (err) {
                    return { success: false, error: `update_record(${objectName}) failed: ${(err as Error).message}` };
                }
            },
        });

        // ── delete_record ─────────────────────────────────────
        engine.registerNodeExecutor({
            type: 'delete_record',
            async execute(node, variables, context) {
                const cfg = (node.config ?? {}) as Record<string, unknown>;
                const objectName = String(cfg.objectName ?? cfg.object ?? '');
                if (!objectName) return { success: false, error: 'delete_record: objectName required' };

                const filter = interpolate(cfg.filter ?? cfg.filters ?? {}, variables, context) as Record<string, unknown>;

                const data = getData();
                if (!data) return { success: true };

                try {
                    const result = await data.delete(objectName, { where: filter });
                    return { success: true, output: { result, object: objectName } };
                } catch (err) {
                    return { success: false, error: `delete_record(${objectName}) failed: ${(err as Error).message}` };
                }
            },
        });

        ctx.logger.info('[CRUD Nodes] 4 node executors registered (data-backed)');
    }
}
