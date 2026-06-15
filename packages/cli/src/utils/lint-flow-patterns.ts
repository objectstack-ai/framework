// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Build-time lint for flow authoring ANTI-PATTERNS — metadata that is valid
 * (passes schema + expression checks) but is semantically a footgun at runtime.
 * These are emitted as WARNINGS: they guide the author (very often an AI
 * generating templates) toward the robust pattern without failing the build on
 * a technically-legal construct.
 *
 * #1874 — time-relative rules via record-change date-EQUALITY. A start-node
 * trigger condition like `end_date == daysFromNow(60)` on a `record-*` trigger
 * only fires if the record happens to be written on that exact day; the robust
 * shape is a daily SCHEDULE trigger + a range query. We flag the equality form
 * specifically (range operators `>=`/`<=` are not flagged — they're the building
 * block of the correct pattern), keeping false positives near zero.
 */

export interface FlowLintFinding {
  where: string;
  message: string;
  hint: string;
  rule: string;
}

type AnyRec = Record<string, unknown>;

function asArray(v: unknown): AnyRec[] {
  if (Array.isArray(v)) return v as AnyRec[];
  if (v && typeof v === 'object') return Object.entries(v as AnyRec).map(([name, def]) => ({ name, ...(def as AnyRec) }));
  return [];
}

/** Extract the raw predicate source from a `condition` (string or Expression envelope). */
function conditionSource(raw: unknown): string {
  if (typeof raw === 'string') return raw;
  if (raw && typeof raw === 'object' && typeof (raw as AnyRec).source === 'string') return (raw as AnyRec).source as string;
  return '';
}

const TIME_FNS = 'daysFromNow|daysAgo|today|now|date|datetime';
// A time function adjacent to an equality operator, either side:
//   `end_date == daysFromNow(60)`  /  `today() != record.start`
const DATE_EQ = new RegExp(
  `(?:(?:${TIME_FNS})\\s*\\([^)]*\\)\\s*(?:==|!=))|(?:(?:==|!=)\\s*(?:${TIME_FNS})\\s*\\()`,
);

export const FLOW_TIME_RELATIVE_ANTIPATTERN = 'flow-time-relative-antipattern';

/**
 * Lint every flow's start node for known authoring anti-patterns. Returns a
 * (possibly empty) list of advisory findings — never throws, never fails a build.
 */
export function lintFlowPatterns(stack: AnyRec): FlowLintFinding[] {
  const findings: FlowLintFinding[] = [];
  for (const flow of asArray(stack.flows)) {
    const flowName = typeof flow.name === 'string' ? flow.name : '(unnamed flow)';
    const nodes = Array.isArray(flow.nodes) ? (flow.nodes as AnyRec[]) : [];
    const start = nodes.find((n) => n.type === 'start');
    if (!start) continue;
    const cfg = (start.config ?? {}) as AnyRec;
    const triggerType = typeof cfg.triggerType === 'string' ? cfg.triggerType : '';
    if (!triggerType.startsWith('record-')) continue;

    const src = conditionSource(cfg.condition).trim();
    if (src && DATE_EQ.test(src)) {
      findings.push({
        where: `flow '${flowName}' · start condition`,
        message:
          `record-change trigger uses a date-EQUALITY time condition (\`${src}\`) — it only fires if the ` +
          `record happens to be written on that exact day, so unattended "N days before" rules never run.`,
        hint:
          `Use a SCHEDULE trigger (daily cron) + a range query instead — e.g. a scheduled flow whose ` +
          `get_record filters \`end_date\` BETWEEN {TODAY()} and {TODAY()+N}. (#1874)`,
        rule: FLOW_TIME_RELATIVE_ANTIPATTERN,
      });
    }
  }
  return findings;
}
