---
"@objectstack/cli": patch
---

fix(ADR-0048): rescope the `os lint` `naming/namespace-prefix` rule to intra-package duplicates

ADR-0048 §3.4 retired the per-item cross-package collision throw — two
installed packages may legitimately ship the same bare name (e.g. `page/home`),
stored under distinct composite keys and disambiguated by package-scoped
resolution. The `naming/namespace-prefix` lint rule was never updated to match,
so it still:

- **fired on every bare-named UI/automation item** (apps/pages/dashboards/flows/
  actions/reports/datasets) regardless of whether a duplicate existed — a normal
  single-package app got dozens of false positives (hotcrm: 63), and
- **claimed the package would "collide on the registry key and fail at install"**,
  which is no longer true.

The rule now warns **only on a genuine intra-package duplicate `(type, name)`
pair** within the linted config — the narrow authoring-time hygiene case ADR-0048
§3.4 explicitly leaves to `os lint` ("an author shipping two `page/home` in one
package"). A unique bare name produces zero warnings. The message no longer
claims an install failure; it explains the items shadow each other on the
registry key and that distinct packages may reuse the same name freely (the
namespace prefix is an optional convention). Runtime/registry behavior is
unchanged.
