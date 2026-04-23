// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Flatten an `ObjectStackDefinition` bundle into the `{type, name, data}`
 * shape consumed by `MetadataPlugin.bulkRegister`.
 *
 * Object names are namespaced (`${ns}__${name}`) when the bundle declares
 * a non-reserved namespace and the name is not already prefixed. Other
 * metadata types (view/dashboard/flow/...) are preserved as-is to match
 * the existing AppPlugin install path.
 *
 * Skipped on purpose:
 *   - apis / actions   — handler refs require kernel code, not metadata only
 *   - translations     — needs i18n plugin
 *   - sharingRules / roles — needs security plugin
 *   - onEnable hooks   — code, not metadata
 */
export interface ExtractedItem {
    type: string;
    name: string;
    data: unknown;
}

const RESERVED_NS = new Set(['base', 'system']);

export function extractMetadataItems(bundle: any): ExtractedItem[] {
    const items: ExtractedItem[] = [];
    const ns = bundle?.manifest?.namespace as string | undefined;

    const toFQN = (name: string): string =>
        name.includes('__') || !ns || RESERVED_NS.has(ns) ? name : `${ns}__${name}`;

    const pushAll = (type: string, arr?: any[], rewriteName = false) => {
        for (const item of arr ?? []) {
            if (!item?.name) continue;
            const name = rewriteName ? toFQN(item.name) : item.name;
            const data = rewriteName ? { ...item, name } : item;
            items.push({ type, name, data });
        }
    };

    pushAll('object', bundle?.objects, true);
    pushAll('view', bundle?.views);
    pushAll('dashboard', bundle?.dashboards);
    pushAll('report', bundle?.reports);
    pushAll('flow', bundle?.flows);
    pushAll('agent', bundle?.agents);
    pushAll('app', bundle?.apps);

    return items;
}
