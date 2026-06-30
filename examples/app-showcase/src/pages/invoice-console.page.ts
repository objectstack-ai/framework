// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { definePage } from '@objectstack/spec/ui';

/**
 * Invoice Console — a `kind:'react'` business scenario (ADR-0081).
 *
 * Accounts-receivable workbench over `showcase_invoice`: aggregate KPIs, a
 * status segmented control filtering a real `<ListView>`, an `<ObjectForm>`
 * editor, and a one-click "Mark Paid" collect action.
 *
 * Styling (ADR-0065): no Tailwind — inline `style={{}}` with `hsl(var(--token))`.
 */
export const InvoiceConsolePage = definePage({
  name: 'showcase_invoice_console',
  label: 'Invoice Console (React)',
  type: 'home',
  kind: 'react',
  source: `
function Page() {
  const adapter = useAdapter();
  const [status, setStatus] = React.useState('all');
  const [sel, setSel] = React.useState(null);
  const [mode, setMode] = React.useState('edit');
  const [reload, setReload] = React.useState(0);
  const [kpi, setKpi] = React.useState({ count: 0, draft: 0, sent: 0, paid: 0 });

  React.useEffect(() => {
    let alive = true;
    (async () => {
      if (!adapter) return;
      const res = await adapter.find('showcase_invoice', { top: 500 });
      const rows = Array.isArray(res) ? res : (res && res.records) || [];
      if (alive) setKpi({
        count: rows.length,
        draft: rows.filter((r) => r.status === 'draft').length,
        sent: rows.filter((r) => r.status === 'sent').length,
        paid: rows.filter((r) => r.status === 'paid').length,
      });
    })();
    return () => { alive = false; };
  }, [adapter, reload]);

  const afterWrite = () => { setSel(null); setMode('edit'); setReload((k) => k + 1); };
  const markPaid = async () => { if (!adapter || !sel) return; await adapter.update('showcase_invoice', sel.id, { status: 'paid' }); afterWrite(); };
  const openNew = () => { setSel(null); setMode('create'); };

  const FILTERS = [['all', 'All'], ['draft', 'Draft'], ['sent', 'Sent'], ['paid', 'Paid'], ['void', 'Void']];
  const filters = status === 'all' ? undefined : ['status', '=', status];
  const editing = mode === 'create' || sel;

  const card = { background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius)' };
  const eyebrow = { fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'hsl(var(--muted-foreground))' };
  const Kpi = ({ label, value, accent }) => (
    <div style={{ ...card, padding: 16 }}>
      <div style={eyebrow}>{label}</div>
      <div style={{ marginTop: 4, fontSize: 30, fontWeight: 700, color: accent || 'hsl(var(--foreground))' }}>{value}</div>
    </div>
  );
  const pill = (active) => ({
    borderRadius: 9999, padding: '4px 14px', fontSize: 14, fontWeight: 600, cursor: 'pointer',
    border: '1px solid ' + (active ? 'transparent' : 'hsl(var(--border))'),
    background: active ? 'hsl(var(--primary))' : 'transparent',
    color: active ? 'hsl(var(--primary-foreground))' : 'hsl(var(--muted-foreground))',
  });

  return (
    <div style={{ maxWidth: 1152, margin: '0 auto', padding: 32, display: 'flex', flexDirection: 'column', gap: 20 }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, letterSpacing: '-0.01em', color: 'hsl(var(--foreground))' }}>Invoice Console</h1>
          <p style={{ marginTop: 4, fontSize: 14, color: 'hsl(var(--muted-foreground))' }}>Accounts receivable over <code>showcase_invoice</code> — aggregate, filter, edit, and collect.</p>
        </div>
        <button onClick={openNew} style={{ flexShrink: 0, borderRadius: 'var(--radius)', background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))', padding: '8px 16px', fontSize: 14, fontWeight: 600, border: 'none', cursor: 'pointer' }}>+ New invoice</button>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        <Kpi label="Total" value={kpi.count} />
        <Kpi label="Draft" value={kpi.draft} accent="hsl(var(--muted-foreground))" />
        <Kpi label="Sent" value={kpi.sent} accent="hsl(217 91% 60%)" />
        <Kpi label="Paid" value={kpi.paid} accent="hsl(142 70% 45%)" />
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {FILTERS.map(([k, label]) => (
          <button key={k} onClick={() => setStatus(k)} style={pill(status === k)}>{label}</button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 24, alignItems: 'start' }}>
        <section style={{ ...card, padding: 8 }}>
          <ListView key={status + ':' + reload} objectName="showcase_invoice"
            fields={['name', 'account', 'status', 'total']} filters={filters}
            navigation={{ mode: 'none' }} onRowClick={(r) => { setSel(r); setMode('edit'); }} />
        </section>
        <section style={{ ...card, padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {editing ? (
            <React.Fragment>
              <ObjectForm key={(mode === 'create' ? 'new' : sel && sel.id) + ':' + reload}
                objectName="showcase_invoice" mode={mode}
                recordId={mode === 'edit' && sel ? sel.id : undefined}
                onSuccess={afterWrite} onCancel={() => setSel(null)} />
              {mode === 'edit' && sel && sel.status !== 'paid' ? (
                <button onClick={markPaid} style={{ width: '100%', borderRadius: 'var(--radius)', border: '1px solid hsl(142 70% 40%)', background: 'transparent', color: 'hsl(142 70% 45%)', padding: '8px 16px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>✓ Mark Paid</button>
              ) : null}
            </React.Fragment>
          ) : (
            <div style={{ display: 'flex', minHeight: 240, flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', color: 'hsl(var(--muted-foreground))' }}>
              <div style={{ fontSize: 32 }}>🧾</div>
              <p style={{ marginTop: 8, fontSize: 14 }}>Select an invoice, or create one.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}`,
});
