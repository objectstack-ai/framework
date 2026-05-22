// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * FormPage — single component that renders a FormView either as a public
 * anonymous form (`/f/:slug` → backend `GET/POST /api/v1/forms/:slug`) or
 * as an authed internal form (`/forms/:name` → `GET /api/v1/meta/view/:name`
 * + `POST /api/v1/data/:object`).
 *
 * Both modes share the same renderer; the difference is only in how the
 * spec is loaded and where submissions go. This is the same shape as
 * Airtable Forms — the form view metadata is identical whether it is
 * embedded publicly or used by logged-in operators.
 */

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';

const API_BASE = (import.meta.env.VITE_SERVER_URL || '') + '/api/v1';

/** Resolved server payload for a public form. */
interface PublicFormPayload {
  slug: string;
  object: string;
  label?: string;
  form: FormViewSpec;
  objectSchema: ObjectSchemaPayload | null;
}

interface ObjectSchemaPayload {
  name: string;
  label?: string;
  fields: Record<string, ObjectFieldDef>;
}

interface ObjectFieldDef {
  type: string;
  label?: string;
  required?: boolean;
  defaultValue?: unknown;
  maxLength?: number;
  options?: Array<{ value: string; label?: string }> | string[];
  placeholder?: string;
  helpText?: string;
}

interface FormViewSpec {
  type?: 'simple' | 'tabbed' | 'wizard' | 'split' | 'drawer' | 'modal';
  label?: string;
  sections?: FormSectionSpec[];
  groups?: FormSectionSpec[];
  sharing?: { allowAnonymous?: boolean; publicLink?: string };
  /** Behaviour after a successful submit. */
  submitBehavior?: SubmitBehavior;
}

/** Mirrors the spec FormView.submitBehavior union (added in Step 4). */
type SubmitBehavior =
  | { kind: 'thank-you'; title?: string; message?: string }
  | { kind: 'redirect'; url: string; delayMs?: number }
  | { kind: 'continue' }
  | { kind: 'next-record' };

interface FormSectionSpec {
  label?: string;
  collapsible?: boolean;
  collapsed?: boolean;
  columns?: 1 | 2 | 3 | 4 | '1' | '2' | '3' | '4';
  fields: Array<string | FormFieldSpec>;
}

interface FormFieldSpec {
  field: string;
  label?: string;
  placeholder?: string;
  helpText?: string;
  required?: boolean;
  readonly?: boolean;
  hidden?: boolean;
  colSpan?: 1 | 2 | 3 | 4;
  widget?: string;
}

/** Normalized field row used by the renderer. */
interface RenderableField {
  name: string;
  label: string;
  type: string;
  required: boolean;
  readonly: boolean;
  hidden: boolean;
  placeholder?: string;
  helpText?: string;
  defaultValue?: unknown;
  options?: Array<{ value: string; label: string }>;
  maxLength?: number;
  colSpan: 1 | 2 | 3 | 4;
}

interface RenderableSection {
  label?: string;
  columns: 1 | 2 | 3 | 4;
  collapsible: boolean;
  collapsed: boolean;
  fields: RenderableField[];
}

// ─── Helpers ─────────────────────────────────────────────────────────

/** Coerce a `columns` literal into a numeric 1..4. */
export function normalizeColumns(c: unknown): 1 | 2 | 3 | 4 {
  const n = typeof c === 'string' ? parseInt(c, 10) : (c as number);
  if (n === 1 || n === 2 || n === 3 || n === 4) return n;
  return 2;
}

/** Normalize field options from various Object schema shapes into `{value,label}`. */
export function normalizeOptions(opts: unknown): Array<{ value: string; label: string }> | undefined {
  if (!Array.isArray(opts)) return undefined;
  return opts.map((o) => {
    if (typeof o === 'string') return { value: o, label: o };
    if (o && typeof o === 'object') {
      const v = String((o as any).value ?? (o as any).id ?? '');
      const l = String((o as any).label ?? (o as any).name ?? v);
      return { value: v, label: l };
    }
    return { value: String(o), label: String(o) };
  });
}

/**
 * Merge a FormView's section/field overrides with the target object's
 * field definitions to produce concrete rows the renderer can draw.
 * Field-level FormField overrides take precedence over object defaults.
 */
