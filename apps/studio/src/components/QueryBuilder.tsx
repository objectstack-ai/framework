// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Plus, Trash2, Copy, Check, Play, Filter, ArrowUpDown, Columns3,
  ChevronDown, ChevronRight,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────

interface FieldOption {
  name: string;
  label: string;
  type: string;
}

interface FilterCondition {
  id: string;
  field: string;
  operator: string;
  value: string;
}

interface SortCondition {
  id: string;
  field: string;
  direction: 'asc' | 'desc';
}

interface QueryState {
  filters: FilterCondition[];
  sorts: SortCondition[];
  selectedFields: string[];
  limit: number;
  offset: number;
}

export interface QueryBuilderProps {
  objectName: string;
  fields: FieldOption[];
  onExecute?: (query: Record<string, unknown>) => void;
}

// ─── Constants ──────────────────────────────────────────────────────

const OPERATORS: Record<string, { label: string; types: string[] }> = {
  eq: { label: 'equals', types: ['text', 'number', 'boolean', 'select', 'date', 'datetime', 'lookup'] },
  neq: { label: 'not equals', types: ['text', 'number', 'boolean', 'select', 'date', 'datetime', 'lookup'] },
  gt: { label: 'greater than', types: ['number', 'date', 'datetime'] },
  gte: { label: 'greater or equal', types: ['number', 'date', 'datetime'] },
  lt: { label: 'less than', types: ['number', 'date', 'datetime'] },
  lte: { label: 'less or equal', types: ['number', 'date', 'datetime'] },
  contains: { label: 'contains', types: ['text', 'textarea'] },
  starts_with: { label: 'starts with', types: ['text', 'textarea'] },
  ends_with: { label: 'ends with', types: ['text', 'textarea'] },
  is_null: { label: 'is empty', types: ['text', 'textarea', 'number', 'date', 'datetime', 'lookup', 'select'] },
  is_not_null: { label: 'is not empty', types: ['text', 'textarea', 'number', 'date', 'datetime', 'lookup', 'select'] },
};

// ─── Helpers ────────────────────────────────────────────────────────

let _quid = 0;
function quid(): string {
  return `_q${++_quid}_${Date.now().toString(36)}`;
}

function getOperatorsForType(fieldType: string): string[] {
  return Object.entries(OPERATORS)
    .filter(([, def]) => def.types.includes(fieldType))
    .map(([key]) => key);
}

function buildQueryJson(objectName: string, state: QueryState): Record<string, unknown> {
  const query: Record<string, unknown> = { object: objectName };

  if (state.selectedFields.length > 0) {
    query.fields = state.selectedFields;
  }

  if (state.filters.length > 0) {
    query.where = state.filters.map((f) => ({
      field: f.field,
      operator: f.operator,
      value: f.value,
    }));
  }

  if (state.sorts.length > 0) {
    query.orderBy = state.sorts.map((s) => ({
      field: s.field,
      order: s.direction,
    }));
  }

  if (state.limit > 0) query.limit = state.limit;
  if (state.offset > 0) query.offset = state.offset;

  return query;
}

// ─── Component ──────────────────────────────────────────────────────

