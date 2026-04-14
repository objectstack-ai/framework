// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { Command } from 'commander';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEMPLATES_DIR = path.resolve(__dirname, 'templates');

// ─── Template Registry ──────────────────────────────────────────────

type TemplateFiles = Record<string, (name: string) => string>;

interface Template {
  description: string;
  files: TemplateFiles;
}

const TEMPLATES: Record<string, Template> = {
  'minimal-api': {
    description: 'Server + memory driver + 1 object + REST API',
    files: {
      'objectstack.config.ts': (name) => `import { defineStack } from '@objectstack/spec';
import * as objects from './src/objects';

export default defineStack({
  manifest: {
    id: 'com.example.${name}',
    namespace: '${name}',
    version: '0.1.0',
    type: 'app',
    name: '${toTitleCase(name)}',
    description: '${toTitleCase(name)} — built with ObjectStack',
  },

  objects: Object.values(objects),

  api: {
    rest: { enabled: true, basePath: '/api' },
  },
});
`,
      'package.json': (name) => JSON.stringify({
        name,
        version: '0.1.0',
        private: true,
        type: 'module',
        scripts: {
          dev: 'objectstack dev',
          start: 'objectstack serve',
          build: 'objectstack compile',
          validate: 'objectstack validate',
          typecheck: 'tsc --noEmit',
        },
        dependencies: {
          '@objectstack/spec': '^3.0.0',
          '@objectstack/runtime': '^3.0.0',
          '@objectstack/driver-memory': '^3.0.0',
          '@objectstack/plugin-hono-server': '^3.0.0',
        },
        devDependencies: {
          '@objectstack/cli': '^3.0.0',
          'typescript': '^5.3.0',
        },
      }, null, 2) + '\n',
      'tsconfig.json': () => JSON.stringify({
        compilerOptions: {
          target: 'ES2022',
          module: 'ESNext',
          moduleResolution: 'bundler',
          strict: true,
          esModuleInterop: true,
          skipLibCheck: true,
          outDir: 'dist',
          rootDir: '.',
          declaration: true,
        },
        include: ['*.ts', 'src/**/*'],
        exclude: ['dist', 'node_modules'],
      }, null, 2) + '\n',
      'src/objects/task.ts': () => `import { Data } from '@objectstack/spec';

const task: Data.Object = {
  name: 'task',
  label: 'Task',
  ownership: 'own',
  fields: {
    title: {
      type: 'text',
      label: 'Title',
      required: true,
    },
    description: {
      type: 'textarea',
      label: 'Description',
    },
    status: {
      type: 'select',
      label: 'Status',
      options: [
        { label: 'Open', value: 'open' },
        { label: 'In Progress', value: 'in_progress' },
        { label: 'Done', value: 'done' },
      ],
      defaultValue: 'open',
    },
    due_date: {
      type: 'date',
      label: 'Due Date',
    },
  },
};

export default task;
`,
      'src/objects/index.ts': () => `export { default as task } from './task';
`,
      '.gitignore': () => `node_modules/
dist/
*.tsbuildinfo
`,
      'README.md': (name) => `# ${toTitleCase(name)}

Built with [ObjectStack](https://objectstack.com).

## Quick Start

\`\`\`bash
# Install dependencies
npm install

# Start development server
npm run dev

# Validate configuration
npm run validate
\`\`\`

## Project Structure

- \`objectstack.config.ts\` — Stack definition (objects, API, settings)
- \`src/objects/\` — Object definitions
- \`dist/\` — Compiled output

## Learn More

- [ObjectStack Documentation](https://objectstack.com/docs)
`,
    },
  },

  'full-stack': {
    description: 'Server + UI + auth + 3 CRM objects',
    files: {
      'objectstack.config.ts': (name) => `import { defineStack } from '@objectstack/spec';
import * as objects from './src/objects';
import * as apps from './src/apps';

export default defineStack({
  manifest: {
    id: 'com.example.${name}',
    namespace: '${name}',
    version: '0.1.0',
    type: 'app',
    name: '${toTitleCase(name)}',
    description: '${toTitleCase(name)} CRM — built with ObjectStack',
  },

  objects: Object.values(objects),
  apps: Object.values(apps),

  api: {
    rest: { enabled: true, basePath: '/api' },
  },
});
`,
      'package.json': (name) => JSON.stringify({
        name,
        version: '0.1.0',
        private: true,
        type: 'module',
        scripts: {
          dev: 'objectstack dev',
          start: 'objectstack serve',
          build: 'objectstack compile',
          validate: 'objectstack validate',
          typecheck: 'tsc --noEmit',
        },
        dependencies: {
          '@objectstack/spec': '^3.0.0',
          '@objectstack/runtime': '^3.0.0',
          '@objectstack/driver-memory': '^3.0.0',
          '@objectstack/plugin-hono-server': '^3.0.0',
          '@objectstack/plugin-auth': '^3.0.0',
        },
        devDependencies: {
          '@objectstack/cli': '^3.0.0',
          'typescript': '^5.3.0',
        },
      }, null, 2) + '\n',
      'tsconfig.json': () => JSON.stringify({
        compilerOptions: {
          target: 'ES2022',
          module: 'ESNext',
          moduleResolution: 'bundler',
          strict: true,
          esModuleInterop: true,
          skipLibCheck: true,
          outDir: 'dist',
          rootDir: '.',
          declaration: true,
        },
        include: ['*.ts', 'src/**/*'],
        exclude: ['dist', 'node_modules'],
      }, null, 2) + '\n',
      'src/objects/contact.ts': () => `import { Data } from '@objectstack/spec';

const contact: Data.Object = {
  name: 'contact',
  label: 'Contact',
  ownership: 'own',
  fields: {
    first_name: {
      type: 'text',
      label: 'First Name',
      required: true,
    },
    last_name: {
      type: 'text',
      label: 'Last Name',
      required: true,
    },
    email: {
      type: 'text',
      label: 'Email',
    },
    phone: {
      type: 'text',
      label: 'Phone',
    },
    company: {
      type: 'lookup',
      label: 'Company',
      reference: 'company',
    },
  },
};

export default contact;
`,
      'src/objects/company.ts': () => `import { Data } from '@objectstack/spec';

const company: Data.Object = {
  name: 'company',
  label: 'Company',
  ownership: 'own',
  fields: {
    name: {
      type: 'text',
      label: 'Company Name',
      required: true,
    },
    website: {
      type: 'text',
      label: 'Website',
    },
    industry: {
      type: 'select',
      label: 'Industry',
      options: [
        { label: 'Technology', value: 'technology' },
        { label: 'Finance', value: 'finance' },
        { label: 'Healthcare', value: 'healthcare' },
        { label: 'Other', value: 'other' },
      ],
    },
  },
};

export default company;
`,
      'src/objects/deal.ts': () => `import { Data } from '@objectstack/spec';

const deal: Data.Object = {
  name: 'deal',
  label: 'Deal',
  ownership: 'own',
  fields: {
    name: {
      type: 'text',
      label: 'Deal Name',
      required: true,
    },
    amount: {
      type: 'number',
      label: 'Amount',
    },
    stage: {
      type: 'select',
      label: 'Stage',
      options: [
        { label: 'Prospecting', value: 'prospecting' },
        { label: 'Qualification', value: 'qualification' },
        { label: 'Proposal', value: 'proposal' },
        { label: 'Closed Won', value: 'closed_won' },
        { label: 'Closed Lost', value: 'closed_lost' },
      ],
      defaultValue: 'prospecting',
    },
    contact: {
      type: 'lookup',
      label: 'Contact',
      reference: 'contact',
    },
    company: {
      type: 'lookup',
      label: 'Company',
      reference: 'company',
    },
    close_date: {
      type: 'date',
      label: 'Close Date',
    },
  },
};

export default deal;
`,
      'src/objects/index.ts': () => `export { default as contact } from './contact';
export { default as company } from './company';
export { default as deal } from './deal';
`,
      'src/views/contact_list.ts': () => `import { UI } from '@objectstack/spec';

const contactList: UI.View = {
  name: 'contact_list',
  label: 'All Contacts',
  object: 'contact',
  type: 'list',
  columns: ['first_name', 'last_name', 'email', 'phone', 'company'],
};

export default contactList;
`,
      'src/views/company_list.ts': () => `import { UI } from '@objectstack/spec';

const companyList: UI.View = {
  name: 'company_list',
  label: 'All Companies',
  object: 'company',
  type: 'list',
  columns: ['name', 'website', 'industry'],
};

export default companyList;
`,
      'src/views/deal_list.ts': () => `import { UI } from '@objectstack/spec';

const dealList: UI.View = {
  name: 'deal_list',
  label: 'All Deals',
  object: 'deal',
  type: 'list',
  columns: ['name', 'amount', 'stage', 'contact', 'close_date'],
};

export default dealList;
`,
      'src/apps/crm.ts': () => `import { UI } from '@objectstack/spec';

const crm: UI.App = {
  name: 'crm',
  label: 'CRM',
  description: 'Customer Relationship Management',
  navigation: [
    { type: 'object', object: 'contact', label: 'Contacts' },
    { type: 'object', object: 'company', label: 'Companies' },
    { type: 'object', object: 'deal', label: 'Deals' },
  ],
};

export default crm;
`,
      'src/apps/index.ts': () => `export { default as crm } from './crm';
`,
      '.gitignore': () => `node_modules/
dist/
*.tsbuildinfo
`,
      'README.md': (name) => `# ${toTitleCase(name)}

A full-stack CRM application built with [ObjectStack](https://objectstack.com).

## Quick Start

\`\`\`bash
npm install
npm run dev
\`\`\`

## Project Structure

- \`objectstack.config.ts\` — Stack definition
- \`src/objects/\` — Data objects (Contact, Company, Deal)
- \`src/views/\` — List views
- \`src/apps/crm.ts\` — CRM app with navigation

## Learn More

- [ObjectStack Documentation](https://objectstack.com/docs)
`,
    },
  },

  plugin: {
    description: 'Plugin skeleton with test setup',
    files: {
      'objectstack.config.ts': (name) => `import { defineStack } from '@objectstack/spec';
import * as objects from './src/objects';

export default defineStack({
  manifest: {
    id: 'com.objectstack.plugin-${name}',
    namespace: 'plugin_${name}',
    version: '0.1.0',
    type: 'plugin',
    name: '${toTitleCase(name)} Plugin',
    description: 'ObjectStack Plugin: ${toTitleCase(name)}',
  },

  objects: Object.values(objects),
});
`,
      'package.json': (name) => JSON.stringify({
        name: `@objectstack/plugin-${name}`,
        version: '0.1.0',
        description: `ObjectStack Plugin: ${toTitleCase(name)}`,
        main: 'dist/index.js',
        types: 'dist/index.d.ts',
        type: 'module',
        scripts: {
          build: 'tsc',
          dev: 'tsc --watch',
          test: 'vitest run',
          validate: 'objectstack validate',
          typecheck: 'tsc --noEmit',
        },
        keywords: ['objectstack', 'plugin', name],
        author: '',
        license: 'MIT',
        dependencies: {
          '@objectstack/spec': '^3.0.0',
        },
        devDependencies: {
          '@types/node': '^22.0.0',
          'typescript': '^5.3.0',
          'vitest': '^4.0.0',
        },
      }, null, 2) + '\n',
      'tsconfig.json': () => JSON.stringify({
        compilerOptions: {
          target: 'ES2022',
          module: 'ESNext',
          moduleResolution: 'bundler',
          strict: true,
          esModuleInterop: true,
          skipLibCheck: true,
          outDir: 'dist',
          rootDir: '.',
          declaration: true,
        },
        include: ['*.ts', 'src/**/*'],
        exclude: ['dist', 'node_modules'],
      }, null, 2) + '\n',
      'src/index.ts': (name) => `/**
 * ${toTitleCase(name)} Plugin for ObjectStack
 *
 * Entry point — re-exports all plugin metadata.
 */
export * as objects from './objects';
`,
      'src/objects/sample.ts': (name) => `import { Data } from '@objectstack/spec';

const sample: Data.Object = {
  name: '${name}_sample',
  label: '${toTitleCase(name)} Sample',
  ownership: 'own',
  fields: {
    name: {
      type: 'text',
      label: 'Name',
      required: true,
    },
  },
};

export default sample;
`,
      'src/objects/index.ts': () => `export { default as sample } from './sample';
`,
      'test/sample.test.ts': (name) => `import { describe, it, expect } from 'vitest';
import sample from '../src/objects/sample';

describe('${name} plugin', () => {
  it('should export a valid sample object', () => {
    expect(sample).toBeDefined();
    expect(sample.name).toBe('${name}_sample');
    expect(sample.fields).toHaveProperty('name');
  });
});
`,
      '.gitignore': () => `node_modules/
dist/
*.tsbuildinfo
`,
      'README.md': (name) => `# @objectstack/plugin-${name}

ObjectStack Plugin: ${toTitleCase(name)}

## Installation

\`\`\`bash
npm install @objectstack/plugin-${name}
\`\`\`

## Usage

\`\`\`typescript
import { defineStack } from '@objectstack/spec';

export default defineStack({
  plugins: [
    '@objectstack/plugin-${name}',
  ],
});
\`\`\`

## Development

\`\`\`bash
# Run tests
npm test

# Build
npm run build

# Validate metadata
npm run validate
\`\`\`

## License

MIT
`,
    },
  },
};

