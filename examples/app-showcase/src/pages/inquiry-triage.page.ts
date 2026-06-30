// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { definePage } from '@objectstack/spec/ui';

/**
 * Inquiry Triage Inbox — a `kind:'react'` business scenario (ADR-0081).
 *
 * A support/lead-triage queue: status TABS with live counts filter a real
 * `<ListView>`, and a detail panel with one-click status actions persists via
 * `useAdapter().update` and refreshes the list + counts.
 *
 * Styling (ADR-0065): no Tailwind — page chrome is inline `style={{}}` with
 * `hsl(var(--token))` theme colors; the data component brings its own styling.
 */
export const InquiryTriagePage = definePage({
  name: 'showcase_inquiry_triage',
  label: 'Inquiry Triage (React)',
  type: 'home',
  kind: 'react',
  source: `
function Page() {
  const adapter = useAdapter();
  const [tab, setTab] = React.useState('all');
  const [sel, setSel] = React.useState(null);
  const [reload, setReload] = React.useState(0);
  const [counts, setCounts] = React.useState({ all: 0, new: 0, contacted: 0, closed: 0 });

  const refresh = React.useCallback(async () => {
    if (!adapter) return;
    const res = await adapter.find('showcase_inquiry', { top: 500 });
    const rows = Array.isArray(res) ? res : (res && res.records) || [];
    setCounts({
      all: rows.length,
      new: rows.filter((r) => r.status === 'new').length,
      contacted: rows.filter((r) => r.status === 'contacted').length,
      closed: rows.filter((r) => r.status === 'closed').length,
    });
  }, [adapter]);
  React.useEffect(() => { refresh(); }, [refresh, reload]);

  const setStatus = async (status) => {
    if (!adapter || !sel) return;
    await adapter.update('showcase_inquiry', sel.id, { status });
    setSel(null);
    setReload((k) => k + 1);
  };

  const TABS = [['all', 'All'], ['new', 'New'], ['contacted', 'Contacted'], ['closed', 'Closed']];
  const filters = tab === 'all' ? undefined : ['status', '=', tab];
  const STATUS_COLOR = { new: 'hsl(217 91% 60%)', contacted: 'hsl(38 92% 50%)', closed: 'hsl(142 70% 45%)' };

  const card = { background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius)' };
  const tabBtn = (active) => ({
    display: 'flex', alignItems: 'center', gap: 8, borderRadius: 9999, padding: '6px 16px', fontSize: 14, fontWeight: 600,
    border: '1px solid ' + (active ? 'transparent' : 'hsl(var(--border))'), cursor: 'pointer',
    background: active ? 'hsl(var(--primary))' : 'transparent',
    color: active ? 'hsl(var(--primary-foreground))' : 'hsl(var(--muted-foreground))',
  });

  return (
    <div style={{ maxWidth: 1152, margin: '0 auto', padding: 32, display: 'flex', flexDirection: 'column', gap: 20 }}>
      <header>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, letterSpacing: '-0.01em', color: 'hsl(var(--foreground))' }}>Inquiry Triage</h1>
        <p style={{ marginTop: 4, fontSize: 14, color: 'hsl(var(--muted-foreground))' }}>A support queue over <code>showcase_inquiry</code> — tabs filter a real <code>&lt;ListView&gt;</code>; one click moves an inquiry's status.</p>
      </header>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {TABS.map(([k, label]) => (
          <button key={k} onClick={() => { setTab(k); setSel(null); }} style={tabBtn(tab === k)}>
            {label}
            <span style={{ borderRadius: 9999, padding: '1px 8px', fontSize: 12, background: tab === k ? 'rgba(255,255,255,0.2)' : 'hsl(var(--muted))', color: tab === k ? 'inherit' : 'hsl(var(--muted-foreground))' }}>{counts[k]}</span>
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 24, alignItems: 'start' }}>
        <section style={{ ...card, padding: 8 }}>
          <ListView key={tab + ':' + reload} objectName="showcase_inquiry"
            fields={['name', 'company', 'email', 'status']} filters={filters}
            navigation={{ mode: 'none' }} onRowClick={(r) => setSel(r)} />
        </section>
        <section style={{ ...card, padding: 20 }}>
          {sel ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: 'hsl(var(--foreground))' }}>{sel.name}</h2>
                  <span style={{ borderRadius: 9999, padding: '2px 10px', fontSize: 12, fontWeight: 600, color: '#fff', background: STATUS_COLOR[sel.status] || 'hsl(var(--muted))' }}>{sel.status}</span>
                </div>
                <p style={{ marginTop: 4, fontSize: 14, color: 'hsl(var(--muted-foreground))' }}>{sel.company} · {sel.email}</p>
              </div>
              <p style={{ borderRadius: 'var(--radius)', background: 'hsl(var(--muted))', padding: 12, fontSize: 14, lineHeight: 1.6, color: 'hsl(var(--foreground))' }}>{sel.message || 'No message.'}</p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setStatus('contacted')} disabled={sel.status === 'contacted'}
                  style={{ borderRadius: 'var(--radius)', background: 'hsl(38 92% 50%)', color: '#fff', padding: '8px 16px', fontSize: 14, fontWeight: 600, border: 'none', cursor: 'pointer', opacity: sel.status === 'contacted' ? 0.4 : 1 }}>Mark Contacted</button>
                <button onClick={() => setStatus('closed')} disabled={sel.status === 'closed'}
                  style={{ borderRadius: 'var(--radius)', background: 'hsl(142 70% 40%)', color: '#fff', padding: '8px 16px', fontSize: 14, fontWeight: 600, border: 'none', cursor: 'pointer', opacity: sel.status === 'closed' ? 0.4 : 1 }}>Close</button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', minHeight: 240, flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', color: 'hsl(var(--muted-foreground))' }}>
              <div style={{ fontSize: 32 }}>📥</div>
              <p style={{ marginTop: 8, fontSize: 14 }}>Select an inquiry to triage.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}`,
});
