// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { Args, Command, Flags } from '@oclif/core';
import path from 'path';
import fs from 'fs';
import net from 'net';
import chalk from 'chalk';
import { bundleRequire } from 'bundle-require';
import { loadConfig } from '../utils/config.js';
import { isHostConfig } from '../utils/plugin-detection.js';
import {
  printHeader,
  printKV,
  printSuccess,
  printError,
  printStep,
  printInfo,
  printServerReady,
} from '../utils/format.js';
import {
  STUDIO_PATH,
  resolveStudioPath,
  hasStudioDist,
  createStudioStaticPlugin,
} from '../utils/studio.js';

// Helper to find available port
const getAvailablePort = async (startPort: number): Promise<number> => {
  const isPortAvailable = (port: number): Promise<boolean> => {
    return new Promise((resolve) => {
      const server = net.createServer();
      server.once('error', (err: any) => {
        resolve(false);
      });
      server.once('listening', () => {
        server.close(() => resolve(true));
      });
      server.listen(port);
    });
  };

  let port = startPort;
  while (!(await isPortAvailable(port))) {
    port++;
    if (port > startPort + 100) {
       throw new Error(`Could not find an available port starting from ${startPort}`);
    }
  }
  return port;
};

export default class Serve extends Command {
  static override description = 'Start ObjectStack server with plugins from configuration';

  static override args = {
    config: Args.string({ description: 'Configuration file path', required: false, default: 'objectstack.config.ts' }),
  };

