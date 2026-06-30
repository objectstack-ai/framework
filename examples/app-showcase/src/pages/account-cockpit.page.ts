// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { definePage } from '@objectstack/spec/ui';

/**
 * Account Cockpit — a `kind:'react'` business scenario (ADR-0081).
 *
 * Customer-360 over `showcase_account`: a live search filters a real
 * `<ListView>`, selecting an account loads it into an `<ObjectForm>` editor and
 * rolls up related projects & invoices via `useAdapter()` cross-object queries.
 *
 * Styling (ADR-0065): no Tailwind — inline `style={{}}` with `hsl(var(--token))`.
 */
export const AccountCockpitPage = definePage({
  name: 'showcase_account_cockpit',
  label: 'Account Cockpit (React)',
  type: 'home',
  kind: 'react',
  source: `
function Page() {
  const adapter = useAdapter();
  const [q, setQ] = React.useState('');
  const [sel, setSel] = React.useState(null);
  const [reload, setReload] = React.useState(0);
  const [related, setRelated] = React.useState({ projects: 0, invoices: 0, openInvoices: 0 });

  React.useEffect(() => {
    let alive = true;
    (async () => {
      if (!adapter || !sel) { setRelated({ projects: 0, invoices: 0, openInvoices: 0 }); return; }
      const pr = await adapter.find('showcase_project', { $filter: ['account', '=', sel.id], top: 500 });
      const iv = await adapter.find('showcase_invoice', { $filter: ['account', '=', sel.id], top: 500 });
      const projects = Array.isArray(pr) ? pr : (pr && pr.records) || [];
      const invoices = Array.isArray(iv) ? iv : (iv && iv.records) || [];
      if (alive) setRelated({ projects: projects.length, invoices: invoices.length, openInvoices: invoices.filter((r) => r.status !== 'paid' && r.status !== 'void').length });
    })();
    return () => { alive = false; };
  }, [adapter, sel, reload]);

  const filters = q.trim() ? ['name', 'contains', q.trim()] : undefined;
  const card = { background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius)' };
  const Stat = ({ label, value, accent }) => (
    <div style={{ background: 'hsl(var(--muted))', border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius)', padding: 12 }}>
      <div style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'hsl(var(--muted-foreground))' }}>{label}</div>
      <div style={{ marginTop: 4, fontSize: 24, fontWeight: 700, color: accent || 'hsl(var(--foreground))' }}>{value}</div>
    </div>
  );

  return (
    <div style={{ maxWidth: 1152, margin: '0 auto', padding: 32, display: 'flex', flexDirection: 'column', gap: 20 }}>
      <header style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, letterSpacing: '-0.01em', color: 'hsl(var(--foreground))' }}>Account Cockpit</h1>
          <p style={{ marginTop: 4, fontSize: 14, color: 'hsl(var(--muted-foreground))' }}>Customer-360 over <code>showcase_account</code> — search, edit, and roll up related projects &amp; invoices.</p>
        </div>
        <input value={q} onChange={(e) => { setQ(e.target.value); setSel(null); }} placeholder="Search accounts…"
          style={{ width: 256, borderRadius: 'var(--radius)', border: '1px solid hsl(var(--border))', background: 'hsl(var(--background))', color: 'hsl(var(--foreground))', padding: '8px 12px', fontSize: 14, outline: 'none' }} />
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 24, alignItems: 'start' }}>
        <section style={{ ...card, padding: 8 }}>
          <ListView key={q + ':' + reload} objectName="showcase_account"
            fields={['name', 'industry', 'status', 'annual_revenue']} filters={filters}
            navigation={{ mode: 'none' }} onRowClick={(r) => setSel(r)} />
        </section>
        <section style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {sel ? (
            <React.Fragment>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                <Stat label="Projects" value={related.projects} />
                <Stat label="Invoices" value={related.invoices} />
                <Stat label="Open AR" value={related.openInvoices} accent="hsl(38 92% 50%)" />
              </div>
              <div style={{ ...card, padding: 20 }}>
                <ObjectForm key={sel.id + ':' + reload} objectName="showcase_account" mode="edit"
                  recordId={sel.id} onSuccess={() => { setSel(null); setReload((k) => k + 1); }}
                  onCancel={() => setSel(null)} />
              </div>
            </React.Fragment>
          ) : (
            <div style={{ ...card, display: 'flex', minHeight: 240, flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', color: 'hsl(var(--muted-foreground))' }}>
              <div style={{ fontSize: 32 }}>🛰️</div>
              <p style={{ marginTop: 8, fontSize: 14 }}>Search and select an account.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}`,
});
