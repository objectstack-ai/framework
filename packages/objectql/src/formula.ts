// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Formula expression evaluator.
 *
 * Supports a subset of the formula function library documented in
 * `packages/spec/docs/formula-functions.md`, plus the `CONCAT` shorthand
 * commonly used in object schemas.
 *
 * The evaluator is intentionally minimal: a hand-written recursive descent
 * parser produces a small AST, then `evaluate` walks the AST against a
 * record.  No `eval`/`Function` is used, so untrusted expressions are safe.
 */

// ============================================================================
// Tokenizer
// ============================================================================

type Token =
  | { kind: 'number'; value: number }
  | { kind: 'string'; value: string }
  | { kind: 'ident'; value: string }
  | { kind: 'punct'; value: string };

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const len = input.length;

  while (i < len) {
    const c = input[i];

    // whitespace
    if (c === ' ' || c === '\t' || c === '\n' || c === '\r') {
      i++;
      continue;
    }

    // string literal: "..." or '...'
    if (c === '"' || c === "'") {
      const quote = c;
      i++;
      let s = '';
      while (i < len && input[i] !== quote) {
        if (input[i] === '\\' && i + 1 < len) {
          const next = input[i + 1];
          s += next === 'n' ? '\n' : next === 't' ? '\t' : next;
          i += 2;
        } else {
          s += input[i++];
        }
      }
      if (i >= len) throw new Error(`Unterminated string literal in formula: ${input}`);
      i++; // closing quote
      tokens.push({ kind: 'string', value: s });
      continue;
    }

    // number
    if ((c >= '0' && c <= '9') || (c === '.' && input[i + 1] >= '0' && input[i + 1] <= '9')) {
      let n = '';
      while (i < len && ((input[i] >= '0' && input[i] <= '9') || input[i] === '.')) {
        n += input[i++];
      }
      tokens.push({ kind: 'number', value: parseFloat(n) });
      continue;
    }

    // identifier
    if ((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || c === '_') {
      let id = '';
      while (
        i < len &&
        ((input[i] >= 'a' && input[i] <= 'z') ||
          (input[i] >= 'A' && input[i] <= 'Z') ||
          (input[i] >= '0' && input[i] <= '9') ||
          input[i] === '_' ||
          input[i] === '.')
      ) {
        id += input[i++];
      }
      tokens.push({ kind: 'ident', value: id });
      continue;
    }

    // multi-char punctuation
    const two = input.slice(i, i + 2);
    if (two === '>=' || two === '<=' || two === '!=' || two === '<>' || two === '==') {
      tokens.push({ kind: 'punct', value: two });
      i += 2;
      continue;
    }

    // single-char punctuation
    if ('()+-*/,=<>'.includes(c)) {
      tokens.push({ kind: 'punct', value: c });
      i++;
      continue;
    }

    throw new Error(`Unexpected character '${c}' in formula expression: ${input}`);
  }

  return tokens;
}

// ============================================================================
// Parser  (recursive descent, standard precedence)
// ============================================================================

type Expr =
  | { kind: 'num'; value: number }
  | { kind: 'str'; value: string }
  | { kind: 'ref'; name: string }
  | { kind: 'call'; name: string; args: Expr[] }
  | { kind: 'binop'; op: string; left: Expr; right: Expr }
  | { kind: 'unary'; op: string; operand: Expr };

class Parser {
  private pos = 0;
  constructor(private tokens: Token[]) {}

  private peek(): Token | undefined {
    return this.tokens[this.pos];
  }

  private consume(): Token {
    return this.tokens[this.pos++];
  }

  private match(kind: Token['kind'], value?: string): boolean {
    const t = this.peek();
    if (!t || t.kind !== kind) return false;
    if (value !== undefined && t.value !== value) return false;
    return true;
  }

  parse(): Expr {
    const expr = this.parseOr();
    if (this.pos < this.tokens.length) {
      throw new Error(`Unexpected trailing tokens at position ${this.pos}`);
    }
    return expr;
  }

  // OR is handled via function call OR(...); we still need comparison precedence
  private parseOr(): Expr {
    return this.parseComparison();
  }

