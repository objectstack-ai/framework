// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { useState, useEffect } from 'react';
import { useParams } from '@tanstack/react-router';
import { useScopedClient } from '@/hooks/useObjectStackClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ArrowLeft, ArrowRight, Edit, Trash2, Plus, Search, MoreHorizontal, Check, X, RefreshCw } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ObjectDataTableProps {
    objectApiName: string;
    onEdit: (record: any) => void;
    refreshTrigger?: number;
}

function CellValue({ value, type }: { value: any; type: string }) {
    if (value === undefined || value === null) {
        return <span className="text-muted-foreground/50">—</span>;
    }
    if (type === 'boolean') {
        return value ? (
            <Badge variant="default" className="gap-1 bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800">
                <Check className="h-3 w-3" /> Yes
            </Badge>
        ) : (
            <Badge variant="secondary" className="gap-1">
                <X className="h-3 w-3" /> No
            </Badge>
        );
    }
    if (type === 'number') {
        return <span className="font-mono text-sm tabular-nums">{value}</span>;
    }
    if (type === 'select') {
        return <Badge variant="outline">{String(value)}</Badge>;
    }
    const str = String(value);
    if (str.length > 50) {
        return (
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <span className="cursor-default">{str.slice(0, 50)}…</span>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-sm">
                        <p className="text-xs">{str}</p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        );
    }
    return <span>{str}</span>;
}

function TableSkeleton({ cols }: { cols: number }) {
    return (
        <>
            {Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                    {Array.from({ length: cols + 1 }).map((_, j) => (
                        <TableCell key={j}>
                            <Skeleton className="h-4 w-full" />
                        </TableCell>
                    ))}
                </TableRow>
            ))}
        </>
    );
}

