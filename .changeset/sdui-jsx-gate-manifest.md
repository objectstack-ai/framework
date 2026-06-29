---
"@objectstack/lint": minor
"@objectstack/cli": minor
---

ADR-0080 M3b① (consumption seam): the `os build` / `os validate` JSX gate now does **full component/prop validation** (unknown component, missing/wrong prop, bad enum, bindings) when a `sdui.manifest.json` is present at the project root — falling back to parse-level otherwise. `validateJsxPages` accepts an optional manifest; the validate command loads the file when present. Generating + shipping that manifest from the registry's public tier remains a build/CI step.
