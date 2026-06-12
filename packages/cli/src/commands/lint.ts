// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { Args, Command, Flags } from '@oclif/core';
import chalk from 'chalk';
import { bundleRequire } from 'bundle-require';
import { normalizeStackInput } from '@objectstack/spec';
import { loadConfig, BUNDLE_REQUIRE_EXTERNALS } from '../utils/config.js';
import { computeI18nCoverage } from '../utils/i18n-coverage.js';
import { lintDataModel } from '../lint/data-model-rules.js';
import { validateWidgetBindings } from '../utils/validate-widget-bindings.js';
import { collectAndLintDocs } from '../utils/collect-docs.js';
import { scoreMetadata } from '../lint/score.js';
import { runMetadataEval } from '../lint/metadata-eval.js';
import { DEFAULT_METADATA_EVAL_CORPUS } from '../lint/corpus.js';
import {
  printHeader,
  printSuccess,
  printWarning,
  printError,
  printInfo,
  printStep,
  createTimer,
} from '../utils/format.js';

// ─── Types ──────────────────────────────────────────────────────────

type Severity = 'error' | 'warning' | 'suggestion';

interface LintIssue {
  severity: Severity;
  rule: string;
  message: string;
  path: string;
  fix?: string;
}

// ─── Rules ──────────────────────────────────────────────────────────

const SNAKE_CASE_RE = /^[a-z][a-z0-9_]*$/;

function checkSnakeCase(value: string, path: string, label: string): LintIssue | null {
  if (!SNAKE_CASE_RE.test(value)) {
    return {
      severity: 'error',
      rule: 'naming/snake-case',
      message: `${label} "${value}" must be snake_case`,
      path,
      fix: value.replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2').replace(/([a-z\d])([A-Z])/g, '$1_$2').toLowerCase().replace(/^_/, '').replace(/-/g, '_'),
    };
  }
  return null;
}

function checkLabelExists(item: any, path: string, kind: string): LintIssue | null {
  if (!item.label) {
    return {
      severity: 'error',
      rule: 'required/label',
      message: `${kind} "${item.name || '?'}" is missing a label`,
      path,
    };
  }
  return null;
}

function checkLabelCase(label: string, path: string): LintIssue | null {
  if (label && label[0] !== label[0].toUpperCase()) {
    return {
      severity: 'warning',
      rule: 'convention/label-case',
      message: `Label "${label}" should start with an uppercase letter`,
      path,
      fix: label.charAt(0).toUpperCase() + label.slice(1),
    };
  }
  return null;
}

function getViewLabel(view: any, viewPath: string): { label?: string; path: string } {
  if (view?.list?.label) {
    return { label: view.list.label, path: `${viewPath}.list.label` };
  }

  const listViews = view?.listViews && typeof view.listViews === 'object' ? view.listViews : {};
  for (const [key, listView] of Object.entries<any>(listViews)) {
    if (listView?.label) {
      return { label: listView.label, path: `${viewPath}.listViews.${key}.label` };
    }
  }

  if (view?.list) {
    return { path: `${viewPath}.list.label` };
  }

  const firstListViewKey = Object.keys(listViews)[0];
  if (firstListViewKey) {
    return { path: `${viewPath}.listViews.${firstListViewKey}.label` };
  }

  return { path: `${viewPath}.list.label` };
}

// ─── Lint Engine ────────────────────────────────────────────────────

