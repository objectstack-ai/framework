// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Validation-Rule Evaluator (ADR-0020)
 *
 * Where `record-validator.ts` checks field *shape* (types, lengths, option
 * membership), this module enforces the object-level **business rules**
 * declared in `ObjectSchema.validations` — the discriminated union of
 * `state_machine`, `cross_field`, `script`, … rules.
 *
 * Until ADR-0020 these rules were pure declaration: nothing on the write
 * path ever read `objectSchema.validations`, so a `state_machine` rule that
 * said "an account can't jump from churned straight back to prospect"
 * silently allowed exactly that. This evaluator closes that gap.
 *
 * ## What runs here (Phase 1)
 *
 *  - `state_machine` — the headline guardrail. On update, if the state field
 *    changed and the new value is not in `transitions[oldValue]`, the write
 *    is rejected. Needs the **prior** record (see plumbing note below).
 *  - `script` / `cross_field` — CEL predicates. If the predicate evaluates
 *    TRUE the rule is violated. These share the prior-record gap with
 *    `state_machine` (a PATCH carries only changed fields), so they are
 *    evaluated against the *merged* record `{ ...previous, ...patch }`.
 *
 * Other rule variants (`unique`, `format`, `json_schema`, `async`,
 * `custom`, `conditional`) are not yet enforced here; they fall through
 * untouched and remain declarative until a later phase wires them.
 *
 * ## Execution-control semantics (from `BaseValidationSchema`)
 *
 *  - `active: false`        → rule skipped entirely.
 *  - `events`               → rule only runs for the matching write context
 *                             (`insert` / `update`). `delete` is not a write
 *                             payload context here.
 *  - `priority`             → rules evaluated low-number-first (stable).
 *  - `severity`             → only `error` blocks the write. `warning` / `info`
 *                             are logged (best-effort) and never throw.
 *
 * ## Fail-open for *broken* rules, fail-closed for *violated* rules
 *
 * A CEL predicate that cannot be evaluated (parse error, references an
 * unbound variable, …) is a broken rule, not a violated one — it is logged
 * and skipped rather than bricking every write to the object. A predicate
 * that evaluates cleanly to "violated", or a transition that is definitively
 * illegal, is fail-closed (the write is rejected).
 *
 * ## Prior-record plumbing
 *
 * `state_machine` and the field-spanning predicates are meaningful only with
 * the record's prior state. The engine fetches it once (see
 * `engine.update`) and threads it in via `opts.previous`. On `insert` there
 * is no prior state, so `state_machine` is a no-op (the field-level select
 * check already constrains the initial value to a declared option).
 */

import { ExpressionEngine } from '@objectstack/formula';
import type { Expression } from '@objectstack/spec';
import { ValidationError, type FieldValidationError } from './record-validator.js';

type Mode = 'insert' | 'update';

interface BaseRule {
  type: string;
  name: string;
  message: string;
  active?: boolean;
  events?: Array<'insert' | 'update' | 'delete'>;
  priority?: number;
  severity?: 'error' | 'warning' | 'info';
}

interface StateMachineRule extends BaseRule {
  type: 'state_machine';
  field: string;
  transitions: Record<string, string[]>;
}

interface PredicateRule extends BaseRule {
  type: 'script' | 'cross_field';
  condition: string | Expression;
  fields?: string[];
}

export interface EvaluateRulesOptions {
  /** Prior persisted record (update only). Absent on insert. */
  previous?: Record<string, unknown> | null;
  /** Optional logger for non-blocking diagnostics (broken rules, warnings). */
  logger?: { warn?: (msg: string, meta?: any) => void };
}

/**
 * Returns true when the object declares at least one validation rule whose
 * correct evaluation needs the prior record (so the engine knows whether the
 * extra fetch on the update path is worth it).
 */
export function needsPriorRecord(
  objectSchema: { validations?: unknown[] } | undefined | null,
): boolean {
  const rules = objectSchema?.validations;
  if (!Array.isArray(rules)) return false;
  return rules.some(
    (r) =>
      r != null &&
      typeof r === 'object' &&
      ((r as BaseRule).type === 'state_machine' ||
        (r as BaseRule).type === 'cross_field' ||
        (r as BaseRule).type === 'script'),
  );
}

/** Normalize an author-time ExpressionInput into the canonical envelope. */
function toExpression(cond: string | Expression): Expression {
  return typeof cond === 'string' ? { dialect: 'cel', source: cond } : cond;
}

/**
 * Evaluate an object's declared validation rules against an incoming write.
 *
 * Throws `ValidationError` (the same envelope `validateRecord` uses, so REST
 * surfaces a single `400 VALIDATION_FAILED`) when one or more `error`-severity
 * rules are violated. Returns void otherwise.
 */
