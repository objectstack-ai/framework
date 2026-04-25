// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

// ─── oclif Command Classes ──────────────────────────────────────────
// Each command is auto-discovered by oclif from `src/commands/`.
// These re-exports provide programmatic access for testing and integration.

export { default as CompileCommand } from './commands/compile.js';
export { default as ValidateCommand } from './commands/validate.js';
export { default as InfoCommand } from './commands/info.js';
export { default as InitCommand } from './commands/init.js';
export { default as GenerateCommand } from './commands/generate.js';
export { default as CreateCommand } from './commands/create.js';
export { default as BuildCommand } from './commands/build.js';
export { default as DevCommand } from './commands/dev.js';
export { default as ServeCommand } from './commands/serve.js';
export { default as StartCommand } from './commands/start.js';
export { default as TestCommand } from './commands/test.js';
export { default as DoctorCommand } from './commands/doctor.js';

// ─── Plugin topic subcommands ───────────────────────────────────────
export { default as PluginListCommand } from './commands/plugin/list.js';
export { default as PluginInfoCommand } from './commands/plugin/info.js';
export { default as PluginAddCommand } from './commands/plugin/add.js';
export { default as PluginRemoveCommand } from './commands/plugin/remove.js';

// ─── Projects topic subcommands ─────────────────────────────────────
export { default as ProjectsListCommand } from './commands/projects/list.js';
export { default as ProjectsShowCommand } from './commands/projects/show.js';
export { default as ProjectsCreateCommand } from './commands/projects/create.js';
export { default as ProjectsSwitchCommand } from './commands/projects/switch.js';
