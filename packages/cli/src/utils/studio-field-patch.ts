// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Studio field-patch — ts-morph powered surgery on a single field
 * inside an `ObjectSchema.create({...})` or `defineObject({...})` call.
 *
 * Supported field shapes:
 *   account_number: Field.autonumber({ ...props })          // CallExpression
 *   owner:          Field.lookup('user', { ...props })      // CallExpression with second-arg object
 *   custom:         { ...props }                            // bare ObjectLiteral
 *
 * Properties we know how to update: `label`, `description`, `required`.
 * Falsy values (`null`, `''`, `false`) are interpreted as "remove this
 * property" so the source stays minimal.
 */
import {
  Project,
  SyntaxKind,
  type SourceFile,
  type ObjectLiteralExpression,
  type CallExpression,
  type PropertyAssignment,
} from 'ts-morph';

export interface FieldPatch {
  label?: string | null;
  description?: string | null;
  required?: boolean | null;
}

export type PatchResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Locate the field's inner object-literal and apply the patch.
 * Writes the file in place when successful.
 */
export async function patchObjectFieldFile(
  absPath: string,
  fieldKey: string,
  patch: FieldPatch,
): Promise<PatchResult> {
  return withFieldsObj(absPath, async (fieldsObj) => {
    const fieldProp = fieldsObj.getProperty(fieldKey);
    if (!fieldProp || !fieldProp.isKind(SyntaxKind.PropertyAssignment)) {
      return { ok: false, error: `field \`${fieldKey}\` not found in fields` };
    }
    const innerObj = resolveInnerObjectLiteral((fieldProp as PropertyAssignment).getInitializer());
    if (!innerObj) {
      return { ok: false, error: `field \`${fieldKey}\` initializer has no editable object literal` };
    }

    if ('label' in patch) applyStringProp(innerObj, 'label', patch.label);
    if ('description' in patch) applyStringProp(innerObj, 'description', patch.description);
    if ('required' in patch) applyBooleanProp(innerObj, 'required', patch.required);
    return { ok: true };
  });
}

/**
 * Append a new field to the `fields: { ... }` object literal. The
 * `initializer` is the raw TS source that goes on the right-hand side
 * of `<fieldName>: …` — typically an object literal but may be any
 * expression (e.g. `Field.text({ ... })`).
 *
 * Refuses to overwrite an existing field — callers must surface a
 * conflict to the user.
 */
export async function addObjectField(
  absPath: string,
  fieldName: string,
  initializer: string,
): Promise<PatchResult> {
  if (!/^[a-z_][a-z0-9_]*$/.test(fieldName)) {
    return { ok: false, error: `invalid field name \`${fieldName}\` (must be snake_case)` };
  }
  return withFieldsObj(absPath, async (fieldsObj) => {
    if (fieldsObj.getProperty(fieldName)) {
      return { ok: false, error: `field \`${fieldName}\` already exists` };
    }
    try {
      fieldsObj.addPropertyAssignment({ name: fieldName, initializer });
      return { ok: true };
    } catch (err: any) {
      return { ok: false, error: `add failed: ${err?.message ?? String(err)}` };
    }
  });
}

/**
 * Re-order the properties inside the `fields: { ... }` object literal
 * to match `order[]`. Field names absent from `order` are appended at
 * the end in their existing relative order — keeps the operation safe
 * if the UI has a stale snapshot.
 *
 * Implementation: snapshot the full source text of every property,
 * then rewrite the literal in the new order. This loses any comments
 * between properties — an acceptable trade-off for a v1; comments
 * inside a single property are preserved.
 */
export async function reorderObjectFields(
  absPath: string,
  order: readonly string[],
): Promise<PatchResult> {
  if (!Array.isArray(order)) {
    return { ok: false, error: 'order must be an array of field names' };
  }
  return withFieldsObj(absPath, async (fieldsObj) => {
    const props = fieldsObj.getProperties();
    const byName = new Map<string, string>();
    for (const p of props) {
      if (p.isKind(SyntaxKind.PropertyAssignment) || p.isKind(SyntaxKind.ShorthandPropertyAssignment)) {
        byName.set((p as any).getName(), p.getText());
      }
    }
    const seen = new Set<string>();
    const out: string[] = [];
    for (const name of order) {
      const t = byName.get(name);
      if (t) { out.push(t); seen.add(name); }
    }
    // Append any property the UI didn't know about so we never drop fields.
    for (const [name, t] of byName) {
      if (!seen.has(name)) out.push(t);
    }
    if (out.length === 0) {
      return { ok: false, error: '`fields` is empty — nothing to reorder' };
    }
    const newText = `{\n    ${out.join(',\n    ')},\n  }`;
    try {
      fieldsObj.replaceWithText(newText);
      return { ok: true };
    } catch (err: any) {
      return { ok: false, error: `reorder failed: ${err?.message ?? String(err)}` };
    }
  });
}

