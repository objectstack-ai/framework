---
"@objectstack/spec": minor
"@objectstack/cli": minor
---

Add a build-time view-reference lint that fails `os compile` on a broken form-view reference, and surfaces the previously-silent `_2` rename collision as a warning (#2554).

`expandViewContainer` gains a behaviour-preserving companion `expandViewContainerWithDiagnostics` that also reports every `<object>.<key>` name collision. List and form views share one namespace during expansion, and the default `list` implicitly claims `<object>.default`; a colliding key was previously renamed to `<object>.<key>_2` **silently**, so references (form action `target`s, navigation `viewName`s) resolved to the *other* view.

The new `lint-view-refs` build lint consumes those diagnostics with a broken/fragile severity split, tuned so an upgrade does NOT break existing apps that merely have a colliding key:

- **view-ref-form-target-kind** — ERROR (fails the build): a `type:'form'` action whose `target` resolves to an existing LIST view — the concrete #2554 breakage (a blank form, a silently no-op submit). High-confidence, so it fails.
- **view-key-collision** — WARNING: a key silently renamed on collision. Fragile, not broken — it breaks something only if the requested name is referenced — so it warns.
- **view-ref-form-target-missing** — WARNING: a form target resolving to no view; probably a typo, but possibly a view the lint failed to collect, so it warns rather than risk a false-positive build failure.

This shifts objectui's runtime `viewKind` guard left to compile time: the author — very often an AI generating templates — discovers the mistake on `os compile` instead of when an end user clicks. It mirrors the existing broken/fragile two-level authoring lints (flow-patterns, autonumber, liveness). `expandViewContainer`'s runtime behaviour is unchanged; the fix is diagnostics-only plus the build gate.
