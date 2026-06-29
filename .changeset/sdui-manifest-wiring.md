---
"@objectstack/cli": minor
---

ADR-0080: wire the SDUI manifest end-to-end. `build-console.sh` now (best-effort, guarded) generates `sdui.manifest.json` from the just-built console's public-tier registry into `@objectstack/console/dist/`; the `os build` / `os validate` JSX gate resolves the manifest from `@objectstack/console` (in addition to the project root) and does full component/prop validation when present. Activating full validation requires bumping `.objectui-sha` to an objectui commit that ships the dump tooling (>=96b1293); until then the gate falls back to parse-level and the build step skips.
