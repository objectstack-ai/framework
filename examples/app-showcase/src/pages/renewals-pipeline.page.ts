// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { definePage } from '@objectstack/spec/ui';

/**
 * Renewals Pipeline — a `kind:'react'` business scenario (ADR-0081).
 *
 * A renewals manager works a list of accounts by lifecycle stage; selecting one
 * drives a 360° panel (highlights + invoices + a value-by-status chart) and a
 * pre-styled `<ObjectForm formType="drawer">` to update the account in place.
 * Every block prop is taken straight from the react-tier contract
 * (skills/objectstack-ui/references/react-blocks.md).
 *
 * Styling (ADR-0065): no Tailwind — inline `style={{}}` with `hsl(var(--token))`;
 * data blocks and the drawer bring their own compiled styling.
 */
export const RenewalsPipelinePage = definePage({
  name: 'showcase_renewals_pipeline',
  label: 'Renewals Pipeline (React)',
  type: 'home',
  kind: 'react',
  source: `
function Page() {
  const [sel, setSel] = React.useState(null);
  const [editing, setEditing] = React.useState(false);
  const [reload, setReload] = React.useState(0);
  const [stage, setStage] = React.useState('active');

  const STAGES = [
    { id: 'active', label: 'Active' },
    { id: 'at_risk', label: 'At risk' },
    { id: 'churned', label: 'Churned' },
  ];
  const stageBtn = (active) => ({
    borderRadius: 'var(--radius)', padding: '6px 12px', fontSize: 14, cursor: 'pointer',
    border: '1px solid ' + (active ? 'hsl(var(--primary))' : 'hsl(var(--border))'),
    background: active ? 'hsl(var(--primary) / 0.1)' : 'transparent',
    color: 'hsl(var(--foreground))', fontWeight: active ? 600 : 400,
  });

  return (
    <div style={{ display: 'flex', height: '100%', gap: 16, padding: 16 }}>
      <div style={{ display: 'flex', width: '50%', flexDirection: 'column', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: 'hsl(var(--foreground))' }}>Renewals Pipeline</h1>
          <p style={{ marginTop: 2, fontSize: 14, color: 'hsl(var(--muted-foreground))' }}>Work the renewal book by lifecycle stage.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {STAGES.map((s) => (
            <button key={s.id} onClick={() => { setStage(s.id); setSel(null); }} style={stageBtn(stage === s.id)}>{s.label}</button>
          ))}
        </div>
        <ListView
          objectName="showcase_account"
          viewType="grid"
          filters={['status', '=', stage]}
          columns={['name', 'status']}
          searchableFields={['name']}
          navigation={{ mode: 'none' }}
          onRowClick={(record) => { setSel(record.id); setEditing(false); }}
        />
      </div>

      <div style={{ display: 'flex', width: '50%', flexDirection: 'column', gap: 16, overflow: 'auto' }}>
        {!sel ? (
          <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--radius)', border: '1px dashed hsl(var(--border))', fontSize: 14, color: 'hsl(var(--muted-foreground))' }}>
            Select an account to see its renewal picture.
          </div>
        ) : (
          <React.Fragment>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'hsl(var(--foreground))' }}>Account 360</h2>
              <button onClick={() => setEditing(true)} style={{ borderRadius: 'var(--radius)', border: '1px solid hsl(var(--border))', background: 'transparent', color: 'hsl(var(--foreground))', padding: '6px 12px', fontSize: 14, cursor: 'pointer' }}>Edit account</button>
            </div>

            <RecordHighlights objectName="showcase_account" recordId={sel} fields={['name', 'status']} layout="horizontal" />

            <ObjectChart objectName="showcase_invoice" aggregate={{ field: 'total', function: 'sum', groupBy: 'status' }} title="Invoice value by status" showLegend={true} />

            <RecordRelatedList objectName="showcase_account" recordId={sel} relationshipField="account" columns={['name', 'status', 'total']} limit={5} showViewAll={true} title="Invoices" />

            {editing ? (
              <ObjectForm objectName="showcase_account" mode="edit" recordId={sel}
                formType="drawer" drawerSide="right" drawerWidth="480px" open title="Edit account"
                onOpenChange={(o) => { if (!o) setEditing(false); }}
                onSuccess={() => { setEditing(false); setReload((n) => n + 1); }}
                onCancel={() => setEditing(false)} />
            ) : null}
          </React.Fragment>
        )}
      </div>
    </div>
  );
}`,
});
