// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { definePage } from '@objectstack/spec/ui';

/**
 * Invoice Console — a `kind:'react'` business scenario (ADR-0081).
 *
 * Accounts-receivable management: a KPI strip aggregating invoices by status
 * (useAdapter), a status segmented-filter driving a real `<ListView>`, a real
 * `<ObjectForm>` for create + edit, and a "Mark Paid" quick action on the
 * selected invoice. Demonstrates aggregation KPIs, segmented filtering, full
 * CRUD, and a one-click status transition in one screen.
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
  const Kpi = ({ label, value, accent }) => (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</div>
      <div className={'mt-1 text-3xl font-bold ' + (accent || 'text-slate-900')}>{value}</div>
    </div>
  );

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Invoice Console</h1>
          <p className="mt-1 text-sm text-slate-500">Accounts receivable over <code>showcase_invoice</code> — aggregate, filter, edit, and collect.</p>
        </div>
        <button onClick={openNew} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500">+ New invoice</button>
      </header>

      <div className="grid grid-cols-4 gap-4">
        <Kpi label="Total" value={kpi.count} />
        <Kpi label="Draft" value={kpi.draft} accent="text-slate-500" />
        <Kpi label="Sent" value={kpi.sent} accent="text-blue-600" />
        <Kpi label="Paid" value={kpi.paid} accent="text-emerald-600" />
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map(([k, label]) => (
          <button key={k} onClick={() => setStatus(k)}
            className={'rounded-full px-3.5 py-1 text-sm font-semibold ' + (status === k ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}>{label}</button>
        ))}
      </div>

      <div className="grid grid-cols-5 gap-6">
        <section className="col-span-3 rounded-xl border border-slate-200 bg-white p-2">
          <ListView key={status + ':' + reload} objectName="showcase_invoice"
            fields={['name', 'account', 'status', 'total']} filters={filters}
            navigation={{ mode: 'none' }} onRowClick={(r) => { setSel(r); setMode('edit'); }} />
        </section>
        <section className="col-span-2 space-y-3 rounded-xl border border-slate-200 bg-white p-5">
          {editing ? (
            <React.Fragment>
              <ObjectForm key={(mode === 'create' ? 'new' : sel && sel.id) + ':' + reload}
                objectName="showcase_invoice" mode={mode}
                recordId={mode === 'edit' && sel ? sel.id : undefined}
                onSuccess={afterWrite} onCancel={() => setSel(null)} />
              {mode === 'edit' && sel && sel.status !== 'paid' ? (
                <button onClick={markPaid} className="w-full rounded-lg border border-emerald-600 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50">✓ Mark Paid</button>
              ) : null}
            </React.Fragment>
          ) : (
            <div className="flex h-full min-h-[240px] flex-col items-center justify-center text-center text-slate-400">
              <div className="text-4xl">🧾</div>
              <p className="mt-2 text-sm">Select an invoice, or create one.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}`,
});
