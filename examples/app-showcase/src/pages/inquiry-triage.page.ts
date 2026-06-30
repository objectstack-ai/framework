// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { definePage } from '@objectstack/spec/ui';

/**
 * Inquiry Triage Inbox — a `kind:'react'` business scenario (ADR-0081).
 *
 * Models the classic support/lead-triage queue every CRM needs: status TABS
 * with live counts, a real `<ListView>` filtered by the active tab, and a detail
 * panel with one-click status actions ("Mark Contacted" / "Close") that persist
 * via `useAdapter().update` and refresh the list + counts. Demonstrates
 * React-state-driven server filtering, cross-row aggregation, and a status
 * workflow — none of which the fixed page schema can express.
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
  const STATUS_COLOR = { new: 'bg-blue-100 text-blue-700', contacted: 'bg-amber-100 text-amber-700', closed: 'bg-emerald-100 text-emerald-700' };

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Inquiry Triage</h1>
        <p className="mt-1 text-sm text-slate-500">A support queue over <code>showcase_inquiry</code> — tabs filter a real <code>&lt;ListView&gt;</code>; one click moves an inquiry's status.</p>
      </header>

      <div className="flex flex-wrap gap-2">
        {TABS.map(([k, label]) => (
          <button key={k} onClick={() => { setTab(k); setSel(null); }}
            className={'flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold ' + (tab === k ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}>
            {label}
            <span className={'rounded-full px-2 py-0.5 text-xs ' + (tab === k ? 'bg-white/20' : 'bg-white text-slate-500')}>{counts[k]}</span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-5 gap-6">
        <section className="col-span-3 rounded-xl border border-slate-200 bg-white p-2">
          <ListView key={tab + ':' + reload} objectName="showcase_inquiry"
            fields={['name', 'company', 'email', 'status']} filters={filters}
            navigation={{ mode: 'none' }} onRowClick={(r) => setSel(r)} />
        </section>
        <section className="col-span-2 rounded-xl border border-slate-200 bg-white p-5">
          {sel ? (
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-slate-900">{sel.name}</h2>
                  <span className={'rounded-full px-2.5 py-0.5 text-xs font-semibold ' + (STATUS_COLOR[sel.status] || 'bg-slate-100 text-slate-600')}>{sel.status}</span>
                </div>
                <p className="text-sm text-slate-500">{sel.company} · {sel.email}</p>
              </div>
              <p className="rounded-lg bg-slate-50 p-3 text-sm leading-relaxed text-slate-700">{sel.message || 'No message.'}</p>
              <div className="flex gap-2">
                <button onClick={() => setStatus('contacted')} disabled={sel.status === 'contacted'}
                  className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-40">Mark Contacted</button>
                <button onClick={() => setStatus('closed')} disabled={sel.status === 'closed'}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-40">Close</button>
              </div>
            </div>
          ) : (
            <div className="flex h-full min-h-[240px] flex-col items-center justify-center text-center text-slate-400">
              <div className="text-4xl">📥</div>
              <p className="mt-2 text-sm">Select an inquiry to triage.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}`,
});
