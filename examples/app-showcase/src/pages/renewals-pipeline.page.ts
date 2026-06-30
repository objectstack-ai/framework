// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { definePage } from '@objectstack/spec/ui';

/**
 * Renewals Pipeline — a `kind:'react'` business scenario (ADR-0081).
 *
 * Authored as a DOGFOOD of the react-tier component contract
 * (skills/objectstack-ui/references/react-blocks.md): every block prop below is
 * taken straight from the contract — no guessing. A renewals manager works a list
 * of accounts on the left; selecting one drives a 360° panel on the right
 * (highlights + the account's invoices + a value-by-status chart) and a slide-out
 * <ObjectForm drawer> to update the account in place.
 *
 * Blocks exercised, with the contract props each accepts:
 *   <ListView>          objectName(req) · viewType · filters · columns · searchableFields · navigation · onRowClick
 *   <RecordHighlights>  objectName · recordId · fields · layout
 *   <RecordRelatedList> objectName · recordId · relationshipField · columns · limit · showViewAll · title
 *   <ObjectChart>       objectName(req) · aggregate · title · showLegend
 *   <ObjectForm>        objectName(req) · mode · recordId · formType · drawerSide · drawerWidth · onSuccess · onCancel
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

  return (
    <div className="flex h-full gap-4 p-4">
      <div className="flex w-1/2 flex-col gap-3">
        <div>
          <h1 className="text-lg font-semibold">Renewals Pipeline</h1>
          <p className="text-sm text-muted-foreground">Work the renewal book by lifecycle stage.</p>
        </div>
        <div className="flex gap-2">
          {STAGES.map((s) => (
            <button
              key={s.id}
              onClick={() => { setStage(s.id); setSel(null); }}
              className={
                'rounded-md border px-3 py-1.5 text-sm ' +
                (stage === s.id ? 'border-primary bg-primary/10 font-medium' : 'border-border')
              }
            >
              {s.label}
            </button>
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

      <div className="flex w-1/2 flex-col gap-4 overflow-auto">
        {!sel ? (
          <div className="flex h-full items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
            Select an account to see its renewal picture.
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">Account 360</h2>
              <button
                onClick={() => setEditing(true)}
                className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"
              >
                Edit account
              </button>
            </div>

            <RecordHighlights
              objectName="showcase_account"
              recordId={sel}
              fields={['name', 'status']}
              layout="horizontal"
            />

            <ObjectChart
              objectName="showcase_invoice"
              aggregate={{ field: 'total', function: 'sum', groupBy: 'status' }}
              title="Invoice value by status"
              showLegend={true}
            />

            <RecordRelatedList
              objectName="showcase_account"
              recordId={sel}
              relationshipField="account"
              columns={['name', 'status', 'total']}
              limit={5}
              showViewAll={true}
              title="Invoices"
            />

            {editing ? (
              <ObjectForm
                objectName="showcase_account"
                mode="edit"
                recordId={sel}
                formType="drawer"
                drawerSide="right"
                drawerWidth="480px"
                onSuccess={() => { setEditing(false); setReload((n) => n + 1); }}
                onCancel={() => setEditing(false)}
              />
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
`,
});
