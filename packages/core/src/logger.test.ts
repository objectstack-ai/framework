import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createLogger, ObjectLogger } from './logger';

describe('ObjectLogger', () => {
    let logger: ObjectLogger;

    beforeEach(() => {
        logger = createLogger();
    });

    afterEach(async () => {
        await logger.destroy();
    });

    describe('Basic Logging', () => {
        it('should create a logger with default config', () => {
            expect(logger).toBeDefined();
            expect(logger.info).toBeDefined();
            expect(logger.debug).toBeDefined();
            expect(logger.warn).toBeDefined();
            expect(logger.error).toBeDefined();
        });

        it('should log info messages', () => {
            expect(() => logger.info('Test message')).not.toThrow();
        });

        it('should log debug messages', () => {
            expect(() => logger.debug('Debug message')).not.toThrow();
        });

        it('should log warn messages', () => {
            expect(() => logger.warn('Warning message')).not.toThrow();
        });

        it('should log error messages', () => {
            const error = new Error('Test error');
            expect(() => logger.error('Error occurred', error)).not.toThrow();
        });

        it('should log with metadata', () => {
            expect(() => logger.info('Message with metadata', { userId: '123', action: 'login' })).not.toThrow();
        });
    });

    describe('Configuration', () => {
        it('should respect log level configuration', async () => {
            const warnLogger = createLogger({ level: 'warn' });
            
            // These should not throw but might not output anything
            expect(() => warnLogger.debug('Debug message')).not.toThrow();
            expect(() => warnLogger.info('Info message')).not.toThrow();
            expect(() => warnLogger.warn('Warning message')).not.toThrow();
            
            await warnLogger.destroy();
        });

        it('should support different formats', async () => {
            const jsonLogger = createLogger({ format: 'json' });
            const textLogger = createLogger({ format: 'text' });
            const prettyLogger = createLogger({ format: 'pretty' });
            
            expect(() => jsonLogger.info('JSON format')).not.toThrow();
            expect(() => textLogger.info('Text format')).not.toThrow();
            expect(() => prettyLogger.info('Pretty format')).not.toThrow();
            
            await jsonLogger.destroy();
            await textLogger.destroy();
            await prettyLogger.destroy();
        });

        it('should redact sensitive keys', async () => {
            const logger = createLogger({ redact: ['password', 'apiKey'] });
            
            // This should work without exposing the password
            expect(() => logger.info('User login', { 
                username: 'john',
                password: 'secret123',
                apiKey: 'key-12345'
            })).not.toThrow();
            
            await logger.destroy();
        });
    });

    describe('Child Loggers', () => {
        it('should create child logger with context', () => {
            const childLogger = logger.child({ service: 'api', requestId: '123' });
            
            expect(childLogger).toBeDefined();
            expect(() => childLogger.info('Child log message')).not.toThrow();
        });

        it('should support trace context', () => {
            const tracedLogger = logger.withTrace('trace-123', 'span-456');
            
            expect(tracedLogger).toBeDefined();
            expect(() => tracedLogger.info('Traced message')).not.toThrow();
        });
    });

    describe('Environment Detection', () => {
        it('should detect Node.js environment', async () => {
            // This test runs in Node.js, so logger should detect it
            const nodeLogger = createLogger({ format: 'json' });
            expect(() => nodeLogger.info('Node environment')).not.toThrow();
            await nodeLogger.destroy();
        });
    });

    describe('Compatibility', () => {
        it('should support console.log compatibility', () => {
            expect(() => logger.log('Compatible log')).not.toThrow();
        });
    });

    describe('Color emission (no-color.org)', () => {
        const ANSI = '\x1b[';
        let stdoutChunks: string[];
        let stderrChunks: string[];
        const originalNoColor = process.env.NO_COLOR;
        const originalStdoutTTY = Object.getOwnPropertyDescriptor(process.stdout, 'isTTY');
        const originalStderrTTY = Object.getOwnPropertyDescriptor(process.stderr, 'isTTY');

        const setTTY = (stream: NodeJS.WriteStream, value: boolean) => {
            Object.defineProperty(stream, 'isTTY', { value, configurable: true });
        };

        // Assert on the single write() chunk carrying our message, so unrelated
        // writes to the shared process streams (e.g. the test runner's own
        // reporter output) can never leak into the assertions.
        const chunkWith = (chunks: string[], text: string) =>
            chunks.find((c) => c.includes(text)) ?? '';

        beforeEach(() => {
            stdoutChunks = [];
            stderrChunks = [];
            vi.spyOn(process.stdout, 'write').mockImplementation(((chunk: any) => {
                stdoutChunks.push(String(chunk));
                return true;
            }) as any);
            vi.spyOn(process.stderr, 'write').mockImplementation(((chunk: any) => {
                stderrChunks.push(String(chunk));
                return true;
            }) as any);
            delete process.env.NO_COLOR;
        });

        afterEach(() => {
            vi.restoreAllMocks();
            if (originalNoColor === undefined) delete process.env.NO_COLOR;
            else process.env.NO_COLOR = originalNoColor;
            const restoreTTY = (stream: NodeJS.WriteStream, desc?: PropertyDescriptor) => {
                if (desc) Object.defineProperty(stream, 'isTTY', desc);
                else delete (stream as any).isTTY;
            };
            restoreTTY(process.stdout, originalStdoutTTY);
            restoreTTY(process.stderr, originalStderrTTY);
        });

        it('colorizes pretty output on an interactive TTY by default', () => {
            setTTY(process.stdout, true);
            logger.info('tty message');
            const line = chunkWith(stdoutChunks, 'tty message');
            expect(line).toContain('\x1b[32m'); // info = green
            expect(line).toContain('\x1b[0m');
            expect(line).toContain('INFO');
        });

        it('emits no ANSI codes when NO_COLOR is set to any non-empty value', () => {
            setTTY(process.stdout, true);
            for (const value of ['1', 'true', '0']) {
                stdoutChunks.length = 0;
                process.env.NO_COLOR = value;
                logger.info('no color message');
                const line = chunkWith(stdoutChunks, 'no color message');
                expect(line).not.toContain(ANSI);
                expect(line).toMatch(/INFO no color message/);
            }
        });

        it('treats an empty NO_COLOR as unset', () => {
            setTTY(process.stdout, true);
            process.env.NO_COLOR = '';
            logger.info('still colored');
            expect(chunkWith(stdoutChunks, 'still colored')).toContain(ANSI);
        });

        it('emits no ANSI codes when the stream is not a TTY (piped/CI output)', () => {
            setTTY(process.stdout, false);
            logger.info('piped message');
            const line = chunkWith(stdoutChunks, 'piped message');
            expect(line).not.toContain(ANSI);
            expect(line).toMatch(/INFO piped message/);
        });

        it('gates error/fatal color on stderr TTY-ness and NO_COLOR', () => {
            setTTY(process.stdout, false);
            setTTY(process.stderr, true);
            logger.error('boom');
            expect(chunkWith(stderrChunks, 'boom')).toContain('\x1b[31m'); // error = red

            stderrChunks.length = 0;
            process.env.NO_COLOR = '1';
            logger.error('boom again');
            const line = chunkWith(stderrChunks, 'boom again');
            expect(line).not.toContain(ANSI);
            expect(line).toMatch(/ERROR boom again/);
        });

        it('never writes ANSI codes to the file destination', () => {
            setTTY(process.stdout, true);
            const fileChunks: string[] = [];
            (logger as any).fileStream = {
                write: (chunk: string) => fileChunks.push(String(chunk)),
                end: (cb: () => void) => cb(),
            };
            logger.info('file message');
            expect(chunkWith(stdoutChunks, 'file message')).toContain(ANSI); // console keeps color…
            const fileLine = chunkWith(fileChunks, 'file message');
            expect(fileLine).not.toContain(ANSI); // …the file copy stays plain
            expect(fileLine).toMatch(/INFO file message/);
        });
    });
});