export function evaluateValidationRules(
  objectSchema: { validations?: unknown[] } | undefined | null,
  data: Record<string, unknown> | undefined | null,
  mode: Mode,
  opts: EvaluateRulesOptions = {},
): void {
  const rules = objectSchema?.validations;
  if (!Array.isArray(rules) || rules.length === 0 || !data) return;

  const previous = opts.previous ?? undefined;
  // Merged view used by predicate rules: prior state overlaid with the PATCH,
  // so a rule referencing an unchanged field still sees its persisted value.
  const merged: Record<string, unknown> = { ...(previous ?? {}), ...data };

  const errors: FieldValidationError[] = [];

  const ordered = rules
    .filter((r): r is BaseRule => r != null && typeof r === 'object')
    .filter((r) => r.active !== false)
    .filter((r) => {
      const events = r.events ?? ['insert', 'update'];
      return events.includes(mode);
    })
    .sort((a, b) => (a.priority ?? 100) - (b.priority ?? 100));

  for (const rule of ordered) {
    let violation: FieldValidationError | null = null;
    try {
      if (rule.type === 'state_machine') {
        violation = checkStateMachine(rule as StateMachineRule, mode, data, previous);
      } else if (rule.type === 'script' || rule.type === 'cross_field') {
        violation = checkPredicate(rule as PredicateRule, merged, previous, opts.logger);
      }
      // Other rule types are not enforced on the write path (yet).
    } catch (err) {
      // Defensive: a broken rule must never brick a write.
      opts.logger?.warn?.(`Validation rule '${rule.name}' threw — skipped`, err);
      continue;
    }

    if (!violation) continue;

    const severity = rule.severity ?? 'error';
    if (severity === 'error') {
      errors.push(violation);
    } else {
      opts.logger?.warn?.(
        `Validation rule '${rule.name}' (${severity}): ${violation.message}`,
      );
    }
  }

  if (errors.length > 0) throw new ValidationError(errors);
}

/**
 * State-machine transition check.
 *
 * Only meaningful on update with a prior record: if the state field changed,
 * the new value must appear in `transitions[oldValue]`. Lenient where it
 * cannot reason (no prior record, unchanged value, or a prior state with no
 * declared transitions) so it never blocks legitimate or legacy data.
 */
function checkStateMachine(
  rule: StateMachineRule,
  mode: Mode,
  data: Record<string, unknown>,
  previous: Record<string, unknown> | undefined,
): FieldValidationError | null {
  // Insert has no prior state — the field-level select check already
  // constrains the initial value to a declared option.
  if (mode === 'insert' || !previous) return null;
  // The PATCH didn't touch the state field → no transition to validate.
  if (!(rule.field in data)) return null;

  const from = previous[rule.field];
  const to = data[rule.field];
  // No change, or clearing the value → nothing to enforce.
  if (from === to || to === undefined || to === null) return null;

  const fromKey = String(from);
  const allowed = rule.transitions[fromKey];
  // Prior state not described by the FSM (legacy / external write) — cannot
  // reason about its legal targets, so don't block.
  if (!Array.isArray(allowed)) return null;

  if (!allowed.includes(String(to))) {
    return {
      field: rule.field,
      code: 'invalid_transition',
      message:
        rule.message ||
        `Invalid transition for ${rule.field}: ${fromKey} → ${String(to)}`,
    };
  }
  return null;
}

/**
 * CEL predicate check (`script` / `cross_field`). The predicate expresses the
 * *failure* condition: if it evaluates TRUE the rule is violated. An
 * un-evaluable predicate is treated as a broken rule (logged, skipped).
 */
function checkPredicate(
  rule: PredicateRule,
  record: Record<string, unknown>,
  previous: Record<string, unknown> | undefined,
  logger: EvaluateRulesOptions['logger'],
): FieldValidationError | null {
  const expr = toExpression(rule.condition);
  const result = ExpressionEngine.evaluate<boolean>(expr, {
    record,
    previous: previous ?? undefined,
  });

  if (!result.ok) {
    logger?.warn?.(
      `Validation rule '${rule.name}' predicate failed to evaluate (${result.error.kind}: ${result.error.message}) — skipped`,
    );
    return null;
  }

  if (result.value === true) {
    return {
      field: rule.fields?.[0] ?? '_record',
      code: 'rule_violation',
      message: rule.message,
    };
  }
  return null;
}

/**
 * Introspection helper (ADR-0020 D3.3): given an object's schema, a state
 * field, and a current state, return the legal next states declared by the
 * matching `state_machine` rule. Returns `null` when no such rule exists (so
 * callers can distinguish "no FSM governs this field" from "a dead-end state
 * with zero outgoing transitions", which returns `[]`).
 */
export function legalNextStates(
  objectSchema: { validations?: unknown[] } | undefined | null,
  field: string,
  currentState: string,
): string[] | null {
  const rules = objectSchema?.validations;
  if (!Array.isArray(rules)) return null;
  const rule = rules.find(
    (r): r is StateMachineRule =>
      r != null &&
      typeof r === 'object' &&
      (r as BaseRule).type === 'state_machine' &&
      (r as StateMachineRule).field === field,
  );
  if (!rule) return null;
  return rule.transitions[currentState] ?? [];
}
