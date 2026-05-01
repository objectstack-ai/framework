// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Flatten an `ObjectStackDefinition` bundle into the `{type, name, data}`
 * shape consumed by `MetadataPlugin.bulkRegister`.
 *
 * Object names are kept as the canonical short name. The registry stores
 * objects by short name and disambiguates cross-package collisions via the
 * package/namespace tag — adding `${ns}__` here would surface FQN names in
 * URLs and queries (forbidden by the naming convention).
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

export function extractMetadataItems(bundle: any): ExtractedItem[] {
    const items: ExtractedItem[] = [];

    const pushAll = (type: string, arr?: any[]) => {
        for (const item of arr ?? []) {
            if (!item?.name) continue;
            items.push({ type, name: item.name, data: item });
        }
    };

    pushAll('object', bundle?.objects);
    pushAll('view', bundle?.views);
    pushAll('dashboard', bundle?.dashboards);
    pushAll('report', bundle?.reports);
    pushAll('flow', bundle?.flows);
    pushAll('agent', bundle?.agents);
    pushAll('app', bundle?.apps);

    return items;
}
