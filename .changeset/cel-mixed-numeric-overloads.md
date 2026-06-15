---
"@objectstack/formula": patch
---

fix(formula): register mixed `double <op> int` arithmetic overloads so number-field formulas compute

cel-js types a record field number as `double` and a bare integer literal as
`int`, and ships overloads only for matching numeric pairs. So an everyday
formula like `record.amount / 100` or `record.price * 2` faulted at runtime
(`no such overload: dyn<double> / int`); the engine caught the fault and the
formula silently evaluated to `null` — passing build, empty at runtime (#1928).

The CEL engine now registers the missing `double <op> int` / `int <op> double`
overloads for `+ - * / %`, computing the result as a `double` (CEL's mixed-numeric
promotion). Pure `int op int` is untouched, so integer division (`7 / 2 == 3`)
keeps its semantics — the overloads fire only when the operands are genuinely a
`double` and an `int`. Authors no longer need the `/ 100.0` float-literal workaround.