export function lintConfig(config: any): LintIssue[] {
  const issues: LintIssue[] = [];

  const push = (issue: LintIssue | null) => {
    if (issue) issues.push(issue);
  };

  // ── Objects ──
  const objects: any[] = Array.isArray(config.objects) ? config.objects : [];

  for (let i = 0; i < objects.length; i++) {
    const obj = objects[i];
    const objPath = `objects[${i}]`;

    // Object name must be snake_case
    if (obj.name) {
      push(checkSnakeCase(obj.name, `${objPath}.name`, 'Object name'));
    }

    // Object must have label
    push(checkLabelExists(obj, `${objPath}.label`, 'Object'));

    // Object label conventions
    if (obj.label) {
      push(checkLabelCase(obj.label, `${objPath}.label`));
    }

    // Fields
    if (obj.fields && typeof obj.fields === 'object') {
      const fieldNames = Object.keys(obj.fields);

      if (fieldNames.length === 0) {
        issues.push({
          severity: 'warning',
          rule: 'structure/empty-fields',
          message: `Object "${obj.name || '?'}" has an empty fields map`,
          path: `${objPath}.fields`,
        });
      }

      for (const fieldName of fieldNames) {
        const field = obj.fields[fieldName];
        const fieldPath = `${objPath}.fields.${fieldName}`;

        // Field key must be snake_case
        push(checkSnakeCase(fieldName, fieldPath, 'Field name'));

        // Field must have label
        if (field && typeof field === 'object') {
          push(checkLabelExists({ ...field, name: fieldName }, `${fieldPath}.label`, 'Field'));
          if (field.label) {
            push(checkLabelCase(field.label, `${fieldPath}.label`));
          }
        }
      }
    } else if (!obj.fields) {
      issues.push({
        severity: 'error',
        rule: 'structure/no-fields',
        message: `Object "${obj.name || '?'}" has no fields defined`,
        path: `${objPath}.fields`,
      });
    }
  }

  // ── Views ──
  const views: any[] = Array.isArray(config.views) ? config.views : [];
  for (let i = 0; i < views.length; i++) {
    const view = views[i];
    const viewPath = `views[${i}]`;
    if (view.name) {
      push(checkSnakeCase(view.name, `${viewPath}.name`, 'View name'));
    }
    const viewLabel = getViewLabel(view, viewPath);
    push(checkLabelExists({ label: viewLabel.label, name: view.name }, viewLabel.path, 'View'));
    if (viewLabel.label) {
      push(checkLabelCase(viewLabel.label, viewLabel.path));
    }
  }

  // ── Apps ──
  const apps: any[] = Array.isArray(config.apps) ? config.apps : [];
  for (let i = 0; i < apps.length; i++) {
    const app = apps[i];
    const appPath = `apps[${i}]`;
    if (app.name) {
      push(checkSnakeCase(app.name, `${appPath}.name`, 'App name'));
    }
    push(checkLabelExists(app, `${appPath}.label`, 'App'));
    if (app.label) {
      push(checkLabelCase(app.label, `${appPath}.label`));
    }
  }

  // ── Flows ──
  const flows: any[] = Array.isArray(config.flows) ? config.flows : [];
  for (let i = 0; i < flows.length; i++) {
    const flow = flows[i];
    const flowPath = `flows[${i}]`;
    if (flow.name) {
      push(checkSnakeCase(flow.name, `${flowPath}.name`, 'Flow name'));
    }
  }

  // ── Agents ──
  const agents: any[] = Array.isArray(config.agents) ? config.agents : [];
  for (let i = 0; i < agents.length; i++) {
    const agent = agents[i];
    const agentPath = `agents[${i}]`;
    if (agent.name) {
      push(checkSnakeCase(agent.name, `${agentPath}.name`, 'Agent name'));
    }
  }

  // ── Data-model best practices (relationships / master-detail / roll-ups) ──
  // Cross-object rules that encode the conventions in ADR-0035 and the
  // objectstack-data/-ui skills. These double as the eval rubric (see score.ts).
  issues.push(...lintDataModel(objects));

  // ── Dashboard widget bindings (ADR-0021, issues #1719/#1721) ──
  // Reference integrity (errors): widget `dataset`/`dimensions`/`values` and
  // chartConfig axis/series fields must resolve against the declared
  // datasets. Advisory shapes (warnings): e.g. a table/pivot widget whose
  // binding resolves to count-only measures with no dimensions — almost
  // always a record listing that belongs in an object-bound ListView
  // (ADR-0017), not an analytics dataset.
  for (const w of validateWidgetBindings(config)) {
    issues.push({
      severity: w.severity,
      rule: w.rule,
      message: `${w.where}: ${w.message}`,
      path: w.path,
      fix: w.hint,
    });
  }

  return issues;
}

// ─── Command ────────────────────────────────────────────────────────

export default class Lint extends Command {
  static override description = 'Check ObjectStack configuration for style and convention issues';

  static override args = {
    config: Args.string({ description: 'Configuration file path', required: false }),
  };

