---
"@objectstack/cli": patch
---

fix(cli): tolerate the `--` separator pnpm injects when forwarding script args (#3114)

The AGENTS.md-documented backend-debug flow `pnpm dev -- --fresh -p <port>` failed at
the repo root with an opaque `Unexpected arguments: -p, 44637` (exit 2 + a help dump).

pnpm appends forwarded args to a script **verbatim, including the `--`**, and each
nested `pnpm --filter` hop preserves it, so the showcase's `objectstack dev
--seed-admin` ran as `objectstack dev --seed-admin -- --fresh -p 44637`. oclif reads
`--` as POSIX end-of-flags, so everything after it became positional: `--fresh` was
silently swallowed as the `package` arg and `-p 44637` overflowed the arg list. Every
flag the user asked for was dropped — the failure was opaque precisely because the
`--` looks inert.

A `preparse` hook now drops `--` separators before oclif parses argv, so the
npm-style `-- <flags>` form and the bare form behave identically, for every command
and both bins (`run.js`, `run-dev.js`). No `os` command takes passthrough args (none
sets `strict = false`, none reads raw argv), so a `--` carries no meaning here and is
always a package-manager artifact.

Note this is not fixable via oclif's `'--': false` parser option: that keeps
flag-parsing on past the separator but re-appends the `--` into argv, so strict
commands fail with `Unexpected argument: --` instead.

Tradeoff: a `-`-prefixed token can no longer be forced to parse as a positional
value. Every `os` positional is a config path, a metadata / datasource / package
name, or an id — none start with `-`.
