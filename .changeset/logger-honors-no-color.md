---
"@objectstack/core": patch
---

fix(core): ObjectLogger honors NO_COLOR and TTY detection before emitting ANSI colors

The kernel/plugin logger (`ctx.logger`, wired by `os serve` / `os dev`) colorized its
`pretty`-format level tags unconditionally, so `NO_COLOR=1` runs and piped/CI output
still carried ANSI escapes (e.g. `\x1b[31m…ERROR\x1b[0m`), breaking plain-text log
scanners (see scripts/publish-smoke.sh, which had to strip ANSI before grepping).

Per the no-color.org convention, color is now emitted only when the destination stream
(stdout, or stderr for error/fatal) is an interactive TTY **and** `NO_COLOR` is unset or
empty — any non-empty `NO_COLOR` value disables color. Interactive terminals keep the
existing colorized output. The optional file destination now always receives plain text.