  private parseComparison(): Expr {
    let left = this.parseAdditive();
    while (this.peek()?.kind === 'punct' && ['=', '==', '!=', '<>', '<', '>', '<=', '>='].includes((this.peek() as any).value)) {
      const op = (this.consume() as any).value;
      const right = this.parseAdditive();
      left = { kind: 'binop', op, left, right };
    }
    return left;
  }

  private parseAdditive(): Expr {
    let left = this.parseMultiplicative();
    while (this.peek()?.kind === 'punct' && ((this.peek() as any).value === '+' || (this.peek() as any).value === '-')) {
      const op = (this.consume() as any).value;
      const right = this.parseMultiplicative();
      left = { kind: 'binop', op, left, right };
    }
    return left;
  }

  private parseMultiplicative(): Expr {
    let left = this.parseUnary();
    while (this.peek()?.kind === 'punct' && ((this.peek() as any).value === '*' || (this.peek() as any).value === '/')) {
      const op = (this.consume() as any).value;
      const right = this.parseUnary();
      left = { kind: 'binop', op, left, right };
    }
    return left;
  }

  private parseUnary(): Expr {
    if (this.peek()?.kind === 'punct' && ((this.peek() as any).value === '-' || (this.peek() as any).value === '+')) {
      const op = (this.consume() as any).value;
      const operand = this.parseUnary();
      return { kind: 'unary', op, operand };
    }
    return this.parsePrimary();
  }

  private parsePrimary(): Expr {
    const t = this.peek();
    if (!t) throw new Error('Unexpected end of formula expression');

    if (t.kind === 'number') {
      this.consume();
      return { kind: 'num', value: t.value };
    }
    if (t.kind === 'string') {
      this.consume();
      return { kind: 'str', value: t.value };
    }
    if (t.kind === 'punct' && t.value === '(') {
      this.consume();
      const expr = this.parseOr();
      if (!this.match('punct', ')')) throw new Error('Expected )');
      this.consume();
      return expr;
    }
    if (t.kind === 'ident') {
      this.consume();
      // function call?
      if (this.match('punct', '(')) {
        this.consume();
        const args: Expr[] = [];
        if (!this.match('punct', ')')) {
          args.push(this.parseOr());
          while (this.match('punct', ',')) {
            this.consume();
            args.push(this.parseOr());
          }
        }
        if (!this.match('punct', ')')) throw new Error(`Expected ) after arguments to ${t.value}`);
        this.consume();
        return { kind: 'call', name: t.value.toUpperCase(), args };
      }
      // identifier reference (boolean literals handled here)
      const upper = t.value.toUpperCase();
      if (upper === 'TRUE') return { kind: 'num', value: 1 };
      if (upper === 'FALSE') return { kind: 'num', value: 0 };
      if (upper === 'NULL') return { kind: 'str', value: '' };
      return { kind: 'ref', name: t.value };
    }
    throw new Error(`Unexpected token: ${JSON.stringify(t)}`);
  }
}

// ============================================================================
// Evaluator
// ============================================================================

function getFieldValue(record: any, path: string): any {
  if (record == null) return undefined;
  if (!path.includes('.')) return record[path];
  const parts = path.split('.');
  let cur: any = record;
  for (const p of parts) {
    if (cur == null) return undefined;
    cur = cur[p];
  }
  return cur;
}

function isBlank(v: any): boolean {
  return v === undefined || v === null || v === '';
}

function toStr(v: any): string {
  if (v === undefined || v === null) return '';
  return String(v);
}

function toNum(v: any): number {
  if (v === undefined || v === null || v === '') return 0;
  if (typeof v === 'number') return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  const n = Number(v);
  return Number.isNaN(n) ? 0 : n;
}

function toBool(v: any): boolean {
  if (v === undefined || v === null || v === '' || v === 0 || v === false) return false;
  return true;
}

