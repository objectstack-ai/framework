# ADR-0025: `@objectstack/metadata-authoring` — A Transport-Agnostic Metadata Commit Engine

**Status**: Proposed (2026-06-01)
**Deciders**: ObjectStack Protocol Architects
**Builds on**: [ADR-0005](./0005-metadata-customization-overlay.md) (one Zod source per type, org overlay), [ADR-0008](./0008-metadata-repository-and-change-log.md) (Repository · ChangeLog · Cache · Registry; the four write surfaces), [ADR-0010](./0010-metadata-protection-model.md) (L1/L2/L3 protection), [ADR-0016](./0016-studio-package-authoring-and-publish.md) (Studio authoring → bind → distribute loop)
**Consumers**: `@objectstack/rest` (HTTP `PUT/DELETE/POST /meta/*` routes), `@objectstack/objectql` (provides the storage + schema-sync adapters), `@objectstack/runtime` (wires the service at kernel bootstrap), `@objectstack/cli` (`os` authoring commands), `../objectui` (Studio — the visual editor)

---

## TL;DR

ObjectStack already supports authoring metadata visually in Studio and
persisting it to a database (`sys_metadata`), plus materializing object/field
definitions into physical tables via driver DDL. But the **"commit"** — the
act of turning *one visual edit* into *a durable, schema-synced, change-logged,
hot-reloaded state change* — has **no owning package**. It is smeared across
`rest` (HTTP), `objectql` (`saveMetaItem` + `SysMetadataRepository` + `syncSchemas`),
the `driver-*` plugins (`ISchemaDriver` DDL), `metadata-core` (ChangeLog,
canonicalize), and `metadata` (registry invalidation / HMR).

**Decision:** extract that orchestration into a new, server-side,
**transport-agnostic** package — `@objectstack/metadata-authoring` — exposing a
single entry point `MetadataAuthoringService.commit(change)` that runs the full
pipeline as **one atomic commit unit**:

```
validate → protect → OCC → [ L1 persist (sys_metadata)  +  L2 schema-sync (DDL) ] → changelog → notify
```

The package **invents no storage and no protocol**. It depends only on
`@objectstack/spec` and `@objectstack/metadata-core` (pure contract layers) and
reaches storage/DDL through injected **ports**, whose adapters live in
`objectql`. This breaks the dependency cycle, makes the commit path unit-testable
in isolation, and lets *any* surface (REST, CLI, AI agent, Git webhook) reuse the
exact same code path — the explicit goal of ADR-0008's "four write surfaces".

---

## Context

### Two ways to build apps, one shared commit path

There are two ways to develop on ObjectStack metadata:

1. **AI writes code** — metadata authored as local files (`.object.ts`,
   `.view.ts`), shipped as a package (e.g. a CRM). Read-only at runtime.
2. **AI / a human writes the database, editing in the UI** — Studio mutates
   metadata live; the change must land in the database **and** reshape the
   physical tables, with the running app picking it up immediately.

