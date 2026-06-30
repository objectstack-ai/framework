// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { definePage } from '@objectstack/spec/ui';

/**
 * Account Cockpit — a `kind:'react'` business scenario (ADR-0081).
 *
 * A customer-360 cockpit: a live-search account list (React text input drives
 * the real `<ListView>`'s `filters`), a selected account edited in a real
 * `<ObjectForm>`, and a related-data strip that aggregates the account's
 * projects and invoices via cross-object `useAdapter` queries. Demonstrates
 * live search, master-detail edit, and cross-object roll-ups together.
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
  const Stat = ({ label, value, accent }) => (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</div>
      <div className={'mt-1 text-2xl font-bold ' + (accent || 'text-slate-900')}>{value}</div>
    </div>
  );

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-8">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Account Cockpit</h1>
          <p className="mt-1 text-sm text-slate-500">Customer-360 over <code>showcase_account</code> — search, edit, and roll up related projects &amp; invoices.</p>
        </div>
        <input value={q} onChange={(e) => { setQ(e.target.value); setSel(null); }}
          placeholder="Search accounts…"
          className="w-64 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none" />
      </header>

      <div className="grid grid-cols-5 gap-6">
        <section className="col-span-3 rounded-xl border border-slate-200 bg-white p-2">
          <ListView key={q + ':' + reload} objectName="showcase_account"
            fields={['name', 'industry', 'status', 'annual_revenue']} filters={filters}
            navigation={{ mode: 'none' }} onRowClick={(r) => setSel(r)} />
        </section>
        <section className="col-span-2 space-y-4">
          {sel ? (
            <React.Fragment>
              <div className="grid grid-cols-3 gap-3">
                <Stat label="Projects" value={related.projects} />
                <Stat label="Invoices" value={related.invoices} />
                <Stat label="Open AR" value={related.openInvoices} accent="text-amber-600" />
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <ObjectForm key={sel.id + ':' + reload} objectName="showcase_account" mode="edit"
                  recordId={sel.id} onSuccess={() => { setSel(null); setReload((k) => k + 1); }}
                  onCancel={() => setSel(null)} />
              </div>
            </React.Fragment>
          ) : (
            <div className="flex h-full min-h-[240px] flex-col items-center justify-center rounded-xl border border-slate-200 bg-white text-center text-slate-400">
              <div className="text-4xl">🛰️</div>
              <p className="mt-2 text-sm">Search and select an account.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}`,
});