const FUNCTIONS: Record<string, (args: any[]) => any> = {
  // Text
  CONCAT: (a) => a.map(toStr).join(''),
  CONCATENATE: (a) => a.map(toStr).join(''),
  UPPER: (a) => toStr(a[0]).toUpperCase(),
  LOWER: (a) => toStr(a[0]).toLowerCase(),
  TEXT: (a) => toStr(a[0]),
  LEN: (a) => toStr(a[0]).length,

  // Math
  SUM: (a) => a.reduce((s, v) => s + toNum(v), 0),
  AVERAGE: (a) => (a.length ? a.reduce((s, v) => s + toNum(v), 0) / a.length : 0),
  ROUND: (a) => {
    const n = toNum(a[0]);
    const d = a.length > 1 ? toNum(a[1]) : 0;
    const f = Math.pow(10, d);
    return Math.round(n * f) / f;
  },
  CEILING: (a) => Math.ceil(toNum(a[0])),
  FLOOR: (a) => Math.floor(toNum(a[0])),

  // Date
  TODAY: () => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  },
  NOW: () => new Date(),
  YEAR: (a) => (a[0] ? new Date(a[0]).getFullYear() : 0),
  MONTH: (a) => (a[0] ? new Date(a[0]).getMonth() + 1 : 0),
  DAY: (a) => (a[0] ? new Date(a[0]).getDate() : 0),
  ADDDAYS: (a) => {
    const d = new Date(a[0]);
    d.setDate(d.getDate() + toNum(a[1]));
    return d;
  },

  // Logical
  IF: (a) => (toBool(a[0]) ? a[1] : a[2]),
  AND: (a) => a.every(toBool),
  OR: (a) => a.some(toBool),
  NOT: (a) => !toBool(a[0]),
  ISBLANK: (a) => isBlank(a[0]),
};

function evalExpr(expr: Expr, record: any): any {
  switch (expr.kind) {
    case 'num':
      return expr.value;
    case 'str':
      return expr.value;
    case 'ref':
      return getFieldValue(record, expr.name);
    case 'unary': {
      const v = evalExpr(expr.operand, record);
      if (expr.op === '-') return -toNum(v);
      return toNum(v);
    }
    case 'binop': {
      const l = evalExpr(expr.left, record);
      const r = evalExpr(expr.right, record);
      switch (expr.op) {
        case '+':
          if (typeof l === 'string' || typeof r === 'string') return toStr(l) + toStr(r);
          return toNum(l) + toNum(r);
        case '-':
          return toNum(l) - toNum(r);
        case '*':
          return toNum(l) * toNum(r);
        case '/':
          return toNum(l) / toNum(r);
        case '=':
        case '==':
          return l == r; // eslint-disable-line eqeqeq
        case '!=':
        case '<>':
          return l != r; // eslint-disable-line eqeqeq
        case '<':
          return toNum(l) < toNum(r);
        case '>':
          return toNum(l) > toNum(r);
        case '<=':
          return toNum(l) <= toNum(r);
        case '>=':
          return toNum(l) >= toNum(r);
      }
      throw new Error(`Unknown operator: ${expr.op}`);
    }
    case 'call': {
      const fn = FUNCTIONS[expr.name];
      if (!fn) throw new Error(`Unknown formula function: ${expr.name}`);
      // IF needs lazy evaluation? For correctness with field refs we still eval all
      // since records are plain values; matches Salesforce-style semantics.
      const args = expr.args.map((a) => evalExpr(a, record));
      return fn(args);
    }
  }
}

// ============================================================================
// Public API
// ============================================================================

export interface CompiledFormula {
  expression: string;
  ast: Expr;
  /** All bareword identifiers referenced (top-level field dependencies). */
  dependencies: string[];
}

const COMPILED_CACHE = new Map<string, CompiledFormula>();

export function compileFormula(expression: string): CompiledFormula {
  const cached = COMPILED_CACHE.get(expression);
  if (cached) return cached;

  const tokens = tokenize(expression);
  const ast = new Parser(tokens).parse();

  // Collect dependency field names (top-level part before first '.')
  const deps = new Set<string>();
  const visit = (e: Expr) => {
    switch (e.kind) {
      case 'ref': {
        const top = e.name.split('.')[0];
        // skip known function-only identifiers (TRUE/FALSE handled in parser)
        deps.add(top);
        break;
      }
      case 'unary':
        visit(e.operand);
        break;
      case 'binop':
        visit(e.left);
        visit(e.right);
        break;
      case 'call':
        e.args.forEach(visit);
        break;
    }
  };
  visit(ast);

  const compiled: CompiledFormula = {
    expression,
    ast,
    dependencies: Array.from(deps),
  };
  COMPILED_CACHE.set(expression, compiled);
  return compiled;
}

export function evaluateFormula(expression: string, record: any): any {
  try {
    const compiled = compileFormula(expression);
    return evalExpr(compiled.ast, record);
  } catch {
    return undefined;
  }
}