export function buildSections(
  form: FormViewSpec,
  objectSchema: ObjectSchemaPayload | null,
): RenderableSection[] {
  const sections = form.sections ?? form.groups ?? [];
  const objFields = objectSchema?.fields ?? {};
  return sections.map((sec) => {
    const cols = normalizeColumns(sec.columns);
    const fields: RenderableField[] = [];
    for (const entry of sec.fields ?? []) {
      const override: FormFieldSpec =
        typeof entry === 'string' ? { field: entry } : { ...entry };
      const def: ObjectFieldDef =
        objFields[override.field] ?? ({ type: 'text' } as ObjectFieldDef);
      fields.push({
        name: override.field,
        label: override.label ?? def.label ?? override.field,
        type: def.type ?? 'text',
        required: override.required ?? def.required ?? false,
        readonly: override.readonly ?? false,
        hidden: override.hidden ?? false,
        placeholder: override.placeholder ?? def.placeholder,
        helpText: override.helpText ?? def.helpText,
        defaultValue: def.defaultValue,
        options: normalizeOptions(def.options),
        maxLength: def.maxLength,
        colSpan: override.colSpan ?? 1,
      });
    }
    return {
      label: sec.label,
      columns: cols,
      collapsible: !!sec.collapsible,
      collapsed: !!sec.collapsed,
      fields,
    };
  });
}

/** Apply `?prefill_<field>=<value>` query params to the initial form state. */
export function readPrefill(
  fields: RenderableField[],
  search: URLSearchParams,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of fields) {
    if (f.defaultValue !== undefined) out[f.name] = f.defaultValue;
    const fromQuery = search.get(`prefill_${f.name}`);
    if (fromQuery !== null) out[f.name] = fromQuery;
  }
  return out;
}

/** Authed/anonymous fetch — credentials included so cookies (auth) flow. */
async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    ...init,
  });
}

// ─── Loaders ─────────────────────────────────────────────────────────

/**
 * Result of loading a form spec — shared by both public and internal
 * modes so the renderer downstream is mode-agnostic.
 */
interface LoadedForm {
  label: string;
  object: string;
  form: FormViewSpec;
  objectSchema: ObjectSchemaPayload | null;
}

/** Public mode: hit the anonymous `/forms/:slug` resolver. */
async function loadPublicForm(slug: string): Promise<LoadedForm> {
  const res = await apiFetch(`/forms/${encodeURIComponent(slug)}`);
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Failed to load form (${res.status}): ${body || res.statusText}`);
  }
  const payload = (await res.json()) as PublicFormPayload;
  return {
    label: payload.label ?? payload.form?.label ?? payload.object,
    object: payload.object,
    form: payload.form,
    objectSchema: payload.objectSchema,
  };
}

/**
 * Internal mode: pull the FormView metadata directly + the target object's
 * schema. We use the same `/meta` REST surface the rest of the console
 * already speaks, so anything the user has READ on works automatically.
 */
async function loadInternalForm(name: string): Promise<LoadedForm> {
  const viewRes = await apiFetch(`/meta/view/${encodeURIComponent(name)}`);
  if (!viewRes.ok) {
    throw new Error(`Form metadata not found: view/${name}`);
  }
  const viewBody = await viewRes.json();
  // /meta/:type/:name returns either { item: {...} } or the raw spec
  const item = viewBody?.item ?? viewBody;
  const spec = item?.spec ?? item;
  const objectName: string | undefined = spec?.object;
  if (!objectName) {
    throw new Error(`FormView "${name}" is missing an "object" target`);
  }
  let objectSchema: ObjectSchemaPayload | null = null;
  try {
    const objRes = await apiFetch(`/meta/object/${encodeURIComponent(objectName)}`);
    if (objRes.ok) {
      const objBody = await objRes.json();
      const objItem = objBody?.item ?? objBody;
      const objSpec = objItem?.spec ?? objItem;
      if (objSpec?.fields && typeof objSpec.fields === 'object') {
        objectSchema = {
          name: objSpec.name ?? objectName,
          label: objSpec.label,
          fields: objSpec.fields,
        };
      }
    }
  } catch {
    // Schema fallback is non-fatal — the renderer copes with text inputs.
  }
  return {
    label: spec?.label ?? name,
    object: objectName,
    form: spec,
    objectSchema,
  };
}

/** Public mode submit — POST to `/forms/:slug/submit`. */
async function submitPublic(slug: string, data: Record<string, unknown>): Promise<unknown> {
  const res = await apiFetch(`/forms/${encodeURIComponent(slug)}/submit`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Submit failed (${res.status}): ${body || res.statusText}`);
  }
  return res.json().catch(() => ({}));
}

