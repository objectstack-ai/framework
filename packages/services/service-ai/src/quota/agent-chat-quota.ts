// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { IDataEngine } from '@objectstack/spec/contracts';

const USAGE_OBJECT = 'ai_usage_daily';

/** Identity a quota decision is made for. */
export interface QuotaSubject {
  userId: string;
  environmentId?: string;
}

/** Outcome of a quota check. */
export interface AgentChatQuotaDecision {
  allowed: boolean;
  /** Turns left today (after this one), when the implementation knows. */
  remaining?: number;
  /** ISO timestamp when the quota resets (next UTC midnight for daily). */
  resetAt?: string;
  /**
   * Honest, user-facing refusal copy (perception rule, ADR-0040 §5): a limit
   * that can only manifest as refusal must say why, when it recovers, and
   * what the way out is — never degrade silently.
   */
  message?: string;
}

/**
 * Pluggable per-turn quota for the agent chat route.
 *
 * The route calls {@link check} before dispatching a user turn and
 * {@link consume} exactly once when the turn is admitted. Implementations
 * decide the policy (daily counters, plan entitlements, token buckets);
 * the route only enforces the decision. No quota wired → no behavior change.
 */
export interface AgentChatQuota {
  check(subject: QuotaSubject): Promise<AgentChatQuotaDecision>;
  consume(subject: QuotaSubject): Promise<void>;
}

/** UTC calendar day (YYYY-MM-DD) for `now`. */
function utcDay(now: Date): string {
  return now.toISOString().slice(0, 10);
}

/** ISO timestamp of the next UTC midnight after `now`. */
function nextUtcMidnight(now: Date): string {
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  return next.toISOString();
}

/** Deterministic counter row id — one row per (day, environment, user). */
function usageId(day: string, subject: QuotaSubject): string {
  return `${day}:${subject.environmentId ?? '-'}:${subject.userId}`;
}

/**
 * DailyMessageQuota — N user turns per user per environment per UTC day.
 *
 * Backed by the `ai_usage_daily` platform object through {@link IDataEngine},
 * so the count survives restarts and is shared across instances. Counter
 * semantics (read → write, last-write-wins): a concurrent lost update only
 * under-counts a turn, which is fine for an entitlement gate and NOT fit for
 * billing. Failures are fail-open — a broken counter must never take chat
 * down with it.
 */
export class DailyMessageQuota implements AgentChatQuota {
  constructor(
    private readonly dataEngine: IDataEngine,
    private readonly dailyLimit: number,
    /** Injectable clock for tests. */
    private readonly now: () => Date = () => new Date(),
  ) {}

  async check(subject: QuotaSubject): Promise<AgentChatQuotaDecision> {
    const at = this.now();
    const day = utcDay(at);
    let used = 0;
    try {
      const row = await this.dataEngine.findOne(USAGE_OBJECT, { where: { id: usageId(day, subject) } });
      used = typeof row?.messages === 'number' ? row.messages : 0;
    } catch {
      return { allowed: true }; // fail-open: never block chat on a counter error
    }
    if (used < this.dailyLimit) {
      return { allowed: true, remaining: this.dailyLimit - used - 1, resetAt: nextUtcMidnight(at) };
    }
    const resetAt = nextUtcMidnight(at);
    return {
      allowed: false,
      remaining: 0,
      resetAt,
      message:
        `今日 AI 助手额度(${this.dailyLimit} 条/天)已用完,将于明日(UTC)自动恢复;如需立即继续,请联系管理员或升级套餐。 ` +
        `Daily AI assistant limit reached (${this.dailyLimit} messages/day). It resets at ${resetAt}; ` +
        'to continue now, contact your administrator or upgrade your plan.',
    };
  }

  async consume(subject: QuotaSubject): Promise<void> {
    const day = utcDay(this.now());
    const id = usageId(day, subject);
    try {
      const row = await this.dataEngine.findOne(USAGE_OBJECT, { where: { id } });
      if (row) {
        const used = typeof row.messages === 'number' ? row.messages : 0;
        await this.dataEngine.update(USAGE_OBJECT, { messages: used + 1 }, { where: { id } });
      } else {
        await this.dataEngine.insert(USAGE_OBJECT, {
          id,
          day,
          user_id: subject.userId,
          environment_id: subject.environmentId ?? null,
          messages: 1,
        });
      }
    } catch {
      /* fail-open: a lost increment under-counts one turn; never break chat */
    }
  }
}
