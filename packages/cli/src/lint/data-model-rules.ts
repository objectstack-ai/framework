// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Data-model best-practice lint rules.
 *
 * These rules encode the relationship / master-detail / roll-up conventions the
 * platform ships (see the objectstack-data and objectstack-ui skills, ADR-0035).
 * They run over the normalized object set and flag anti-patterns that an
 * author — human OR an AI generator — commonly produces. They are intentionally
 * heuristic: structural problems are `error`, likely-wrong choices are
 * `warning`, and "you probably want this" nudges are `suggestion`. None of them
 * block on a judgement call.
 *
 * The same rules double as the automated rubric for the metadata-generation
 * eval (see `score.ts`): a generated stack scores well exactly when it is
 * schema-valid AND lint-clean here.
 */

export type Severity = 'error' | 'warning' | 'suggestion';

export interface LintIssue {
  severity: Severity;
  rule: string;
  message: string;
  path: string;
  fix?: string;
}

// ─── Heuristics ─────────────────────────────────────────────────────

const RELATIONSHIP_TYPES = new Set(['lookup', 'master_detail']);
const NUMERIC_TYPES = new Set([
  'number', 'currency', 'integer', 'decimal', 'percent', 'float', 'double',
]);
const OPTION_FIELD_TYPES = new Set(['select', 'multiselect', 'radio', 'enum']);
const NAME_LIKE_FIELDS = ['name', 'title', 'subject', 'label', 'full_name', 'display_name', 'code'];

/** Child object names that read as line-items / composition (entered with the parent). */
const LINE_ITEM_RE = /_(line|lines|line_item|line_items|item|items|detail|details|entry|entries)$/;
/** Child object names that read as associations (comments/audit/activity — NOT line items). */
const ASSOCIATION_TOKENS = [
  'comment', 'attachment', 'note', 'log', 'audit', 'activity', 'activities',
  'history', 'event', 'reaction', 'like', 'mention', 'notification', 'message',
];

function isLineItemName(name: string): boolean {
  return LINE_ITEM_RE.test(name);
}

function isAssociationName(name: string): boolean {
  const lc = name.toLowerCase();
  return ASSOCIATION_TOKENS.some((t) => lc === t || lc.endsWith(`_${t}`) || lc.endsWith(`_${t}s`));
}

interface FieldEntry {
  name: string;
  def: any;
}

function fieldEntries(fields: any): FieldEntry[] {
  if (!fields) return [];
  if (Array.isArray(fields)) {
    return fields.filter((f) => f && f.name != null).map((f) => ({ name: String(f.name), def: f }));
  }
  return Object.entries<any>(fields).map(([name, def]) => ({ name, def }));
}

function refOf(def: any): string | undefined {
  return def?.reference || def?.reference_to;
}

// ─── Rule engine ────────────────────────────────────────────────────

/**
 * Lint the relationship / data-modeling conventions across the full object set.
 * Pure and deterministic — safe to call from both the `lint` command and the
 * metadata-generation scorer.
 */