/** Internal mode submit — POST to `/data/:object`. Auth cookie carries identity. */
async function submitInternal(
  objectName: string,
  data: Record<string, unknown>,
): Promise<unknown> {
  const res = await apiFetch(`/data/${encodeURIComponent(objectName)}`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Create failed (${res.status}): ${body || res.statusText}`);
  }
  return res.json().catch(() => ({}));
}

// ─── Field renderers ─────────────────────────────────────────────────

const FIELD_CLASS =
  'w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50';

interface FieldInputProps {
  field: RenderableField;
  value: unknown;
  onChange: (v: unknown) => void;
}

function FieldInput({ field, value, onChange }: FieldInputProps) {
  const common = {
    id: `f_${field.name}`,
    name: field.name,
    required: field.required,
    disabled: field.readonly,
    placeholder: field.placeholder,
    className: FIELD_CLASS,
  };

  const v = value == null ? '' : (value as any);

  switch (field.type) {
    case 'textarea':
    case 'paragraph':
    case 'long_text':
      return (
        <textarea
          {...common}
          rows={5}
          maxLength={field.maxLength}
          value={String(v)}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case 'number':
    case 'integer':
    case 'decimal':
    case 'currency':
      return (
        <input
          {...common}
          type="number"
          value={v === '' ? '' : Number(v)}
          onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
        />
      );
    case 'email':
      return (
        <input {...common} type="email" value={String(v)} onChange={(e) => onChange(e.target.value)} />
      );
    case 'url':
      return (
        <input {...common} type="url" value={String(v)} onChange={(e) => onChange(e.target.value)} />
      );
    case 'password':
      return (
        <input {...common} type="password" value={String(v)} onChange={(e) => onChange(e.target.value)} />
      );
    case 'date':
      return (
        <input {...common} type="date" value={String(v)} onChange={(e) => onChange(e.target.value)} />
      );
    case 'time':
      return (
        <input {...common} type="time" value={String(v)} onChange={(e) => onChange(e.target.value)} />
      );
    case 'datetime':
    case 'timestamp':
      return (
        <input
          {...common}
          type="datetime-local"
          value={String(v)}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case 'boolean':
    case 'toggle':
    case 'checkbox':
      return (
        <label className="inline-flex items-center gap-2 text-sm">
          <input
            id={common.id}
            name={common.name}
            type="checkbox"
            disabled={field.readonly}
            checked={Boolean(v)}
            onChange={(e) => onChange(e.target.checked)}
            className="h-4 w-4 rounded border-input"
          />
          <span>{field.placeholder ?? field.label}</span>
        </label>
      );
    case 'select':
    case 'picklist':
    case 'enum': {
      const opts = field.options ?? [];
      return (
        <select
          {...common}
          value={String(v)}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="" disabled={field.required}>
            {field.placeholder ?? '— Select —'}
          </option>
          {opts.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      );
    }
    case 'radio': {
      const opts = field.options ?? [];
      return (
        <div className="flex flex-wrap gap-3">
          {opts.map((o) => (
            <label key={o.value} className="inline-flex items-center gap-1.5 text-sm">
              <input
                type="radio"
                name={field.name}
                value={o.value}
                checked={String(v) === o.value}
                disabled={field.readonly}
                onChange={() => onChange(o.value)}
              />
              <span>{o.label}</span>
            </label>
          ))}
        </div>
      );
    }
    default:
      return (
        <input
          {...common}
          type="text"
          maxLength={field.maxLength}
          value={String(v)}
          onChange={(e) => onChange(e.target.value)}
        />
      );
  }
}

// ─── Main component ─────────────────────────────────────────────────

export interface FormPageProps {
  /** `'public'` for /f/:slug (anonymous), `'internal'` for /forms/:name (authed). */
  mode: 'public' | 'internal';
}

/**
 * Render a public or internal form by reading the relevant URL param.
 *
 * Why one component for both modes? The renderer, validation, layout and
 * post-submit behaviour are identical — only the *spec source* and the
 * *submit target* differ. Forking the component would duplicate the
 * field-rendering branch which is the bulk of the code.
 */
export function FormPage({ mode }: FormPageProps) {
  const params = useParams();
  const [search] = useSearchParams();
  const identifier = (mode === 'public' ? params.slug : params.name) ?? '';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<LoadedForm | null>(null);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Load spec on mount / when identifier changes.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const loader = mode === 'public' ? loadPublicForm(identifier) : loadInternalForm(identifier);
    loader
      .then((result) => {
        if (cancelled) return;
        setLoaded(result);
        const sections = buildSections(result.form, result.objectSchema);
        const allFields = sections.flatMap((s) => s.fields);
        setValues(readPrefill(allFields, search));
      })
      .catch((e) => {
        if (!cancelled) setError(e?.message ?? String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [mode, identifier, search]);

  const sections = useMemo<RenderableSection[]>(
    () => (loaded ? buildSections(loaded.form, loaded.objectSchema) : []),
    [loaded],
  );

  const behavior: SubmitBehavior =
    loaded?.form?.submitBehavior ?? { kind: 'thank-you' };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!loaded) return;
    setSubmitting(true);
    setError(null);
    try {
      if (mode === 'public') {
        await submitPublic(identifier, values);
      } else {
        await submitInternal(loaded.object, values);
      }
      toast.success('Submitted');
      // Behaviour after submit
      switch (behavior.kind) {
        case 'redirect': {
          const delay = behavior.delayMs ?? 0;
          setTimeout(() => window.location.assign(behavior.url), delay);
          setSubmitted(true);
          break;
        }
        case 'continue': {
          // Reset values to defaults so the user can submit another one.
          const allFields = sections.flatMap((s) => s.fields);
          setValues(readPrefill(allFields, search));
          break;
        }
        case 'next-record':
        case 'thank-you':
        default:
          setSubmitted(true);
          break;
      }
    } catch (err: any) {
      const msg = err?.message ?? String(err);
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-sm text-muted-foreground">Loading…</div>
      </div>
    );
  }
  if (error && !loaded) {
    return (
      <div className="mx-auto max-w-2xl p-6">
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      </div>
    );
  }
  if (!loaded) return null;

  if (submitted && behavior.kind === 'thank-you') {
    return (
      <div className="mx-auto max-w-2xl p-6">
        <div className="rounded-md border bg-card p-6 text-center">
          <h2 className="mb-2 text-lg font-semibold">
            {behavior.title ?? 'Thanks!'}
          </h2>
          <p className="text-sm text-muted-foreground">
            {behavior.message ?? 'Your submission has been received.'}
          </p>
        </div>
      </div>
    );
  }
  if (submitted && behavior.kind === 'redirect') {
    return (
      <div className="mx-auto max-w-2xl p-6 text-center text-sm text-muted-foreground">
        Redirecting…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl p-4 sm:p-6">
      <header className="mb-6">
        <h1 className="text-xl font-semibold">{loaded.label}</h1>
        {loaded.form?.label && loaded.form.label !== loaded.label && (
          <p className="mt-1 text-sm text-muted-foreground">{loaded.form.label}</p>
        )}
      </header>
      <form onSubmit={handleSubmit} className="space-y-6">
        {sections.map((sec, i) => (
          <section key={i} className="rounded-md border bg-card p-4 sm:p-5">
            {sec.label && (
              <h2 className="mb-3 text-sm font-medium">{sec.label}</h2>
            )}
            <div
              className={
                sec.columns === 1
                  ? 'grid grid-cols-1 gap-4'
                  : sec.columns === 2
                    ? 'grid grid-cols-1 gap-4 sm:grid-cols-2'
                    : sec.columns === 3
                      ? 'grid grid-cols-1 gap-4 sm:grid-cols-3'
                      : 'grid grid-cols-1 gap-4 sm:grid-cols-4'
              }
            >
              {sec.fields.filter((f) => !f.hidden).map((f) => (
                <div
                  key={f.name}
                  className={
                    f.colSpan === 2 ? 'sm:col-span-2'
                      : f.colSpan === 3 ? 'sm:col-span-3'
                        : f.colSpan === 4 ? 'sm:col-span-4'
                          : ''
                  }
                >
                  <label
                    htmlFor={`f_${f.name}`}
                    className="mb-1 block text-xs font-medium text-foreground"
                  >
                    {f.label}
                    {f.required && <span className="ml-0.5 text-destructive">*</span>}
                  </label>
                  <FieldInput
                    field={f}
                    value={values[f.name]}
                    onChange={(v) => setValues((prev) => ({ ...prev, [f.name]: v }))}
                  />
                  {f.helpText && (
                    <p className="mt-1 text-xs text-muted-foreground">{f.helpText}</p>
                  )}
                </div>
              ))}
            </div>
          </section>
        ))}
        {error && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}
        <div className="flex justify-end gap-2">
          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-50"
          >
            {submitting ? 'Submitting…' : 'Submit'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default FormPage;
