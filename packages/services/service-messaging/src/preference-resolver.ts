// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { IDataEngine } from '@objectstack/spec/contracts';

/** The object the preference matrix lives in. */
export const PREFERENCE_OBJECT = 'sys_notification_preference';

export interface PreferenceResolverLogger {
    info(...args: unknown[]): void;
    warn(...args: unknown[]): void;
    error(...args: unknown[]): void;
}

export interface PreferenceResolverOptions {
    /** Lazily resolve the data engine; `undefined` ⇒ fail-open (deliver all). */
    getData(): IDataEngine | undefined;
    logger: PreferenceResolverLogger;
    /**
     * Topics that bypass preferences entirely (security/system alerts users
     * must not be able to mute). An entry ending in `.` is a prefix match
     * (`security.` matches `security.breach`); otherwise it is an exact match.
     */
    mandatoryTopics?: readonly string[];
    /** Object name override (default {@link PREFERENCE_OBJECT}). */
    objectName?: string;
}

export interface PreferenceContext {
    topic: string;
    organizationId?: string;
}

/** A recipient with the channels they accept for this notification. */
export interface PreferenceTarget {
    recipient: string;
    channels: string[];
}

const WILDCARD = '*';

/**
 * PreferenceResolver — the ADR-0030 Layer-3 preference filter (P2).
 *
 * Given the resolved recipients and the requested channels, returns, per
 * recipient, the channels they actually accept for `topic`. Resolution is
 * most-specific-wins over `sys_notification_preference` rows with `*` wildcards
 * for user / topic / channel; a real-user row overrides the `user_id='*'`
 * admin-global default; the built-in default is **on**.
 *
 * Two safety rules:
 *  - **Mandatory topics bypass** the matrix (all channels kept).
 *  - **Fail-open**: no data engine, or a lookup error, keeps all channels — a
 *    preference outage must never silently swallow notifications.
 */
export class PreferenceResolver {
    private readonly objectName: string;
    private readonly mandatory: readonly string[];

    constructor(private readonly opts: PreferenceResolverOptions) {
        this.objectName = opts.objectName ?? PREFERENCE_OBJECT;
        this.mandatory = opts.mandatoryTopics ?? [];
    }

    /** Whether a topic bypasses preferences (exact or `prefix.` match). */
    isMandatory(topic: string): boolean {
        return this.mandatory.some((m) =>
            m.endsWith('.') ? topic.startsWith(m) : topic === m,
        );
    }

    /**
     * Filter `(recipient × channel)` by preference. Recipients left with no
     * accepted channel are dropped from the result.
     */
    async filter(
        recipients: string[],
        channels: string[],
        ctx: PreferenceContext,
    ): Promise<PreferenceTarget[]> {
        const all = (): PreferenceTarget[] => recipients.map((r) => ({ recipient: r, channels: [...channels] }));
        if (recipients.length === 0 || channels.length === 0) return [];
        if (this.isMandatory(ctx.topic)) return all();

        const data = this.opts.getData();
        if (!data) return all(); // fail-open

        let rows: Record<string, unknown>[];
        try {
            rows = await this.loadRows(data, ctx);
        } catch (err) {
            this.opts.logger.warn(
                `[preferences] lookup for topic '${ctx.topic}' failed (${msg(err)}); delivering all (fail-open)`,
            );
            return all();
        }

        // Index rows by `${user}|${topic}|${channel}` → enabled.
        const recipientSet = new Set(recipients);
        const index = new Map<string, boolean>();
        for (const r of rows) {
            const user = String(r.user_id ?? '');
            if (user !== WILDCARD && !recipientSet.has(user)) continue; // ignore unrelated users
            const topic = String(r.topic ?? WILDCARD);
            const channel = String(r.channel ?? WILDCARD);
            index.set(`${user}|${topic}|${channel}`, asBool(r.enabled));
        }

        const targets: PreferenceTarget[] = [];
        for (const recipient of recipients) {
            const accepted = channels.filter((channel) =>
                this.enabledFor(index, recipient, ctx.topic, channel),
            );
            if (accepted.length > 0) targets.push({ recipient, channels: accepted });
        }
        return targets;
    }

    /** Load the candidate rows (topic-specific + wildcard-topic), org-scoped. */
    private async loadRows(data: IDataEngine, ctx: PreferenceContext): Promise<Record<string, unknown>[]> {
        // Two equality queries (topic and the '*' wildcard) avoid relying on
        // driver-specific IN support; user filtering is done in memory.
        const base: Record<string, unknown> = {};
        if (ctx.organizationId) base.organization_id = ctx.organizationId;
        const [specific, wildcard] = await Promise.all([
            data.find(this.objectName, { where: { ...base, topic: ctx.topic }, limit: 10000 }),
            data.find(this.objectName, { where: { ...base, topic: WILDCARD }, limit: 10000 }),
        ]);
        return [...(specific ?? []), ...(wildcard ?? [])];
    }

    /**
     * Most-specific-wins lookup for (user, topic, channel). User-specific beats
     * the `*` user; topic/channel specific beats their wildcards. Default on.
     */
    private enabledFor(index: Map<string, boolean>, user: string, topic: string, channel: string): boolean {
        for (const u of [user, WILDCARD]) {
            for (const t of [topic, WILDCARD]) {
                for (const c of [channel, WILDCARD]) {
                    const hit = index.get(`${u}|${t}|${c}`);
                    if (hit !== undefined) return hit;
                }
            }
        }
        return true; // built-in default: opted in
    }
}

function asBool(v: unknown): boolean {
    return v === true || v === 1 || v === '1' || v === 'true';
}

function msg(err: unknown): string {
    return (err as Error)?.message ?? String(err);
}
