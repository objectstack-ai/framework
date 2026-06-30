// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { definePage } from '@objectstack/spec/ui';

/**
 * Task Desk — a `kind:'react'` business scenario (ADR-0081) showing the
 * popup-edit patterns real apps need: a **slide-out drawer** to edit a row, and
 * a **centered modal** to create. Both are author-built React overlays (fixed
 * positioning + backdrop + Esc/close state) that wrap the platform's real
 * `<ObjectForm>` — demonstrating that the react tier composes drawer/modal
 * interactions the in-page master/detail layout can't.
 */
export const TaskDeskPage = definePage({
  name: 'showcase_task_desk',
  label: 'Task Desk (React)',
  type: 'home',
  kind: 'react',
  source: `
function Page() {
  const adapter = useAdapter();
  const [editId, setEditId] = React.useState(null);   // drawer (edit existing)
  const [creating, setCreating] = React.useState(false); // modal (create new)
  const [reload, setReload] = React.useState(0);

  const closeAll = () => { setEditId(null); setCreating(false); };
  const afterWrite = () => { closeAll(); setReload((k) => k + 1); };

  // Close overlays on Escape — the kind of detail a real app needs.
  React.useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') closeAll(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Task Desk</h1>
          <p className="mt-1 text-sm text-slate-500">Click a task to edit in a <strong>drawer</strong>; create one in a <strong>modal</strong> — both wrap the real <code>&lt;ObjectForm&gt;</code>.</p>
        </div>
        <button onClick={() => setCreating(true)} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500">+ New task</button>
      </header>

      <div className="rounded-xl border border-slate-200 bg-white p-2">
        <ListView key={reload} objectName="showcase_task"
          fields={['title', 'assignee', 'status', 'priority']}
          navigation={{ mode: 'none' }} onRowClick={(r) => setEditId(r.id)} />
      </div>

      {/* Drawer — edit an existing task */}
      {editId ? (
        <div className="fixed inset-0 z-40">
          <div className="absolute inset-0 bg-slate-900/30" onClick={closeAll} />
          <div className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <h2 className="text-base font-semibold text-slate-900">Edit task</h2>
              <button onClick={closeAll} className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600" aria-label="Close">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              <ObjectForm key={'edit:' + editId + ':' + reload} objectName="showcase_task" mode="edit"
                recordId={editId} onSuccess={afterWrite} onCancel={closeAll} />
            </div>
          </div>
        </div>
      ) : null}

      {/* Modal — create a new task */}
      {creating ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40" onClick={closeAll} />
          <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">New task</h2>
              <button onClick={closeAll} className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600" aria-label="Close">✕</button>
            </div>
            <ObjectForm key={'new:' + reload} objectName="showcase_task" mode="create"
              onSuccess={afterWrite} onCancel={closeAll} />
          </div>
        </div>
      ) : null}
    </div>
  );
}`,
});
