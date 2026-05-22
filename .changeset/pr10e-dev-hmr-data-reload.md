---
"@objectstack/objectql": patch
"@objectstack/runtime": patch
"@objectstack/metadata": patch
"@objectstack/metadata-fs": patch
---

Fix dev-mode HMR data-reload for `*.view.ts` / `*.flow.ts` source-file edits.

Three coordinated fixes close the long-standing gap where editing a
declarative-metadata source file in dev (e.g. `case.view.ts`) would
recompile `dist/objectstack.json` but the running server kept serving
the stale boot-time value:

1. **`@objectstack/objectql`** — `ObjectStackProtocolImplementation.getMetaItem`
   now consults `MetadataService` (HMR-aware) **before** the in-memory
   `SchemaRegistry` (boot-time cache). Previously the registry shadowed
   freshly-registered values: `manager.register('view','case',newDef)`
   updated MetadataManager but `getMetaItem` returned the stale registry
   copy because step 2 (registry) ran before step 3 (service). Reordered
   to "1. sys_metadata overlay → 2. MetadataService → 3. SchemaRegistry".

2. **`@objectstack/runtime`** — `createStandaloneStack` now enables the
   `MetadataPlugin` artifact-file watcher in non-production environments
   (`NODE_ENV !== 'production'`). Previously hard-coded to `watch: false`,
   leaving nothing watching `dist/objectstack.json` when the CLI dev mode
   recompiled it.

3. **`@objectstack/metadata`** & **`@objectstack/metadata-fs`** — Both
   chokidar watchers now use `usePolling: true` to avoid `fs.watch`
   EMFILE on macOS / busy dev hosts where the native file-descriptor
   pool can be exhausted by other long-running node processes.

With these three changes:
- CLI edits source → recompile artifact (~400ms)
- Server's polling chokidar detects artifact change → `_loadFromLocalFile`
- `_loadFromLocalFile` calls `manager.register(type, name, item)`
- MetadataService now has the fresh value
- Read path returns the fresh value via the new step-2 lookup
- Studio SSE listeners re-render
