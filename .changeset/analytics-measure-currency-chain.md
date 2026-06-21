---
"@objectstack/service-analytics": minor
---

Resolve a monetary measure's display currency via the field→tenant chain.

A dataset measure-currency now resolves through: explicit measure `currency` →
source-field `currencyConfig.defaultCurrency` → tenant default (`ctx.currency`).
A measure is monetary iff it declares a currency or aggregates a `currency`-type
field, so count/avg-of-number measures never receive a code. Wires a
`measureCurrency` field-metadata resolver from the data engine's object schema.
