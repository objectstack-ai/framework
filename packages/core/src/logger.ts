// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { LoggerConfig, LogLevel } from '@objectstack/spec/system';
import type { Logger } from '@objectstack/spec/contracts';

// Re-export the contract type so consumers can do
// `import type { Logger } from '@objectstack/core/logger'` without also
// pulling `@objectstack/spec` into their bundle graph manually.
export type { Logger };

const LEVEL_ORDER: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
    fatal: 4,
    silent: 5,
};

const LEVEL_COLORS: Record<LogLevel, string> = {
    debug: '\x1b[36m',
    info: '\x1b[32m',
    warn: '\x1b[33m',
    error: '\x1b[31m',
    fatal: '\x1b[35m',
    silent: '',
};

const RESET = '\x1b[0m';

/**
 * Whether ANSI color may be written to the given stream.
 *
 * Follows the https://no-color.org convention: a non-empty `NO_COLOR` env var
 * disables color regardless of TTY, and non-TTY destinations (pipes, CI logs,
 * redirected output) always get plain text so plain-text log scanners see
 * uncolored level tags. Browser bundles have no `process`/TTY → plain text.
 */
function colorEnabled(stream: { isTTY?: boolean } | undefined): boolean {
    if (typeof process !== 'undefined') {
        const noColor = (process as any).env?.NO_COLOR;
        if (noColor !== undefined && noColor !== '') return false;
    }
    return Boolean(stream?.isTTY);
}

export class ObjectLogger implements Logger {
    private config: Required<Omit<LoggerConfig, 'file' | 'rotation' | 'name'>> & {
        file?: string;
        rotation?: { maxSize: string; maxFiles: number };
        name?: string;
    };
    private bindings: Record<string, any>;
    private fileStream?: any;

    constructor(config: Partial<LoggerConfig> = {}, bindings: Record<string, any> = {}) {
        this.config = {
            name: config.name,
            level: config.level ?? 'info',
            format: config.format ?? 'pretty',
            redact: config.redact ?? ['password', 'token', 'secret', 'key'],
            sourceLocation: config.sourceLocation ?? false,
            file: config.file,
            rotation: config.rotation ?? { maxSize: '10m', maxFiles: 5 },
        };
        this.bindings = bindings;

        if (this.config.file && typeof process !== 'undefined') {
            this.openFileStream(this.config.file);
        }
    }

    private openFileStream(path: string) {
        try {
            // Lazy require to avoid bundling issues
            const fs = require('fs');
            const dir = require('path').dirname(path);
            fs.mkdirSync(dir, { recursive: true });
            this.fileStream = fs.createWriteStream(path, { flags: 'a' });
        } catch {
            // ignore — file logging is optional
        }
    }

    private isEnabled(level: LogLevel): boolean {
        return LEVEL_ORDER[level] >= LEVEL_ORDER[this.config.level];
    }

    private redactSensitive(obj: any): any {
        if (!obj || typeof obj !== 'object') return obj;
        const redacted = Array.isArray(obj) ? [...obj] : { ...obj };
        for (const key in redacted) {
            const lower = key.toLowerCase();
            if (this.config.redact.some((p: string) => lower.includes(p.toLowerCase()))) {
                redacted[key] = '***REDACTED***';
            } else if (typeof redacted[key] === 'object' && redacted[key] !== null) {
                redacted[key] = this.redactSensitive(redacted[key]);
            }
        }
        return redacted;
    }

    private write(level: LogLevel, message: string, meta?: Record<string, any>, error?: Error) {
        if (!this.isEnabled(level)) return;

        const context = this.redactSensitive({
            ...this.bindings,
            ...meta,
            ...(error ? { error: { message: error.message, stack: error.stack } } : {}),
        });

        const hasContext = Object.keys(context).length > 0;
        const ts = new Date().toISOString();

        const isErrorLevel = level === 'error' || level === 'fatal';
        const proc = typeof process !== 'undefined' ? (process as any) : undefined;
        const stream = proc ? (isErrorLevel ? proc.stderr : proc.stdout) : undefined;

        let line: string; // console output — may carry ANSI color
        let plainLine: string; // file output — never colored

        if (this.config.format === 'json') {
            line = plainLine = JSON.stringify({
                time: ts,
                level,
                ...(this.config.name ? { name: this.config.name } : {}),
                msg: message,
                ...context,
            });
        } else if (this.config.format === 'text') {
            const parts = [ts, level.toUpperCase(), message];
            if (hasContext) parts.push(JSON.stringify(context));
            line = plainLine = parts.join(' | ');
        } else {
            // pretty
            const label = this.config.name ? `[${this.config.name}] ` : '';
            const head = `${ts} ${level.toUpperCase()}`;
            let tail = ` ${label}${message}`;
            if (hasContext) tail += ` ${JSON.stringify(context)}`;
            plainLine = head + tail;
            const color = LEVEL_COLORS[level] || '';
            line = color && colorEnabled(stream) ? `${color}${head}${RESET}${tail}` : plainLine;
        }

        // Browser-safe output: prefer process streams when available, otherwise
        // fall back to console. `process` may be missing entirely (browsers) or
        // present without stdio streams (bundler shims) — both fall through to
        // console. The previous unguarded `process.stderr?.write` threw
        // `ReferenceError: process is not defined` in browsers because
        // `process` itself is the missing global, not just its `stderr` field.
        if (stream) {
            stream.write(line + '\n');
        } else if (typeof console !== 'undefined') {
            const fn =
                level === 'error' || level === 'fatal' ? console.error
                : level === 'warn' ? console.warn
                : level === 'debug' ? console.debug
                : console.log;
            fn(line);
        }

        if (this.fileStream) {
            this.fileStream.write(plainLine + '\n');
        }
    }

    debug(message: string, meta?: Record<string, any>): void {
        this.write('debug', message, meta);
    }

    info(message: string, meta?: Record<string, any>): void {
        this.write('info', message, meta);
    }

    warn(message: string, meta?: Record<string, any>): void {
        this.write('warn', message, meta);
    }

    error(message: string, errorOrMeta?: Error | Record<string, any>, meta?: Record<string, any>): void {
        if (errorOrMeta instanceof Error) {
            this.write('error', message, meta, errorOrMeta);
        } else {
            this.write('error', message, errorOrMeta);
        }
    }

    fatal(message: string, errorOrMeta?: Error | Record<string, any>, meta?: Record<string, any>): void {
        if (errorOrMeta instanceof Error) {
            this.write('fatal', message, meta, errorOrMeta);
        } else {
            this.write('fatal', message, errorOrMeta);
        }
    }

    log(message: string, ...args: any[]): void {
        this.info(message, args.length > 0 ? { args } : undefined);
    }

    child(context: Record<string, any>): ObjectLogger {
        const child = new ObjectLogger(this.config, { ...this.bindings, ...context });
        // Share the file stream — no double-open
        child.fileStream = this.fileStream;
        return child;
    }

    withTrace(traceId: string, spanId?: string): ObjectLogger {
        return this.child({ traceId, spanId });
    }

    async destroy(): Promise<void> {
        if (this.fileStream) {
            await new Promise<void>((resolve) => this.fileStream.end(resolve));
            this.fileStream = undefined;
        }
    }
}

export function createLogger(config?: Partial<LoggerConfig>): ObjectLogger {
    return new ObjectLogger(config);
}