// ─── Shared AI Configuration Files ──────────────────────────────────
// These files are added to every template so third-party developers
// get AI-assisted development (Copilot + Claude) out of the box.
// Templates are maintained as standalone files in src/templates/ for
// easy editing — no need to modify TypeScript code.

function readTemplate(filename: string): string {
  return fs.readFileSync(path.join(TEMPLATES_DIR, filename), 'utf-8');
}

const AI_CONFIG_FILES: TemplateFiles = {
  '.github/copilot-instructions.md': (name) =>
    readTemplate('copilot-instructions.md')
      .replaceAll('{{PROJECT_NAME}}', name)
      .replaceAll('{{PROJECT_TITLE}}', toTitleCase(name)),
};

// ─── Helpers ────────────────────────────────────────────────────────

function toCamelCase(str: string): string {
  return str.replace(/[-_]([a-z])/g, (_, c) => c.toUpperCase());
}

function toTitleCase(str: string): string {
  return str.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

// ─── Formatting (matches @objectstack/cli style) ────────────────────

function printHeader(title: string) {
  console.log(chalk.bold(`\n◆ ${title}`));
  console.log(chalk.dim('─'.repeat(40)));
}

function printKV(key: string, value: string) {
  console.log(`  ${chalk.dim(key + ':')} ${chalk.white(value)}`);
}

function printSuccess(msg: string) {
  console.log(chalk.green(`  ✓ ${msg}`));
}

function printError(msg: string) {
  console.log(chalk.red(`  ✗ ${msg}`));
}

function printStep(msg: string) {
  console.log(chalk.yellow(`  → ${msg}`));
}

function printWarning(msg: string) {
  console.log(chalk.yellow(`  ⚠ ${msg}`));
}

// ─── CLI Program ────────────────────────────────────────────────────

const program = new Command()
  .name('create-objectstack')
  .description('Create a new ObjectStack project')
  .version('3.0.0')
  .argument('[name]', 'Project name (defaults to current directory name)')
  .option(
    '-t, --template <template>',
    'Project template: minimal-api, full-stack, plugin',
    'minimal-api',
  )
  .option('--skip-install', 'Skip dependency installation')
  .action(async (name: string | undefined, options: { template: string; skipInstall?: boolean }) => {
    // Banner
    console.log('');
    console.log(chalk.bold.cyan('  ╔═══════════════════════════════════╗'));
    console.log(chalk.bold.cyan('  ║') + chalk.bold('   ◆ Create ObjectStack ') + chalk.dim('v3.0') + chalk.bold.cyan('       ║'));
    console.log(chalk.bold.cyan('  ╚═══════════════════════════════════╝'));

    printHeader('New Project');

    // Resolve template
    const template = TEMPLATES[options.template];
    if (!template) {
      printError(`Unknown template: ${options.template}`);
      console.log(chalk.dim(`  Available: ${Object.keys(TEMPLATES).join(', ')}`));
      process.exit(1);
    }

    // Resolve project name and directory
    const cwd = process.cwd();
    const projectName = name || path.basename(cwd);
    const targetDir = name ? path.resolve(cwd, name) : cwd;
    const isCurrentDir = targetDir === cwd;

    printKV('Project', projectName);
    printKV('Template', `${options.template} — ${template.description}`);
    printKV('Directory', targetDir);
    console.log('');

    // Guard: if creating in a sub-directory, check it doesn't already exist
    if (!isCurrentDir && fs.existsSync(targetDir)) {
      const existing = fs.readdirSync(targetDir);
      if (existing.length > 0) {
        printError(`Directory already exists and is not empty: ${targetDir}`);
        process.exit(1);
      }
    }

    const createdFiles: string[] = [];

    try {
      // Ensure target directory exists
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      // Merge template files with shared AI configuration files
      const allFiles: TemplateFiles = { ...template.files, ...AI_CONFIG_FILES };

      // Write every file defined by the template + AI config
      for (const [filePath, contentFn] of Object.entries(allFiles)) {
        const fullPath = path.join(targetDir, filePath);
        const dir = path.dirname(fullPath);

        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }

        fs.writeFileSync(fullPath, contentFn(projectName));
        createdFiles.push(filePath);
      }

      // Summary
      console.log(chalk.bold('  Created files:'));
      for (const f of createdFiles) {
        console.log(chalk.green(`    + ${f}`));
      }
      console.log('');

      // Install dependencies
      if (!options.skipInstall) {
        printStep('Installing dependencies...');
        try {
          // Detect package manager — prefer pnpm, fall back to npm
          const pm = detectPackageManager();
          execSync(`${pm} install`, { stdio: 'inherit', cwd: targetDir });
          console.log('');
        } catch {
          printWarning('Dependency installation failed. Run `npm install` manually.');
          console.log('');
        }
      }

      // Install ObjectStack AI skills via the standard skills CLI
      if (!options.skipInstall) {
        printStep('Installing AI skills for your coding agent...');
        try {
          execSync('npx -y skills add objectstack-ai/framework --all', {
            stdio: 'inherit',
            cwd: targetDir,
          });
          console.log('');
        } catch {
          printWarning(
            'Skills installation skipped. Run manually:\n' +
            '    npx skills add objectstack-ai/framework',
          );
          console.log('');
        }
      }

      printSuccess('Project created!');
      console.log('');

      // Next steps
      console.log(chalk.bold('  Next steps:'));
      if (!isCurrentDir) {
        console.log(chalk.dim(`    cd ${name}`));
      }
      if (options.skipInstall) {
        console.log(chalk.dim('    npm install'));
      }
      console.log(chalk.dim('    npm run dev           # Start development server'));
      console.log(chalk.dim('    npm run validate      # Check configuration'));
      if (options.skipInstall) {
        console.log('');
        console.log(chalk.bold('  AI Skills (recommended):'));
        console.log(chalk.dim('    npx skills add objectstack-ai/framework'));
      }
      console.log('');

    } catch (error: any) {
      printError(error.message || String(error));
      process.exit(1);
    }
  });

/**
 * Detect available package manager (pnpm > npm).
 */
function detectPackageManager(): string {
  try {
    execSync('pnpm --version', { stdio: 'ignore' });
    return 'pnpm';
  } catch {
    return 'npm';
  }
}

program.parse();