/**
 * Shared entry: open the file, drill into the `fields` literal, run
 * `mutate(...)`, persist on success. Centralizes the schema-call /
 * fields-literal lookup that every operation needs.
 */
async function withFieldsObj(
  absPath: string,
  mutate: (fieldsObj: ObjectLiteralExpression) => Promise<PatchResult>,
): Promise<PatchResult> {
  const project = new Project({ useInMemoryFileSystem: false, skipAddingFilesFromTsConfig: true });
  let sf: SourceFile;
  try {
    sf = project.addSourceFileAtPath(absPath);
  } catch (err: any) {
    return { ok: false, error: `parse failed: ${err?.message ?? String(err)}` };
  }
  const schemaCall = findSchemaCall(sf);
  if (!schemaCall) {
    return { ok: false, error: 'no ObjectSchema.create / defineObject call found in file' };
  }
  const schemaArg = schemaCall.getArguments()[0];
  if (!schemaArg || !schemaArg.isKind(SyntaxKind.ObjectLiteralExpression)) {
    return { ok: false, error: 'schema call argument is not an object literal' };
  }
  const fieldsProp = (schemaArg as ObjectLiteralExpression).getProperty('fields');
  if (!fieldsProp || !fieldsProp.isKind(SyntaxKind.PropertyAssignment)) {
    return { ok: false, error: 'schema object has no `fields` property' };
  }
  const fieldsInit = (fieldsProp as PropertyAssignment).getInitializer();
  if (!fieldsInit || !fieldsInit.isKind(SyntaxKind.ObjectLiteralExpression)) {
    return { ok: false, error: '`fields` initializer is not an object literal' };
  }
  const result = await mutate(fieldsInit as ObjectLiteralExpression);
  if (!result.ok) return result;
  try {
    await sf.save();
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: `write failed: ${err?.message ?? String(err)}` };
  }
}

// ─── helpers ────────────────────────────────────────────────────────

function findSchemaCall(sf: SourceFile): CallExpression | null {
  const calls = sf.getDescendantsOfKind(SyntaxKind.CallExpression);
  for (const call of calls) {
    const expr = call.getExpression().getText();
    if (expr === 'ObjectSchema.create' || expr === 'defineObject') {
      return call;
    }
  }
  return null;
}

/**
 * Given a property initializer, return the inner ObjectLiteralExpression
 * we should patch.
 *   - `{ ... }`                       → that literal
 *   - `Field.X({ ... })`              → first arg if object literal
 *   - `Field.X('rel', { ... })`       → second arg
 *   - `Field.X({ ... }, { ... })`     → first arg (defensive)
 */
function resolveInnerObjectLiteral(init: any): ObjectLiteralExpression | null {
  if (!init) return null;
  if (init.isKind(SyntaxKind.ObjectLiteralExpression)) {
    return init as ObjectLiteralExpression;
  }
  if (init.isKind(SyntaxKind.CallExpression)) {
    const args = (init as CallExpression).getArguments();
    for (const arg of args) {
      if (arg.isKind(SyntaxKind.ObjectLiteralExpression)) {
        return arg as ObjectLiteralExpression;
      }
    }
  }
  return null;
}

function applyStringProp(obj: ObjectLiteralExpression, key: string, value: string | null | undefined) {
  const existing = obj.getProperty(key);
  if (value == null || value === '') {
    if (existing) existing.remove();
    return;
  }
  const literal = JSON.stringify(value); // safe quoting + escape
  if (existing && existing.isKind(SyntaxKind.PropertyAssignment)) {
    (existing as PropertyAssignment).setInitializer(literal);
  } else {
    obj.addPropertyAssignment({ name: key, initializer: literal });
  }
}

function applyBooleanProp(obj: ObjectLiteralExpression, key: string, value: boolean | null | undefined) {
  const existing = obj.getProperty(key);
  // Default for `required` is false, so we omit the property when false
  // to keep the source minimal — matches what authors hand-write.
  if (value !== true) {
    if (existing) existing.remove();
    return;
  }
  if (existing && existing.isKind(SyntaxKind.PropertyAssignment)) {
    (existing as PropertyAssignment).setInitializer('true');
  } else {
    obj.addPropertyAssignment({ name: key, initializer: 'true' });
  }
}