  static override flags = {
    json: Flags.boolean({ description: 'Output as JSON' }),
    fix: Flags.boolean({ description: 'Show what would be fixed (dry-run)' }),
    score: Flags.boolean({
      description: 'Print a 0–100 metadata-quality score (the lint rubric) for this project',
    }),
    eval: Flags.boolean({
      description: 'Run the metadata-generation eval over the bundled golden corpus and report scores',
    }),
    generator: Flags.string({
      description: 'Path to a module that default-exports (prompt, id) => stack; enables live eval (scores generated output instead of fixtures). Requires --eval.',
    }),
    'eval-min': Flags.integer({
      description: 'Minimum passing score per eval case',
      default: 75,
    }),
    'skip-i18n': Flags.boolean({ description: 'Skip translation coverage checks' }),
    'i18n-strict': Flags.boolean({
      description: 'Treat missing translations in non-default locales as errors',
    }),
    'default-locale': Flags.string({
      description: 'Default locale for i18n coverage (must be 100% translated)',
      default: 'en',
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(Lint);
    const configPath = args.config;
    const timer = createTimer();

    // ── Eval mode — score generated metadata against the convention rubric ──
    // Short-circuits the project lint: this evaluates a generation corpus, not
    // the current config.
    if (flags.eval) {
      await this.runEval(flags, timer);
      return;
    }

    if (!flags.json) {
      printHeader('Lint');
      printStep('Loading configuration...');
    }

    try {
      const { config, absolutePath } = await loadConfig(configPath);

      if (!flags.json) {
        printInfo(`Config: ${chalk.white(absolutePath)}`);
      }

      const normalized = normalizeStackInput(config as Record<string, unknown>);
      const issues = lintConfig(normalized);

      // ── Package docs (ADR-0046) ── collected src/docs/*.md + inline docs:
      // flatness, namespace-prefixed names, MDX/image ban, link resolution.
      const docsResult = collectAndLintDocs(absolutePath, normalized as Record<string, unknown>);
      for (const d of docsResult.issues) {
        issues.push({ severity: d.severity, rule: d.rule, message: d.message, path: d.path });
      }

      // ── Translation coverage ──
      if (!flags['skip-i18n']) {
        const coverage = computeI18nCoverage(normalized, {
          defaultLocale: flags['default-locale'],
          strict: flags['i18n-strict'],
        });
        for (const c of coverage.issues) {
          issues.push({
            severity: c.severity === 'error' ? 'error' : 'warning',
            rule: `i18n/missing-${c.source}`,
            message: c.message,
            path: `translations.${c.locale}.${c.key}`,
          });
        }
      }

      // Metadata-quality score (the lint rubric expressed as 0–100).
      const score = flags.score ? scoreMetadata(normalized) : null;

      // ── JSON output ──
      if (flags.json) {
        const errors = issues.filter((i) => i.severity === 'error');
        const warnings = issues.filter((i) => i.severity === 'warning');
        const suggestions = issues.filter((i) => i.severity === 'suggestion');
        console.log(JSON.stringify({
          passed: errors.length === 0,
          total: issues.length,
          errors: errors.length,
          warnings: warnings.length,
          suggestions: suggestions.length,
          ...(score ? { score: score.score, grade: score.grade } : {}),
          issues,
          duration: timer.elapsed(),
        }, null, 2));
        if (errors.length > 0) process.exit(1);
        return;
      }

      console.log('');

      if (issues.length === 0) {
        printSuccess(`All checks passed ${chalk.dim(`(${timer.display()})`)}`);
        if (score) this.printScore(score);
        console.log('');
        return;
      }

      // Group by severity
      const errors = issues.filter((i) => i.severity === 'error');
      const warnings = issues.filter((i) => i.severity === 'warning');
      const suggestions = issues.filter((i) => i.severity === 'suggestion');

      const printIssue = (issue: LintIssue) => {
        const color =
          issue.severity === 'error' ? chalk.red :
          issue.severity === 'warning' ? chalk.yellow :
          chalk.blue;
        const icon =
          issue.severity === 'error' ? '✗' :
          issue.severity === 'warning' ? '⚠' :
          'ℹ';

        console.log(`  ${color(icon)} ${color(issue.message)}`);
        console.log(chalk.dim(`    ${issue.rule}  at ${issue.path}`));
        if (flags.fix && issue.fix) {
          console.log(chalk.green(`    → fix: ${issue.fix}`));
        }
      };

      if (errors.length > 0) {
        console.log(chalk.bold.red(`  Errors (${errors.length})`));
        errors.forEach(printIssue);
        console.log('');
      }

      if (warnings.length > 0) {
        console.log(chalk.bold.yellow(`  Warnings (${warnings.length})`));
        warnings.forEach(printIssue);
        console.log('');
      }

      if (suggestions.length > 0) {
        console.log(chalk.bold.blue(`  Suggestions (${suggestions.length})`));
        suggestions.forEach(printIssue);
        console.log('');
      }

      // Summary
      const parts: string[] = [];
      if (errors.length > 0) parts.push(chalk.red(`${errors.length} error(s)`));
      if (warnings.length > 0) parts.push(chalk.yellow(`${warnings.length} warning(s)`));
      if (suggestions.length > 0) parts.push(chalk.blue(`${suggestions.length} suggestion(s)`));
      console.log(`  ${parts.join(', ')} ${chalk.dim(`(${timer.display()})`)}`);

      if (score) this.printScore(score);

      if (flags.fix) {
        console.log('');
        printInfo('Dry-run mode: no files were modified.');
      }

      console.log('');

      if (errors.length > 0) process.exit(1);

    } catch (error: any) {
      if (flags.json) {
        console.log(JSON.stringify({ error: error.message }));
        process.exit(1);
      }
      console.log('');
      printError(error.message || String(error));
      process.exit(1);
    }
  }

  private printScore(score: ReturnType<typeof scoreMetadata>): void {
    const gColor =
      score.grade === 'A' ? chalk.green :
      score.grade === 'B' ? chalk.cyan :
      score.grade === 'C' ? chalk.yellow :
      chalk.red;
    console.log('');
    console.log(`  ${chalk.bold('Metadata quality:')} ${gColor(`${score.score}/100  (${score.grade})`)}`);
    const c = score.counts;
    console.log(
      chalk.dim(
        `    ${c.schemaErrors} schema · ${c.errors} error(s) · ${c.warnings} warning(s) · ${c.suggestions} suggestion(s)`,
      ),
    );
  }

  /**
   * Eval mode (`--eval`): run the metadata-generation rubric over the bundled
   * golden corpus (offline), or — when `--generator <module>` is supplied —
   * over the stacks that module produces for each prompt (live).
   */
  private async runEval(flags: any, timer: ReturnType<typeof createTimer>): Promise<void> {
    let generate: ((prompt: string, id: string) => unknown | Promise<unknown>) | undefined;

    if (flags.generator) {
      try {
        const { mod } = await bundleRequire({
          filepath: flags.generator,
          external: BUNDLE_REQUIRE_EXTERNALS,
        });
        const fn = (mod as any).default ?? (mod as any).generate;
        if (typeof fn !== 'function') {
          throw new Error('module must default-export a function (prompt, id) => stack');
        }
        generate = fn;
      } catch (error: any) {
        const msg = `Failed to load generator "${flags.generator}": ${error?.message || error}`;
        if (flags.json) console.log(JSON.stringify({ error: msg }));
        else printError(msg);
        process.exit(1);
      }
    }

    const report = await runMetadataEval(DEFAULT_METADATA_EVAL_CORPUS, {
      ...(generate ? { generate } : {}),
      minScore: flags['eval-min'],
    });

    if (flags.json) {
      console.log(JSON.stringify({ ...report, duration: timer.elapsed() }, null, 2));
      if (!report.ok) process.exit(1);
      return;
    }

    printHeader('Metadata Generation Eval');
    printInfo(`Mode: ${chalk.white(report.mode)}  ·  cases: ${report.total}  ·  pass bar: ${flags['eval-min']}`);
    console.log('');

    for (const r of report.results) {
      const ok = r.passed;
      const color = ok ? chalk.green : chalk.red;
      const icon = ok ? '✓' : '✗';
      console.log(`  ${color(icon)} ${chalk.bold(r.id)}  ${color(`${r.score.score}/100 (${r.score.grade})`)}`);
      if (r.generationError) {
        console.log(chalk.red(`    generation error: ${r.generationError}`));
      } else if (!ok) {
        const c = r.score.counts;
        console.log(chalk.dim(`    ${c.schemaErrors} schema · ${c.errors} error(s) · ${c.warnings} warning(s)`));
        const firstReal = r.score.issues.find((i) => i.severity !== 'suggestion') || r.score.issues[0];
        if (firstReal) console.log(chalk.dim(`    e.g. ${firstReal.rule}: ${firstReal.message}`));
      }
    }

    console.log('');
    const summaryColor = report.ok ? chalk.green : chalk.red;
    console.log(
      `  ${summaryColor(`${report.passed}/${report.total} passed`)} · mean ${report.meanScore}/100 ${chalk.dim(`(${timer.display()})`)}`,
    );
    console.log('');

    if (!report.ok) process.exit(1);
  }
}