  static override flags = {
    port: Flags.string({ char: 'p', description: 'Server port', default: '3000' }),
    dev: Flags.boolean({ description: 'Run in development mode (load devPlugins)' }),
    ui: Flags.boolean({ description: 'Enable Studio UI at /_studio/ (default: true in dev mode)' }),
    server: Flags.boolean({ description: 'Start HTTP server plugin', default: true, allowNo: true }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(Serve);

    let port = parseInt(flags.port);
    try {
      const availablePort = await getAvailablePort(port);
      if (availablePort !== port) {
        port = availablePort;
      }
    } catch (e) {
      // Ignore error and try with original port
    }

    const isDev = flags.dev || process.env.NODE_ENV === 'development';

    const absolutePath = path.resolve(process.cwd(), args.config!);
    const relativeConfig = path.relative(process.cwd(), absolutePath);
    
    if (!fs.existsSync(absolutePath)) {
      printError(`Configuration file not found: ${absolutePath}`);
      console.log(chalk.dim('  Hint: Run `objectstack init` to create a new project'));
      this.exit(1);
    }

    // Quiet loading — only show a single spinner line
    console.log('');
    console.log(chalk.dim(`  Loading ${relativeConfig}...`));

    // Track loaded plugins for summary
    const loadedPlugins: string[] = [];
    const shortPluginName = (raw: string) => {
      // Map verbose internal IDs to short display names
      if (raw.includes('objectql')) return 'ObjectQL';
      if (raw.includes('driver') && raw.includes('memory')) return 'MemoryDriver';
      if (raw.startsWith('plugin.app.')) return raw.replace('plugin.app.', '').split('.').pop() || raw;
      if (raw.includes('hono')) return 'HonoServer';
      return raw;
    };
    const trackPlugin = (name: string) => { loadedPlugins.push(shortPluginName(name)); };

    // Save original console/stdout methods — we'll suppress noise during boot
    const originalConsoleLog = console.log;
    const originalConsoleDebug = console.debug;
    const origStdoutWrite = process.stdout.write.bind(process.stdout);
    let bootQuiet = false;

    const restoreOutput = () => {
      bootQuiet = false;
      process.stdout.write = origStdoutWrite;
      console.log = originalConsoleLog;
      console.debug = originalConsoleDebug;
    };

    const portShifted = parseInt(flags.port) !== port;

    try {
      // ── Suppress ALL runtime noise during boot ────────────────────
      // Multiple sources write to stdout during startup:
      //   • Pino-pretty (direct process.stdout.write)
      //   • ObjectLogger browser fallback (console.log)
      //   • SchemaRegistry (console.log)
      // We capture stdout entirely, then restore after runtime.start().
      bootQuiet = true;
      process.stdout.write = (chunk: any, ...rest: any[]) => {
        if (bootQuiet) return true;  // swallow
        return (origStdoutWrite as any)(chunk, ...rest);
      };
      console.log = (...args: any[]) => { if (!bootQuiet) originalConsoleLog(...args); };
      console.debug = (...args: any[]) => { if (!bootQuiet) originalConsoleDebug(...args); };

      // Load configuration
      const { mod } = await bundleRequire({
        filepath: absolutePath,
      });

      const config = mod.default || mod;

      if (!config) {
        throw new Error(`No default export found in ${args.config}`);
      }

      // Import ObjectStack runtime
      const { Runtime } = await import('@objectstack/runtime');

      // Set kernel logger to 'silent' — the CLI manages its own output
      const loggerConfig = { level: 'silent' as const };

      const runtime = new Runtime({
        kernel: {
            logger: loggerConfig
        }
      });
      const kernel = runtime.getKernel();

      // Load plugins from configuration
      let plugins = config.plugins || [];

      // Merge devPlugins if in dev mode
      if (flags.dev && config.devPlugins) {
        plugins = [...plugins, ...config.devPlugins];
      }

      // 1. Auto-register ObjectQL Plugin if objects define but plugins missing
      const hasObjectQL = plugins.some((p: any) => p.name?.includes('objectql') || p.constructor?.name?.includes('ObjectQL'));
      if (config.objects && !hasObjectQL) {
         try {
           const { ObjectQLPlugin } = await import('@objectstack/objectql');
           await kernel.use(new ObjectQLPlugin());
           trackPlugin('ObjectQL');
         } catch (e: any) {
           // silent
         }
      }

      // 2. Auto-register Memory Driver if in Dev and no driver configured
      const hasDriver = plugins.some((p: any) => p.name?.includes('driver') || p.constructor?.name?.includes('Driver'));
      if (isDev && !hasDriver && config.objects) {
         try {
           const { DriverPlugin } = await import('@objectstack/runtime');
           const { InMemoryDriver } = await import('@objectstack/driver-memory');
           await kernel.use(new DriverPlugin(new InMemoryDriver()));
           trackPlugin('MemoryDriver');
         } catch (e: any) {
           // silent
         }
      }

      // 3. Auto-register AppPlugin if config contains app definitions
      // Skip if config is a host/aggregator config that already contains
      // instantiated plugins — wrapping it would cause duplicate registration
      // and startup failures (e.g. plugin.app.dev-workspace).
      if (!isHostConfig(config) && (config.objects || config.manifest || config.apps)) {
        try {
            const { AppPlugin } = await import('@objectstack/runtime');
            await kernel.use(new AppPlugin(config));
            trackPlugin('App');
        } catch (e: any) {
            // silent
        }
      }

      // 3b. Auto-register I18nServicePlugin if config contains translations/i18n
      // This ensures i18n REST routes work out of the box without manual plugin registration.
      const hasI18nPlugin = plugins.some(
        (p: any) => p.name === 'com.objectstack.service.i18n'
            || p.constructor?.name === 'I18nServicePlugin'
      );
      const configHasTranslations = (
        (Array.isArray(config.translations) && config.translations.length > 0)
        || config.i18n
        || (config.manifest && (
            (Array.isArray(config.manifest.translations) && config.manifest.translations.length > 0)
            || config.manifest.i18n
          ))
      );
      if (!hasI18nPlugin && configHasTranslations) {
        try {
          // Dynamic import with variable to prevent tsc from resolving the optional package
          const i18nPkg = '@objectstack/service-i18n';
          const { I18nServicePlugin } = await import(/* webpackIgnore: true */ i18nPkg);
          const i18nCfg = config.i18n || config.manifest?.i18n || {};
          await kernel.use(new I18nServicePlugin({
            defaultLocale: i18nCfg.defaultLocale,
            fallbackLocale: i18nCfg.fallbackLocale || i18nCfg.defaultLocale || 'en',
          }));
          trackPlugin('I18nService');
        } catch {
          // @objectstack/service-i18n not installed — kernel memory fallback will handle i18n
        }
      } else if (!hasI18nPlugin && !configHasTranslations) {
        // No translations and no explicit i18n plugin — this is fine, kernel fallback works
      }

      // Add HTTP server plugin BEFORE config plugins so that the
      // http-server service is available for any plugin that needs it
      // during init/start (e.g. AuthPlugin).
      // Skip if config already contains a HonoServerPlugin to avoid
      // duplicate registration.
      const configHasHonoServer = plugins.some(
        (p: any) => p.name === 'com.objectstack.server.hono' || p.constructor?.name === 'HonoServerPlugin'
      );

      if (flags.server && !configHasHonoServer) {
        try {
          const { HonoServerPlugin } = await import('@objectstack/plugin-hono-server');
          const serverPlugin = new HonoServerPlugin({ port });
          await kernel.use(serverPlugin);
          trackPlugin('HonoServer');
        } catch (e: any) {
          console.warn(chalk.yellow(`  ⚠ HTTP server plugin not available: ${e.message}`));
        }
      }

      if (plugins.length > 0) {
        for (const plugin of plugins) {
          try {
            let pluginToLoad = plugin;

            // Resolve string references (package names)
            if (typeof plugin === 'string') {
              try {
                 const imported = await import(plugin);
                 pluginToLoad = imported.default || imported;
              } catch (importError: any) {
                 throw new Error(`Failed to import plugin '${plugin}': ${importError.message}`);
              }
            }

            // Wrap raw config objects (no init/start) into AppPlugin
            // This handles plugins defined as plain { name, objects, ... } bundles
            if (pluginToLoad && typeof pluginToLoad === 'object' && !pluginToLoad.init) {
              try {
                const { AppPlugin } = await import('@objectstack/runtime');
                pluginToLoad = new AppPlugin(pluginToLoad);
              } catch (e: any) {
                // Fall through to kernel.use which will report the error
              }
            }

            await kernel.use(pluginToLoad);
            const pluginName = plugin.name || plugin.constructor?.name || 'unnamed';
            trackPlugin(pluginName);
          } catch (e: any) {
            console.error(chalk.red(`  ✗ Failed to load plugin: ${e.message}`));
          }
        }
      }

      // Register REST API and Dispatcher plugins (consume http.server + protocol services)
      if (flags.server) {
        try {
          const { createRestApiPlugin } = await import('@objectstack/rest');
          await kernel.use(createRestApiPlugin());
          trackPlugin('RestAPI');
        } catch (e: any) {
          // @objectstack/rest is optional
        }

        // Register Dispatcher plugin (auth, graphql, analytics, packages, hub, storage, automation)
        try {
          const { createDispatcherPlugin } = await import('@objectstack/runtime');
          await kernel.use(createDispatcherPlugin());
          trackPlugin('Dispatcher');
        } catch (e: any) {
          // optional
        }
      }

      // ── Studio UI ─────────────────────────────────────────────────
      // In dev mode, Studio UI is enabled by default (use --no-ui to disable).
      // Always serves the pre-built dist/ — no Vite dev server, no extra port.
      const enableUI = flags.ui || isDev;

      if (enableUI) {
        const studioPath = resolveStudioPath();
        if (!studioPath) {
          console.warn(chalk.yellow(`  ⚠ @objectstack/studio not found — skipping UI`));
        } else if (hasStudioDist(studioPath)) {
          const distPath = path.join(studioPath, 'dist');
          await kernel.use(createStudioStaticPlugin(distPath, { isDev }));
          trackPlugin('StudioUI');
        } else {
          console.warn(chalk.yellow(`  ⚠ Studio dist not found — run "pnpm --filter @objectstack/studio build" first`));
        }
      }

      // Boot the runtime
      await runtime.start();

      // Wait briefly for pino worker thread buffers to flush, then restore
      await new Promise(r => setTimeout(r, 100));
      restoreOutput();

      // ── Clean startup summary ──────────────────────────────────────
      printServerReady({
        port,
        configFile: relativeConfig,
        isDev,
        pluginCount: loadedPlugins.length,
        pluginNames: loadedPlugins,
        uiEnabled: enableUI,
        studioPath: STUDIO_PATH,
      });

      // Keep process alive
      process.on('SIGINT', async () => {
        console.warn(chalk.yellow(`\n\n⏹  Stopping server...`));
        await runtime.getKernel().shutdown();
        console.log(chalk.green(`✅ Server stopped`));
        process.exit(0);
      });

    } catch (error: any) {
      restoreOutput();
      console.log('');
      printError(error.message || String(error));
      if (process.env.DEBUG) console.error(chalk.dim(error.stack));
      this.exit(1);
    }
  }
}
