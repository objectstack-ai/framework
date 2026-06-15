// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Detect FREE identifiers in a hook/action handler — names the body references
 * but that are bound neither by the function (params, locals) nor by the JS
 * runtime (globals). The canonical case (#1876, build↔runtime parity) is a
 * handler that calls a **module-scope helper**:
 *
 *   const slugify = (s) => s.toLowerCase();           // module scope
 *   defineStack({ hooks: [{ ..., handler: (ctx) => { ctx.record.slug = slugify(ctx.record.name); } }] });
 *
 * When such a handler is lowered to a metadata-only `body`, the `slugify`
 * reference ships without its definition and throws `ReferenceError` at runtime
 * — `objectstack build` is green but the app does not boot. By reporting the
 * free identifier the caller can keep the handler OUT of the body-only form and
 * fall back to BUNDLING it (esbuild bundles the real closure, so `slugify` comes
 * along) — no ReferenceError, no build break.
 *
 * Safety bias: this analysis is deliberately **conservative**. `bindings`
 * over-approximates (every name declared ANYWHERE in the function counts as
 * bound), and `GLOBALS` is generous. Both bias toward NOT flagging — a missed
 * case merely preserves today's behavior, whereas a false positive would only
 * ever cause a self-contained handler to be bundled instead of inlined (a
 * size/over-caution cost, never a correctness or build failure). We never
 * trade that bias for completeness.
 */

// `ts-morph` is already a CLI runtime dependency and re-exports the full
// TypeScript compiler namespace, so we use its `ts` rather than adding a direct
// `typescript` dependency.
import { ts } from 'ts-morph';

/**
 * Identifiers the JS runtime provides ambiently. Generous on purpose — listing
 * a name here means "assume the runtime has it" → don't flag → don't over-bundle
 * the rare false positive. A genuinely-missing global is a different problem
 * (sandbox capability), not a module-scope-helper leak.
 */
const GLOBALS: ReadonlySet<string> = new Set([
  // Value/namespace globals
  'Math', 'JSON', 'Date', 'Object', 'Array', 'String', 'Number', 'Boolean',
  'RegExp', 'Map', 'Set', 'WeakMap', 'WeakSet', 'Promise', 'Symbol', 'BigInt',
  'Function', 'Reflect', 'Proxy', 'Intl',
  'ArrayBuffer', 'SharedArrayBuffer', 'DataView',
  'Int8Array', 'Uint8Array', 'Uint8ClampedArray', 'Int16Array', 'Uint16Array',
  'Int32Array', 'Uint32Array', 'Float32Array', 'Float64Array', 'BigInt64Array', 'BigUint64Array',
  // Error constructors
  'Error', 'TypeError', 'RangeError', 'SyntaxError', 'ReferenceError',
  'EvalError', 'URIError', 'AggregateError',
  // Global functions
  'parseInt', 'parseFloat', 'isNaN', 'isFinite',
  'encodeURIComponent', 'decodeURIComponent', 'encodeURI', 'decodeURI',
  'structuredClone', 'queueMicrotask', 'atob', 'btoa',
  'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval',
  // Web-ish that the sandbox / Node commonly provide
  'URL', 'URLSearchParams', 'TextEncoder', 'TextDecoder', 'console',
  // Literal-ish globals & implicit bindings
  'undefined', 'NaN', 'Infinity', 'globalThis', 'arguments',
]);

export interface FreeIdentifierResult {
  /** Sorted, de-duplicated free identifier names (empty when self-contained). */
  free: string[];
  /** True when the source could not be parsed into a single function node. */
  unparsed: boolean;
}

/**
 * Parse `rawFunctionSource` (the result of `String(fn)`) into a single
 * function-like node. Handlers come in three `.toString()` shapes — arrow,
 * function expression/declaration, and object-method shorthand — so we try
 * three wraps and take the first that yields exactly one function-like node.
 */
function parseFunction(rawFunctionSource: string): ts.FunctionLikeDeclarationBase | null {
  const wraps = [
    rawFunctionSource, // function decl / named function expression statement
    `(${rawFunctionSource})`, // arrow / anonymous function expression
    `({${rawFunctionSource}})`, // object-method shorthand `name(ctx){...}`
  ];
  for (const code of wraps) {
    const sf = ts.createSourceFile('__handler__.js', code, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    let found: ts.FunctionLikeDeclarationBase | null = null;
    let count = 0;
    const visit = (node: ts.Node): void => {
      if (
        ts.isArrowFunction(node) ||
        ts.isFunctionExpression(node) ||
        ts.isFunctionDeclaration(node) ||
        ts.isMethodDeclaration(node)
      ) {
        count += 1;
        if (!found) found = node;
        return; // don't descend — nested functions are part of THIS one's body
      }
      ts.forEachChild(node, visit);
    };
    ts.forEachChild(sf, visit);
    // Exactly one top-level function-like node means the wrap matched cleanly.
    if (found && count === 1) return found;
  }
  return null;
}

/** Collect every binding name declared ANYWHERE within `fn` (over-approx). */
function collectBindings(fn: ts.FunctionLikeDeclarationBase): Set<string> {
  const bound = new Set<string>();

  const addBindingName = (name: ts.BindingName | ts.PropertyName | undefined): void => {
    if (!name) return;
    if (ts.isIdentifier(name)) {
      bound.add(name.text);
    } else if (ts.isObjectBindingPattern(name) || ts.isArrayBindingPattern(name)) {
      for (const el of name.elements) {
        if (ts.isBindingElement(el)) addBindingName(el.name);
      }
    }
  };

  const walk = (node: ts.Node): void => {
    if (ts.isParameter(node)) {
      addBindingName(node.name);
    } else if (ts.isVariableDeclaration(node)) {
      addBindingName(node.name);
    } else if (ts.isFunctionDeclaration(node) && node.name) {
      bound.add(node.name.text);
    } else if (ts.isClassDeclaration(node) && node.name) {
      bound.add(node.name.text);
    } else if (
      (ts.isFunctionExpression(node) || ts.isClassExpression(node)) &&
      node.name
    ) {
      // A named function/class expression binds its own name in its body.
      bound.add(node.name.text);
    } else if (ts.isCatchClause(node) && node.variableDeclaration) {
      addBindingName(node.variableDeclaration.name);
    } else if (ts.isBindingElement(node)) {
      addBindingName(node.name);
    }
    ts.forEachChild(node, walk);
  };

  // The function's own name (named function decl/expr) is in scope within it.
  if (
    (ts.isFunctionDeclaration(fn) || ts.isFunctionExpression(fn)) &&
    fn.name
  ) {
    bound.add(fn.name.text);
  }
  for (const p of fn.parameters) addBindingName(p.name);
  if (fn.body) walk(fn.body);
  // Parameter default initializers may declare nothing but reference things —
  // covered by the reference pass. Destructuring defaults are bindings:
  for (const p of fn.parameters) ts.forEachChild(p, walk);

  return bound;
}

/**
 * Collect identifiers used in VALUE position (potential references). Excludes
 * the false-positive sources: property-access member names, non-shorthand
 * object/class member keys, and statement labels. Binding names that slip
 * through are harmless — they are subtracted via `bindings` downstream.
 */
function collectReferences(fn: ts.FunctionLikeDeclarationBase): Set<string> {
  const refs = new Set<string>();

  const walk = (node: ts.Node): void => {
    // Skip type annotations entirely (compiled JS rarely has them, but be safe).
    if (ts.isTypeNode(node)) return;

    if (ts.isPropertyAccessExpression(node)) {
      // `a.b` — visit `a` (could be a ref) but NOT `b` (member name).
      walk(node.expression);
      return;
    }
    if (ts.isQualifiedName(node)) {
      walk(node.left);
      return;
    }
    if (ts.isPropertyAssignment(node)) {
      // `{ key: value }` — `key` is not a ref (unless computed). Visit value;
      // visit computed key names.
      if (ts.isComputedPropertyName(node.name)) walk(node.name.expression);
      walk(node.initializer);
      return;
    }
    if (ts.isMethodDeclaration(node) || ts.isPropertyDeclaration(node) || ts.isGetAccessor(node) || ts.isSetAccessor(node)) {
      if (node.name && ts.isComputedPropertyName(node.name)) walk(node.name.expression);
      ts.forEachChild(node, (c) => { if (c !== node.name) walk(c); });
      return;
    }
    if (ts.isLabeledStatement(node)) {
      // The label identifier is not a reference; visit the statement body.
      walk(node.statement);
      return;
    }
    if (ts.isBreakOrContinueStatement(node)) {
      return; // label, if any, is not a value reference
    }
    if (ts.isShorthandPropertyAssignment(node)) {
      // `{ x }` — x IS a value reference.
      refs.add(node.name.text);
      return;
    }
    if (ts.isIdentifier(node)) {
      refs.add(node.text);
      return;
    }
    ts.forEachChild(node, walk);
  };

  if (fn.body) walk(fn.body);
  // Parameter DEFAULT initializers are evaluated in scope and may reference
  // free identifiers; include them (their binding names are excluded above).
  for (const p of fn.parameters) {
    if (p.initializer) walk(p.initializer);
  }
  return refs;
}

/**
 * Compute the free identifiers of a handler function source.
 * Returns `{ free: [], unparsed: true }` when the source can't be parsed — the
 * caller treats "unparsed" as "don't block extraction" (conservative).
 */
export function detectFreeIdentifiers(rawFunctionSource: string): FreeIdentifierResult {
  const fn = parseFunction(rawFunctionSource);
  if (!fn) return { free: [], unparsed: true };

  const bound = collectBindings(fn);
  const refs = collectReferences(fn);

  const free: string[] = [];
  for (const name of refs) {
    if (bound.has(name)) continue;
    if (GLOBALS.has(name)) continue;
    free.push(name);
  }
  free.sort();
  return { free, unparsed: false };
}