Path 2 is the no-code/low-code loop. Its critical operation is the **commit**:
take a visual edit and make it real. Today that operation is implicit and
scattered (see ADR-0008 §1.1's "storage, cache and registry conflated in one
box"). This ADR gives it a home.

### "Persist to the database" is actually two layers

| Layer | Meaning | Today's location | Physical action |
|:------|:--------|:-----------------|:----------------|
| **L1 — definition persistence** | Store the *JSON definition* of object/view/field/app | `objectql/sys-metadata-repository.ts`, `metadata/loaders/database-loader.ts` | `INSERT/UPDATE sys_metadata` (+ `sys_metadata_history`) |
| **L2 — physical schema (DDL)** | When the definition adds/changes a field, create/alter the *real business table* | `objectql/engine.ts → driver.syncSchema()` → `ISchemaDriver` (`createCollection/addColumn/modifyColumn/dropColumn`) | `CREATE TABLE / ALTER TABLE` |

Path 2 needs **both**: adding `phone` to `contact` in the UI must write the
definition (L1) *and* add a real `contact.phone` column (L2). The new package's
core value is sequencing L1+L2 into a single, recoverable commit — the spot
where atomicity and ordering bugs live today because no single component owns it.

### The current, scattered flow

```
Studio (../objectui  →  @objectstack/console prebuilt SPA)
   │  client.meta.saveItem(type,name,item)                    @objectstack/client
   ▼
PUT /meta/:type/:name   (If-Match, X-Actor, ?force, ?package, ?mode=draft)
   │                                                          @objectstack/rest  (rest-server.ts:1782)
   ▼
saveMetaItem({type,name,item,parentVersion,actor,force,packageId,mode})
   │                                                          @objectstack/objectql (protocol.ts)
   ├── validate  (Zod from @objectstack/spec)
   ├── protect   (ADR-0010 L1/L2/L3, allowOrgOverride whitelist)
   ├── L1: SysMetadataRepository.put() → sys_metadata + sys_metadata_history (OCC/checksum)
   ├── L2: engine.syncSchemas() → driver.syncSchema() → ISchemaDriver DDL
   ├── changelog append (ADR-0008)
   └── registry invalidate / hot-reload (HMR)
```

No single package owns "commit". Swapping the front transport (RPC, CLI, an AI
agent calling in-process) means re-stitching the steps; guaranteeing L1+L2
atomicity has no responsible owner.

---

## Decision

Introduce `packages/metadata-authoring` — `@objectstack/metadata-authoring`.

### 1. Scope

**In:**
- A single entry point `MetadataAuthoringService.commit(change, opts?)` that runs
  `validate → protect → OCC → L1 persist + L2 schema-sync → changelog → notify`
  inside one transaction boundary.
- **Dry-run / preview**: `commit(change, { dryRun: true })` returns the DDL that
  *would* run and the items that *would* change, without writing — so Studio can
  show "will add column `contact.phone TEXT`" before the user clicks Save.
- Destructive-change detection (drop column / change type) gated by `force`.
- Orchestration of `package_id` binding, `draft`/`publish`, and `rollback`
  (orchestration only — storage semantics stay in the repository).
- Multi-tenant (`organization_id`) scope adjudication.

**Out (depended upon, not re-implemented):**
- ❌ HTTP routing — stays in `rest`, which is rewritten to call this service.
- ❌ Visual UI — stays in `../objectui` / `console`.
- ❌ Storage implementation — reuses `objectql`'s `SysMetadataRepository` and the
  `driver-*` plugins' `ISchemaDriver`.
- ❌ Zod schema definitions — stay in `spec`.

> The package does not invent storage or protocol. It invents **the commit** as
> a reusable, transport-agnostic, transactional unit.

### 2. Public API

```ts
interface MetadataChange {
  op: 'put' | 'delete';
  type: string;                 // 'object' | 'view' | 'field' | ...
  name: string;
  item?: unknown;               // metadata JSON to write
  orgId: string;
  actor?: string;
  packageId?: string;           // bind to package; omitted = env-local overlay (ADR-0016 §9)
  mode?: 'draft' | 'publish';
  parentVersion?: string;       // OCC: expected checksum (maps from If-Match)
  force?: boolean;              // bypass destructive-change protection
}

interface SchemaChange {
  kind: 'create_table' | 'add_column' | 'modify_column' | 'drop_column' | 'create_index' | 'drop_index';
  table: string;
  detail: string;               // human-readable, e.g. "add column phone TEXT"
  destructive: boolean;
}

interface CommitResult {
  ref: { type: string; name: string; org: string };
  version: string;              // new checksum
  schemaChanges: SchemaChange[];
  changeLogSeq: number;
  warnings: string[];
}

class MetadataAuthoringService {
  commit(change: MetadataChange, opts?: { dryRun?: boolean }): Promise<CommitResult>;
  rollback(ref: MetaRef, toVersion: string, actor?: string): Promise<CommitResult>;
  publishDraft(ref: MetaRef, actor?: string): Promise<CommitResult>;
}
```

### 3. Ports (dependency inversion — how the cycle is broken)

The service depends on **interfaces**, not on `objectql`. Adapters implementing
these ports live in `objectql` and are injected at kernel bootstrap by `runtime`.

```ts
interface MetadataRepositoryPort { get; put; delete; history; }   // ← objectql SysMetadataRepository adapter
interface SchemaSyncPort {
  plan(obj: DataObject, prev?: DataObject): SchemaChange[];        // diff → intended DDL (powers dry-run)
  apply(changes: SchemaChange[], tx: unknown): Promise<void>;      // ← driver ISchemaDriver adapter
}
interface ChangeLogPort   { append(event: MetadataEvent): Promise<number>; }
interface RegistryPort    { invalidate(ref: MetaRef): void; broadcast(event: MetadataEvent): void; }
interface TransactionPort { run<T>(fn: (tx: unknown) => Promise<T>): Promise<T>; } // ← engine.transaction()
```

### 4. Dependency graph (must stay acyclic)

```
spec  (contracts / Zod)
  ▲ ▲ ▲
  │ │ └──── metadata-authoring ──┐  depends: spec, metadata-core, PORTS only
  │ │                             │  (NOT objectql directly)
  │ └── objectql ──(impl ports)───┘  provides RepositoryAdapter / SchemaSyncAdapter / TxAdapter
  └── metadata-core (Repository iface / ChangeLog / canonicalize / errors)
        ▲
rest → metadata-authoring          rest only translates HTTP ⇄ commit()
runtime → metadata-authoring       runtime wires adapters into the service at bootstrap
```

### 5. Atomicity strategy (the hard part)

L1 (`sys_metadata` write) is transactional. **L2 (DDL) frequently is not** —
MySQL implicit-commits DDL, Postgres is partially transactional, Mongo/Memory
have no DDL. So we do **not** pretend a single rollback works. Instead:

1. **Plan** all schema changes (`SchemaSyncPort.plan`) — this also powers dry-run.
2. **Apply DDL first** (`SchemaSyncPort.apply`). If it fails, nothing was written
   to `sys_metadata`; abort cleanly.
3. **Then write L1 + changelog** inside `TransactionPort.run()`. If *this* fails
   after DDL succeeded, the schema is "ahead" of the definition: emit a
   `schema-ahead` repair event/warning rather than faking a DDL rollback. The
   next boot's `syncSchemas` reconciles (idempotent DDL).

`schemaMode: 'external'` (an existing objectql switch) **skips L2 entirely** —
the user manages DDL out of band; the service does L1 only.

### 6. Validation & protection are pre-write (zero partial state)

Zod validation (`spec`), the `allowOrgOverride` whitelist, and ADR-0010 L1/L2/L3
protection all run *before* any write. A failure writes nothing — aligning with
ADR-0016 §9.3's register-before-persist guarantee. OCC: `parentVersion` is
compared to the stored `checksum`; a mismatch raises `ConflictError`
(`metadata-core`).

---

## Consequences

### Positive

- **One commit path for all four write surfaces** (Studio, REST, AI, Git) — the
  ADR-0008 goal, finally with a single owner.
- L1+L2 ordering and the schema-ahead recovery rule are written down and tested
  in one place instead of being emergent behavior.
- Dry-run preview becomes a first-class capability (Studio "what will change?").
- `rest` shrinks to HTTP translation; `objectql`'s `saveMetaItem` becomes a thin
  shell over `commit()`.

### Negative / risks

- One more package and one more bootstrap wiring step (ports injection in
  `runtime`).
- The schema-ahead recovery path is genuinely hard to get right across drivers;
  it needs per-driver integration tests (sql, sqlite-wasm, mongodb, memory).
- Short-term churn in `objectql/protocol.ts` and `rest-server.ts` while the shell
  delegation lands.

### Migration plan (incremental, each phase ships green)

- **Phase 0** — Create the empty package; define `ports.ts` + `MetadataChange` /
  `CommitResult` types. Zero behavior change.
- **Phase 1** — Move the orchestration out of `objectql/protocol.ts`'s
  `saveMetaItem` into `service.ts`; add `RepositoryAdapter` / `SchemaSyncAdapter`
  / `TxAdapter` in `objectql`; `saveMetaItem` becomes a thin shell over
  `commit()`. Existing objectql tests stay green.
- **Phase 2** — `rest-server.ts:1782` (`PUT/DELETE/publish/rollback`) call
  `MetadataAuthoringService` directly; REST keeps only HTTP ⇄ domain translation.
- **Phase 3** — Land dry-run, destructive-DDL preview, and the schema-ahead
  recovery strategy as the net-new value of the extraction.
- **Phase 4** — Update `ARCHITECTURE.md` dependency diagram; mark this ADR
  `Accepted`.

---

## Alternatives considered

- **L1-only package** (persist definitions, leave DDL to objectql's boot-time
  `syncSchemas`). Rejected: the no-code loop needs "add field in UI → column
  exists now", so the commit must own L2 sequencing too.
- **Leave it in `objectql`.** Rejected: `objectql` is the data engine; bundling
  the authoring/commit concern there keeps the four-surface reuse impossible and
  the transport coupling (via `rest`) implicit.
- **Fold into `rest`.** Rejected: that locks the commit path to HTTP and blocks
  in-process AI/CLI authoring.
