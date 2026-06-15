#!/usr/bin/env node
// Spec liveness gate.
//
// For a metadata-driven platform the spec IS the product surface: authors write
// metadata against these schemas. A property that is parsed but has no runtime
// consumer is a silent no-op (worst case: a *security* no-op — "false compliance").
// The metadata-liveness audits (docs/audits/2026-06-*-property-liveness.md) found
// large swaths of such DEAD props. This gate makes the classification explicit and
// keeps it from regressing: in a GOVERNED category, every authorable property must
// declare a liveness status with evidence, or CI fails.
//
// Statuses (per property, or per schema via "_schema"):
//   live        — has a runtime consumer (cite it in `evidence`: file:line / test)
//   experimental| planned — declared, intentionally not enforced yet (mark in spec
//                 `.describe()` as "[EXPERIMENTAL — not enforced]" or via the ledger)
//   dead        — parsed, no consumer; tracked for enforce-or-remove (cite the audit)
//   internal    — (schema-level only) not authorable metadata (runtime result/DTO,
//                 enum, helper); exempt from property classification
//
// Resolution order per property:  ledger entry  >  spec `.describe()` marker  >  UNCLASSIFIED
// A GOVERNED category with any UNCLASSIFIED property → non-zero exit (the ratchet:
// you cannot add a new spec property without classifying it).
//
// Usage:
//   node check-liveness.mjs                # check all governed categories
//   node check-liveness.mjs --dump security   # inventory a category's props (seeding aid)
//   node check-liveness.mjs --json         # machine-readable report

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const specRoot = resolve(here, '../..');            // packages/spec
const repoRoot = resolve(specRoot, '../..');        // repo root
const schemaRoot = join(specRoot, 'json-schema');
const ledgerRoot = join(specRoot, 'liveness');

// Categories whose authorable schemas must be fully classified. Extend
// highest-risk-first as each category's ledger is seeded from its audit.
const GOVERNED = ['security', 'identity'];

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const dumpIdx = args.indexOf('--dump');
const dumpCategory = dumpIdx !== -1 ? args[dumpIdx + 1] : null;

const MARKER_RE = {
  experimental: /\[experimental|not enforced|aspirational/i,
  planned: /\[planned|not yet implemented|coming soon/i,
};

function loadSchemas(category) {
  const dir = join(schemaRoot, category);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      const schema = JSON.parse(readFileSync(join(dir, f), 'utf8'));
      return { name: f.replace('.json', ''), schema };
    });
}

// top-level authorable properties of an object schema (one level; a nested object
// property represents its whole subtree, matching how the audits reason)
function topProps(schema) {
  if (!schema || schema.type !== 'object' || !schema.properties) return [];
  return Object.entries(schema.properties).map(([key, def]) => ({
    key,
    description: (def && def.description) || '',
  }));
}

function markerStatus(description) {
  if (MARKER_RE.planned.test(description)) return 'planned';
  if (MARKER_RE.experimental.test(description)) return 'experimental';
  return null;
}

function loadLedger(category) {
  const f = join(ledgerRoot, `${category}.json`);
  if (!existsSync(f)) return null;
  return JSON.parse(readFileSync(f, 'utf8'));
}

if (dumpCategory) {
  const rows = [];
  for (const { name, schema } of loadSchemas(dumpCategory)) {
    const kind = schema.type === 'object' && schema.properties ? 'object' : (schema.enum ? 'enum' : schema.type || 'other');
    if (kind !== 'object') { rows.push({ schema: name, kind, prop: '', marker: '' }); continue; }
    for (const p of topProps(schema)) rows.push({ schema: name, kind, prop: p.key, marker: markerStatus(p.description) || '' });
  }
  process.stdout.write(JSON.stringify(rows, null, 2) + '\n');
  process.exit(0);
}

const report = { categories: {}, totals: { classified: 0, unclassified: 0, byStatus: {} }, unclassified: [], staleEvidence: [] };

for (const category of GOVERNED) {
  const ledger = loadLedger(category) || { schemas: {} };
  const cat = { classified: 0, unclassified: 0, byStatus: {} };
  for (const { name, schema } of loadSchemas(category)) {
    const props = topProps(schema);
    if (props.length === 0) continue; // enums / scalars carry no authorable props
    const entry = ledger.schemas[name] || {};
    if (entry._schema === 'internal') continue; // exempt: not authorable
    for (const { key, description } of props) {
      const led = entry.props && entry.props[key];
      const status = (led && led.status) || entry._schema || markerStatus(description);
      if (!status) {
        cat.unclassified++;
        report.unclassified.push(`${category}/${name}.${key}`);
        continue;
      }
      cat.classified++;
      cat.byStatus[status] = (cat.byStatus[status] || 0) + 1;
      report.totals.byStatus[status] = (report.totals.byStatus[status] || 0) + 1;
      // soft evidence sanity for `live`
      if (status === 'live' && led && led.evidence) {
        const file = String(led.evidence).split(':')[0];
        if (/\//.test(file) && !existsSync(join(repoRoot, file))) report.staleEvidence.push(`${category}/${name}.${key} → ${led.evidence}`);
      }
    }
  }
  report.categories[category] = cat;
  report.totals.classified += cat.classified;
  report.totals.unclassified += cat.unclassified;
}

if (asJson) {
  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
} else {
  console.log('Spec liveness gate — governed categories:', GOVERNED.join(', '));
  for (const [c, v] of Object.entries(report.categories)) {
    const parts = Object.entries(v.byStatus).map(([s, n]) => `${s} ${n}`).join(', ');
    console.log(`  ${c}: ${v.classified} classified (${parts || '—'}), ${v.unclassified} unclassified`);
  }
  if (report.staleEvidence.length) {
    console.log(`\n⚠ ${report.staleEvidence.length} 'live' entr(ies) cite a missing file (evidence may be stale):`);
    report.staleEvidence.forEach((s) => console.log(`    ${s}`));
  }
  if (report.unclassified.length) {
    console.log(`\n✗ ${report.unclassified.length} UNCLASSIFIED propert(ies) in governed categories — classify in packages/spec/liveness/<category>.json:`);
    report.unclassified.forEach((s) => console.log(`    ${s}`));
  } else {
    console.log('\n✓ all governed-category properties are classified.');
  }
}

process.exit(report.unclassified.length > 0 ? 1 : 0);
