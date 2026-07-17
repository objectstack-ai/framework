// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { Hook } from '@oclif/core';

/**
 * Drop `--` argument separators before oclif parses argv.
 *
 * pnpm appends forwarded args to a script *verbatim, including the `--`*, and
 * every nested `pnpm --filter` hop preserves it. So the documented
 * `pnpm dev -- --fresh -p 44637` reaches us as:
 *
 *   objectstack dev --seed-admin -- --fresh -p 44637
 *
 * oclif reads `--` as POSIX end-of-flags, so everything after it becomes
 * positional: `--fresh` is silently swallowed as the `package` arg and the
 * command dies with the opaque `Unexpected arguments: -p, 44637` (exit 2 +
 * a help dump). The flags the user asked for are simply dropped.
 *
 * No `os` command takes passthrough args — none sets `strict = false`, and none
 * reads raw argv — so a `--` carries no meaning here and is always a
 * package-manager artifact. Dropping it makes the npm-style `-- <flags>` form
 * and the bare form behave identically.
 *
 * The tradeoff: you can no longer force a `-`-prefixed token to be read as a
 * positional value. Every `os` positional is a config path, a metadata /
 * datasource / package name, or an id, none of which start with `-`. Revisit
 * this if a command ever needs true passthrough (e.g. wrapping another CLI).
 *
 * Note this cannot be fixed with oclif's `'--': false` parser option: that
 * option keeps flag-parsing on past the separator but then re-appends the `--`
 * into argv, so strict commands fail with `Unexpected argument: --` instead.
 */
const hook: Hook<'preparse'> = async ({ argv }) => argv.filter((arg) => arg !== '--');

export default hook;