export function lintDataModel(objects: any[]): LintIssue[] {
  const issues: LintIssue[] = [];
  if (!Array.isArray(objects) || objects.length === 0) return issues;

  // Index: parent object name → child relationships pointing at it.
  const childrenByParent: Record<string, Array<{ child: any; fieldName: string; def: any }>> = {};
  for (const child of objects) {
    if (!child?.name) continue;
    for (const { name: fieldName, def } of fieldEntries(child.fields)) {
      if (!RELATIONSHIP_TYPES.has(def?.type)) continue;
      const parent = refOf(def);
      if (!parent) continue;
      (childrenByParent[parent] ||= []).push({ child, fieldName, def });
    }
  }

  for (let i = 0; i < objects.length; i++) {
    const obj = objects[i];
    if (!obj?.name) continue;
    const objPath = `objects[${i}]`;
    const fields = fieldEntries(obj.fields);

    // R9 — object should have a derivable display/primary field.
    const hasNameField =
      !!obj.primaryField ||
      !!obj.titleFormat ||
      fields.some((f) => NAME_LIKE_FIELDS.includes(f.name));
    if (fields.length > 0 && !hasNameField) {
      issues.push({
        severity: 'suggestion',
        rule: 'object/missing-name-field',
        message: `Object "${obj.name}" has no name/title field or primaryField — records will display as raw IDs`,
        path: `${objPath}.fields`,
      });
    }

    for (const { name: fieldName, def } of fields) {
      if (!def || typeof def !== 'object') continue;
      const fieldPath = `${objPath}.fields.${fieldName}`;
      const type = def.type;

      // R8 — option fields need options (or an options source).
      if (OPTION_FIELD_TYPES.has(type)) {
        const hasOptions =
          (Array.isArray(def.options) && def.options.length > 0) ||
          !!def.optionsFrom || !!def.dataSource || !!def.reference;
        if (!hasOptions) {
          issues.push({
            severity: 'warning',
            rule: 'field/select-missing-options',
            message: `${type} field "${obj.name}.${fieldName}" has no options`,
            path: `${fieldPath}.options`,
          });
        }
      }

      if (!RELATIONSHIP_TYPES.has(type)) continue;
      const parent = refOf(def);

      // R1 — relationship fields must declare a reference target.
      if (!parent) {
        issues.push({
          severity: 'error',
          rule: 'relationship/missing-reference',
          message: `${type} field "${obj.name}.${fieldName}" is missing a reference target`,
          path: `${fieldPath}.reference`,
        });
        continue;
      }

      if (type === 'master_detail') {
        // R2 — master-detail children should require their parent.
        if (def.required !== true) {
          issues.push({
            severity: 'warning',
            rule: 'relationship/master-detail-required',
            message: `master_detail "${obj.name}.${fieldName}" → ${parent} should be required (a detail record cannot exist without its master)`,
            path: `${fieldPath}.required`,
            fix: 'required: true',
          });
        }
        // R3 — be explicit about cascade behaviour.
        if (def.deleteBehavior === undefined) {
          issues.push({
            severity: 'suggestion',
            rule: 'relationship/delete-behavior',
            message: `master_detail "${obj.name}.${fieldName}" → ${parent} should declare deleteBehavior (cascade/restrict/set_null)`,
            path: `${fieldPath}.deleteBehavior`,
            fix: "deleteBehavior: 'cascade'",
          });
        }
        // R5 — line-item children are usually entered inline with the parent.
        if (isLineItemName(obj.name) && def.inlineEdit !== true) {
          issues.push({
            severity: 'suggestion',
            rule: 'relationship/line-items-inline-edit',
            message: `"${obj.name}" looks like line items of ${parent}; consider inlineEdit: true on "${fieldName}" so it is entered inline within the ${parent} form`,
            path: `${fieldPath}.inlineEdit`,
            fix: 'inlineEdit: true',
          });
        }
      }

      // R4 — a line-item-shaped child should usually be master_detail, not lookup.
      if (type === 'lookup' && isLineItemName(obj.name)) {
        issues.push({
          severity: 'suggestion',
          rule: 'relationship/line-item-should-be-master-detail',
          message: `"${obj.name}" looks like line items of ${parent} but uses lookup; master_detail gives ownership + cascade + roll-ups`,
          path: `${fieldPath}.type`,
          fix: "type: 'master_detail'",
        });
      }

      // R6 — associations should NOT be inlined into the parent's entry form.
      if (def.inlineEdit === true && isAssociationName(obj.name)) {
        issues.push({
          severity: 'warning',
          rule: 'relationship/association-inline-edit',
          message: `"${obj.name}" is an association (comments/audit/activity), not line items — inlineEdit clutters the ${parent} entry form; surface it as a detail-page related list instead`,
          path: `${fieldPath}.inlineEdit`,
          fix: 'remove inlineEdit (use relatedList on the detail page)',
        });
      }
    }

    // R7 — a parent of master_detail children with numeric fields should roll one up.
    const children = childrenByParent[obj.name] || [];
    const summaryChildObjects = new Set(
      fields
        .filter((f) => f.def?.type === 'summary')
        .map((f) => f.def?.summaryOperations?.object || f.def?.reference)
        .filter(Boolean),
    );
    const seenSuggestedChild = new Set<string>();
    for (const { child, def } of children) {
      if (def?.type !== 'master_detail') continue;
      if (!child?.name || seenSuggestedChild.has(child.name)) continue;
      if (summaryChildObjects.has(child.name)) continue;
      // Only nudge when the child actually has something worth aggregating.
      const numericChildField = fieldEntries(child.fields).find((f) => NUMERIC_TYPES.has(f.def?.type));
      if (!numericChildField) continue;
      seenSuggestedChild.add(child.name);
      issues.push({
        severity: 'suggestion',
        rule: 'rollup/missing-summary',
        message: `"${obj.name}" owns "${child.name}" (master_detail) with numeric field "${numericChildField.name}" but has no roll-up summary; consider a summary field (count/sum) on ${obj.name}`,
        path: `${objPath}.fields`,
        fix: `summary field aggregating ${child.name}.${numericChildField.name}`,
      });
    }
  }

  return issues;
}