export function QueryBuilder({ objectName, fields, onExecute }: QueryBuilderProps) {
  const [state, setState] = useState<QueryState>({
    filters: [],
    sorts: [],
    selectedFields: fields.map((f) => f.name),
    limit: 10,
    offset: 0,
  });

  const [copied, setCopied] = useState(false);
  const [showFilters, setShowFilters] = useState(true);
  const [showSorts, setShowSorts] = useState(true);
  const [showFields, setShowFields] = useState(true);

  const queryJson = useMemo(() => buildQueryJson(objectName, state), [objectName, state]);
  const queryString = useMemo(() => JSON.stringify(queryJson, null, 2), [queryJson]);

  // ── Filter operations ──────────────────────────────────────────

  const addFilter = useCallback(() => {
    const defaultField = fields[0]?.name ?? '';
    const defaultType = fields[0]?.type ?? 'text';
    const ops = getOperatorsForType(defaultType);
    setState((prev) => ({
      ...prev,
      filters: [
        ...prev.filters,
        { id: quid(), field: defaultField, operator: ops[0] ?? 'eq', value: '' },
      ],
    }));
  }, [fields]);

  const updateFilter = useCallback((id: string, patch: Partial<FilterCondition>) => {
    setState((prev) => ({
      ...prev,
      filters: prev.filters.map((f) => (f.id === id ? { ...f, ...patch } : f)),
    }));
  }, []);

  const removeFilter = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      filters: prev.filters.filter((f) => f.id !== id),
    }));
  }, []);

  // ── Sort operations ────────────────────────────────────────────

  const addSort = useCallback(() => {
    const defaultField = fields[0]?.name ?? '';
    setState((prev) => ({
      ...prev,
      sorts: [...prev.sorts, { id: quid(), field: defaultField, direction: 'asc' }],
    }));
  }, [fields]);

  const updateSort = useCallback((id: string, patch: Partial<SortCondition>) => {
    setState((prev) => ({
      ...prev,
      sorts: prev.sorts.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    }));
  }, []);

  const removeSort = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      sorts: prev.sorts.filter((s) => s.id !== id),
    }));
  }, []);

  // ── Field selection ────────────────────────────────────────────

  const toggleField = useCallback((fieldName: string) => {
    setState((prev) => ({
      ...prev,
      selectedFields: prev.selectedFields.includes(fieldName)
        ? prev.selectedFields.filter((f) => f !== fieldName)
        : [...prev.selectedFields, fieldName],
    }));
  }, []);

  const selectAllFields = useCallback(() => {
    setState((prev) => ({ ...prev, selectedFields: fields.map((f) => f.name) }));
  }, [fields]);

  const deselectAllFields = useCallback(() => {
    setState((prev) => ({ ...prev, selectedFields: [] }));
  }, []);

  // ── Copy / Execute ─────────────────────────────────────────────

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(queryString);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [queryString]);

  const handleExecute = useCallback(() => {
    onExecute?.(queryJson);
  }, [onExecute, queryJson]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
      {/* ── Left: Query Builder ────────────────────────────── */}
      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Query Builder</CardTitle>
            <CardDescription>
              Build a query for <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">{objectName}</code>
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Filters */}
        <Card>
          <CardHeader className="pb-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center justify-between w-full"
            >
              <CardTitle className="text-sm flex items-center gap-2">
                {showFilters ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                <Filter className="h-3.5 w-3.5" />
                Filters
                {state.filters.length > 0 && (
                  <Badge variant="secondary" className="text-[10px]">{state.filters.length}</Badge>
                )}
              </CardTitle>
            </button>
          </CardHeader>
          {showFilters && (
            <CardContent className="space-y-2 pt-0">
              {state.filters.map((filter) => {
                const fieldDef = fields.find((f) => f.name === filter.field);
                const ops = getOperatorsForType(fieldDef?.type ?? 'text');
                const noValueOps = ['is_null', 'is_not_null'];

                return (
                  <div key={filter.id} className="flex items-center gap-2">
                    <Select
                      value={filter.field}
                      onValueChange={(val) => {
                        const newFieldDef = fields.find((f) => f.name === val);
                        const newOps = getOperatorsForType(newFieldDef?.type ?? 'text');
                        updateFilter(filter.id, {
                          field: val,
                          operator: newOps.includes(filter.operator) ? filter.operator : newOps[0],
                        });
                      }}
                    >
                      <SelectTrigger className="h-7 text-xs w-[120px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {fields.map((f) => (
                          <SelectItem key={f.name} value={f.name} className="text-xs">
                            {f.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select
                      value={filter.operator}
                      onValueChange={(val) => updateFilter(filter.id, { operator: val })}
                    >
                      <SelectTrigger className="h-7 text-xs w-[130px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ops.map((op) => (
                          <SelectItem key={op} value={op} className="text-xs">
                            {OPERATORS[op]?.label ?? op}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {!noValueOps.includes(filter.operator) && (
                      <Input
                        value={filter.value}
                        onChange={(e) => updateFilter(filter.id, { value: e.target.value })}
                        placeholder="Value"
                        className="h-7 text-xs flex-1"
                      />
                    )}

                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0"
                      onClick={() => removeFilter(filter.id)}
                    >
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </div>
                );
              })}

              <Button variant="outline" size="sm" onClick={addFilter} className="h-7 gap-1 text-xs">
                <Plus className="h-3 w-3" />
                Add Filter
              </Button>
            </CardContent>
          )}
        </Card>

        {/* Sorts */}
        <Card>
          <CardHeader className="pb-2">
            <button
              onClick={() => setShowSorts(!showSorts)}
              className="flex items-center justify-between w-full"
            >
              <CardTitle className="text-sm flex items-center gap-2">
                {showSorts ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                <ArrowUpDown className="h-3.5 w-3.5" />
                Sort
                {state.sorts.length > 0 && (
                  <Badge variant="secondary" className="text-[10px]">{state.sorts.length}</Badge>
                )}
              </CardTitle>
            </button>
          </CardHeader>
          {showSorts && (
            <CardContent className="space-y-2 pt-0">
              {state.sorts.map((sort) => (
                <div key={sort.id} className="flex items-center gap-2">
                  <Select
                    value={sort.field}
                    onValueChange={(val) => updateSort(sort.id, { field: val })}
                  >
                    <SelectTrigger className="h-7 text-xs flex-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {fields.map((f) => (
                        <SelectItem key={f.name} value={f.name} className="text-xs">
                          {f.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select
                    value={sort.direction}
                    onValueChange={(val) => updateSort(sort.id, { direction: val as 'asc' | 'desc' })}
                  >
                    <SelectTrigger className="h-7 text-xs w-[100px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="asc" className="text-xs">Ascending</SelectItem>
                      <SelectItem value="desc" className="text-xs">Descending</SelectItem>
                    </SelectContent>
                  </Select>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0"
                    onClick={() => removeSort(sort.id)}
                  >
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </div>
              ))}

              <Button variant="outline" size="sm" onClick={addSort} className="h-7 gap-1 text-xs">
                <Plus className="h-3 w-3" />
                Add Sort
              </Button>
            </CardContent>
          )}
        </Card>

        {/* Field selection */}
        <Card>
          <CardHeader className="pb-2">
            <button
              onClick={() => setShowFields(!showFields)}
              className="flex items-center justify-between w-full"
            >
              <CardTitle className="text-sm flex items-center gap-2">
                {showFields ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                <Columns3 className="h-3.5 w-3.5" />
                Fields
                <Badge variant="secondary" className="text-[10px]">
                  {state.selectedFields.length}/{fields.length}
                </Badge>
              </CardTitle>
            </button>
          </CardHeader>
          {showFields && (
            <CardContent className="pt-0 space-y-2">
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={selectAllFields} className="h-6 text-[10px]">
                  Select All
                </Button>
                <Button variant="ghost" size="sm" onClick={deselectAllFields} className="h-6 text-[10px]">
                  Deselect All
                </Button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1">
                {fields.map((f) => (
                  <label key={f.name} className="flex items-center gap-1.5 text-xs cursor-pointer py-0.5">
                    <Checkbox
                      checked={state.selectedFields.includes(f.name)}
                      onCheckedChange={() => toggleField(f.name)}
                      className="h-3.5 w-3.5"
                    />
                    <span className="truncate">{f.label}</span>
                  </label>
                ))}
              </div>
            </CardContent>
          )}
        </Card>

        {/* Pagination */}
        <Card>
          <CardContent className="py-3">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground">Limit</Label>
                <Input
                  type="number"
                  value={state.limit}
                  onChange={(e) => setState((prev) => ({ ...prev, limit: parseInt(e.target.value) || 0 }))}
                  className="h-7 w-20 text-xs"
                  min={0}
                />
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground">Offset</Label>
                <Input
                  type="number"
                  value={state.offset}
                  onChange={(e) => setState((prev) => ({ ...prev, offset: parseInt(e.target.value) || 0 }))}
                  className="h-7 w-20 text-xs"
                  min={0}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Right: JSON Preview ────────────────────────────── */}
      <div className="space-y-3">
        <Card className="sticky top-4">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Query JSON</CardTitle>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" onClick={handleCopy} className="h-7 gap-1 text-xs">
                  {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  {copied ? 'Copied' : 'Copy JSON'}
                </Button>
                {onExecute && (
                  <Button size="sm" onClick={handleExecute} className="h-7 gap-1 text-xs">
                    <Play className="h-3 w-3" />
                    Execute
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <pre className="overflow-auto p-3 text-xs font-mono bg-muted/30 rounded-b-lg whitespace-pre-wrap break-all max-h-[60vh]">
              <code>{queryString}</code>
            </pre>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default QueryBuilder;