export function ObjectDataTable({ objectApiName, onEdit, refreshTrigger = 0 }: ObjectDataTableProps) {
    const params = useParams({ strict: false }) as { projectId?: string };
    const client = useScopedClient(params.projectId);
    const [def, setDef] = useState<any>(null);
    const [records, setRecords] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [searchQuery, setSearchQuery] = useState('');
    const pageSize = 10;

    // Load Definition
    useEffect(() => {
        if (!client) return;
        let mounted = true;
        async function loadDef() {
            try {
                const found: any = await client!.meta.getItem('object', objectApiName);
                if (mounted && found) {
                    // Spec: GetMetaItemResponse = { type, name, item }
                    const def = found.item || found;
                    setDef(def);
                }
            } catch (err) {
                console.error('Failed to load definition', err);
            }
        }
        loadDef();
        return () => { mounted = false; };
    }, [client, objectApiName]);

    // Load Data
    useEffect(() => {
        if (!client) return;
        let mounted = true;
        async function loadData() {
            setLoading(true);
            try {
                const result: any = await client!.data.find(objectApiName, {
                    filters: {
                        top: pageSize,
                        skip: (page - 1) * pageSize,
                        count: true
                    }
                });
                
                if (mounted) {
                    // Spec: FindDataResponse = { object, records, total?, hasMore? }
                    const records = result?.records || (Array.isArray(result) ? result : []);
                    setRecords(records);
                    if (typeof result?.total === 'number') setTotal(result.total);
                    else if (typeof result?.count === 'number') setTotal(result.count);
                }
            } catch (err) {
                console.error('Failed to load data', err);
            } finally {
                if (mounted) setLoading(false);
            }
        }
        loadData();
        return () => { mounted = false; };
    }, [client, objectApiName, page, refreshTrigger]);

    async function handleDelete(id: string) {
        if (!client) return;
        if (!confirm('Are you sure you want to delete this record?')) return;
        try {
            await client.data.delete(objectApiName, id);
            const result: any = await client.data.find(objectApiName, {
                filters: {
                    top: pageSize,
                    skip: (page - 1) * pageSize,
                    count: true
                }
            });
            // Spec: FindDataResponse = { object, records, total? }
            const records = result?.records || (Array.isArray(result) ? result : []);
            setRecords(records);
            if (typeof result?.total === 'number') setTotal(result.total);
            else if (typeof result?.count === 'number') setTotal(result.count);
        } catch (err) {
            alert('Failed to delete: ' + err);
        }
    }

    async function handleRefresh() {
        if (!client) return;
        setLoading(true);
        try {
            const result: any = await client.data.find(objectApiName, {
                filters: {
                    top: pageSize,
                    skip: (page - 1) * pageSize,
                    count: true
                }
            });
            // Spec: FindDataResponse = { object, records, total? }
            const records = result?.records || (Array.isArray(result) ? result : []);
            setRecords(records);
            if (typeof result?.total === 'number') setTotal(result.total);
            else if (typeof result?.count === 'number') setTotal(result.count);
        } catch (err) {
            console.error('Failed to refresh', err);
        } finally {
            setLoading(false);
        }
    }

    if (!def) {
        return (
            <Card>
                <CardHeader>
                    <Skeleton className="h-6 w-48" />
                    <Skeleton className="h-4 w-32 mt-1" />
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                    </div>
                </CardContent>
            </Card>
        );
    }

    const fields = def.fields || {};
    const columns = Object.keys(fields).map(key => {
        const f = fields[key];
        return {
            name: f.name || key,
            label: f.label || key,
            type: f.type || 'text'
        };
    }).filter(c => !['formatted_summary'].includes(c.name)); 

    const filteredRecords = searchQuery
        ? records.filter(record =>
            columns.some(col => {
                const val = record[col.name];
                return val !== undefined && String(val).toLowerCase().includes(searchQuery.toLowerCase());
            })
        )
        : records;

    const totalPages = Math.max(1, Math.ceil((total || records.length) / pageSize));

    return (
        <Card className="flex flex-col shadow-sm">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <div className="space-y-1">
                        <CardTitle className="text-xl font-semibold tracking-tight">
                            {def.label}
                        </CardTitle>
                        <CardDescription>
                            {total > 0 ? total : records.length} records • <code className="text-xs bg-muted px-1 py-0.5 rounded">{def.name}</code>
                        </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={handleRefresh} className="gap-1.5">
                            <RefreshCw className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">Refresh</span>
                        </Button>
                        <Button onClick={() => onEdit({})} size="sm" className="gap-1.5">
                            <Plus className="h-3.5 w-3.5" />
                            New {def.label}
                        </Button>
                    </div>
                </div>
                {/* Search bar */}
                <div className="relative mt-3">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        placeholder={`Search ${def.label.toLowerCase()}...`}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 h-9"
                    />
                </div>
            </CardHeader>
            
            <CardContent className="p-0">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow className="hover:bg-transparent">
                                {columns.map(col => (
                                    <TableHead key={col.name} className="font-medium whitespace-nowrap">
                                        <div className="flex items-center gap-1.5">
                                            {col.label}
                                            <Badge variant="outline" className="text-[10px] px-1 py-0 font-normal opacity-50 hidden lg:inline-flex">
                                                {col.type}
                                            </Badge>
                                        </div>
                                    </TableHead>
                                ))}
                                <TableHead className="w-15 sticky right-0 bg-background"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading && records.length === 0 ? (
                                <TableSkeleton cols={columns.length} />
                            ) : filteredRecords.map(record => (
                                <TableRow key={record.id} className="group">
                                    {columns.map(col => (
                                        <TableCell key={col.name} className="py-2.5">
                                            <CellValue value={record[col.name]} type={col.type} />
                                        </TableCell>
                                    ))}
                                    <TableCell className="py-2.5 sticky right-0 bg-background">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon"
                                                    className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                                                >
                                                    <MoreHorizontal className="h-4 w-4" />
                                                    <span className="sr-only">Actions</span>
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem onClick={() => onEdit(record)}>
                                                    <Edit className="mr-2 h-4 w-4" />
                                                    Edit
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem 
                                                    onClick={() => handleDelete(record.id)}
                                                    className="text-destructive focus:text-destructive"
                                                >
                                                    <Trash2 className="mr-2 h-4 w-4" />
                                                    Delete
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {!loading && filteredRecords.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={columns.length + 1} className="h-32 text-center">
                                        <div className="flex flex-col items-center gap-1.5 text-muted-foreground">
                                            <Search className="h-8 w-8 opacity-30" />
                                            <span className="text-sm font-medium">No records found</span>
                                            <span className="text-xs">
                                                {searchQuery ? 'Try a different search term' : 'Create your first record to get started'}
                                            </span>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>

            <CardFooter className="py-3 px-4 border-t flex justify-between items-center">
                <p className="text-sm text-muted-foreground">
                    Page {page} of {totalPages}
                </p>
                <div className="flex items-center gap-2">
                    <Button  
                        variant="outline" 
                        size="sm"
                        disabled={page === 1}
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        className="h-8 gap-1"
                    >
                        <ArrowLeft className="h-3.5 w-3.5" />
                        Previous
                    </Button>
                    <Button 
                        variant="outline" 
                        size="sm"
                        disabled={page >= totalPages}
                        onClick={() => setPage(p => p + 1)}
                        className="h-8 gap-1"
                    >
                        Next
                        <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                </div>
            </CardFooter>
        </Card>
    );
}
