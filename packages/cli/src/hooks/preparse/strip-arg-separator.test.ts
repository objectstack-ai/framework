// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect } from 'vitest';
import { Parser } from '@oclif/core';
import Dev from '../../commands/dev.js';
import hook from './strip-arg-separator.js';

/** Run the preparse hook the way oclif's Command.parse does. */
const preparse = async (argv: string[]): Promise<string[]> =>
  (await (hook as unknown as (opts: { argv: string[] }) => Promise<string[]>)({ argv })) ?? argv;

const parseDev = (argv: string[]) =>
  Parser.parse(argv, { flags: Dev.flags, args: Dev.args, strict: true });

describe('preparse: strip `--` argument separators', () => {
  it('drops a pnpm-injected separator', async () => {
    expect(await preparse(['dev', '--seed-admin', '--', '--fresh', '-p', '44637'])).toEqual([
      'dev',
      '--seed-admin',
      '--fresh',
      '-p',
      '44637',
    ]);
  });

  it('leaves argv without a separator untouched', async () => {
    const argv = ['dev', '--seed-admin', '--fresh', '-p', '44637'];
    expect(await preparse(argv)).toEqual(argv);
  });

  it('does not touch flags that merely contain dashes', async () => {
    const argv = ['dev', '--log-level', 'debug', '--admin-email', 'a@b.co'];
    expect(await preparse(argv)).toEqual(argv);
  });

  // The actual bug (#3114): `pnpm dev -- --fresh -p <port>` reaches the CLI as
  // `dev --seed-admin -- --fresh -p <port>`. Assert against the real Dev flags.
  it('makes `os dev --seed-admin -- --fresh -p N` parse identically to the bare form', async () => {
    const withSeparator = await parseDev(
      await preparse(['--seed-admin', '--', '--fresh', '-p', '44637']),
    );
    const bare = await parseDev(['--seed-admin', '--fresh', '-p', '44637']);

    expect(withSeparator.flags).toEqual(bare.flags);
    expect(withSeparator.flags.fresh).toBe(true);
    expect(withSeparator.flags['seed-admin']).toBe(true);
    expect(withSeparator.flags.port).toBe('44637');
    // `--fresh` must not be swallowed as the `package` positional.
    expect(withSeparator.args.package).toBe('all');
  });

  it('regression: without the hook the same argv loses --fresh and throws', async () => {
    await expect(parseDev(['--seed-admin', '--', '--fresh', '-p', '44637'])).rejects.toThrow(
      /Unexpected argument/,
    );
  });
});
