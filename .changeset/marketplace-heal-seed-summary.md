---
"@objectstack/cloud-connection": patch
---

fix(seed-summary): count the marketplace rehydrate heal in the boot banner, and make the counter actually accumulate

The boot-banner `Seeds:` line (#3435) was fed by a `seed-summary` kernel
counter that only AppPlugin's config-app seed wrote to. The marketplace
rehydrate heal (#3421) — which seeds an installed package's sample data onto a
fresh/empty database in the same boot-quiet window — wrote nothing, so a
marketplace package's healed rows, and critically its EMPTY "installed but 0
rows" state, were absent from the banner (the exact class of bug the line
exists to catch). On the showcase the banner read `130 inserted · 6 updated`
while HotCRM silently healed 162 more rows next to it.

Two latent bugs in the counter blocked simply folding the heal in:

1. It read the prior total through `(ctx as any).kernel?.getService(...)`, but
   the plugin `PluginContext` has no `.kernel` handle (kernel.ts builds it with
   `getService` / `registerService` only) — so the read was always `undefined`
   and each write was a blind overwrite, never an accumulation.
2. `registerService(name, …)` THROWS on a duplicate name, so the second writer's
   registration threw (caught → silently dropped). Whichever seed source ran
   last simply won; combined with (1) the "accumulates across apps" intent
   never worked.

Fix: a shared `accumulateSeedSummary(ctx, delta)` in `@objectstack/types`
registers ONE mutable counter object and mutates it in place — race- and
cache-safe regardless of which seed source (config app or marketplace heal)
runs first. Both AppPlugin and the marketplace heal now use it. The marketplace
heal reports healed rows as inserted/updated, and forces a non-zero `rejected`
when it lands zero rows so the "installed but 0 rows" state escalates to the
banner's yellow warning.

Verified on the showcase: fresh boot now reads `292 inserted · 6 updated`
(130 config + 162 HotCRM heal) instead of `130 · 6`.
