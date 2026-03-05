// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { useState, useEffect } from 'react';
import { useClient } from '@objectstack/client-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Save, Loader2, AlertCircle } from "lucide-react";

interface ObjectDataFormProps {
    objectApiName: string;
    record?: any;
    onSuccess: () => void;
    onCancel: () => void;
}

export function ObjectDataForm({ objectApiName, record, onSuccess, onCancel }: ObjectDataFormProps) {
    const client = useClient();
    const [def, setDef] = useState<any>(null);
    const [formData, setFormData] = useState<any>({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let mounted = true;
        async function loadDef() {
            try {
                const found: any = await client.meta.getItem('object', objectApiName);
                if (mounted && found) {
                    // Spec: GetMetaItemResponse = { type, name, item }
                    const resolved = found.item || found;
                    setDef(resolved);
                    if (record) {
                        setFormData({ ...record });
                    } else {
                        setFormData({});
                    }
                }
            } catch (err) {
                console.error('Failed to load definition', err);
            }
        }
        loadDef();
        return () => { mounted = false; };
    }, [client, objectApiName, record]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        
        try {
            const dataToSubmit = { ...formData };
            delete dataToSubmit.id;
            delete dataToSubmit.created_at;
            delete dataToSubmit.updated_at;
            
            if (def && def.fields) {
                Object.keys(def.fields).forEach(key => {
                    const f = def.fields[key];
                    if (f.type === 'number' && dataToSubmit[key]) {
                        dataToSubmit[key] = parseFloat(dataToSubmit[key]);
                    }
                });
            }

            if (record && record.id) {
                await client.data.update(objectApiName, record.id, dataToSubmit);
            } else {
                await client.data.create(objectApiName, dataToSubmit);
            }
            onSuccess();
        } catch (err: any) {
            setError(err.message || 'Operation failed');
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (field: string, value: any) => {
        setFormData((prev: any) => ({
            ...prev,
            [field]: value
        }));
    };

    if (!def) {
        return (
            <Dialog open={true} onOpenChange={(open) => !open && onCancel()}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Loading...</DialogTitle>
                        <DialogDescription>Fetching object definition</DialogDescription>
                    </DialogHeader>
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                </DialogContent>
            </Dialog>
        );
    }

    const fields = def.fields || {};
    const fieldKeys = Object.keys(fields).filter(k => {
        return !['created_at', 'updated_at', 'created_by', 'updated_by'].includes(k);
    });

    const isEdit = !!(record && record.id);

    return (
        <Dialog open={true} onOpenChange={(open) => !open && onCancel()}>
            <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col p-0 gap-0">
                <DialogHeader className="px-6 pt-6 pb-4 border-b">
                    <div className="flex items-center gap-2">
                        <DialogTitle className="text-lg">
                            {isEdit ? 'Edit' : 'New'} {def.label}
                        </DialogTitle>
                        <Badge variant={isEdit ? "secondary" : "default"} className="text-xs">
                            {isEdit ? 'Editing' : 'Creating'}
                        </Badge>
                    </div>
                    <DialogDescription>
                        {isEdit
                            ? `Update the fields below to modify this ${def.label.toLowerCase()}.`
                            : `Fill in the fields below to create a new ${def.label.toLowerCase()}.`
                        }
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
                    <ScrollArea className="flex-1">
                        <div className="p-6 space-y-5">
                            {error && (
                                <div className="flex items-center gap-2 bg-destructive/10 text-destructive p-3 rounded-lg text-sm border border-destructive/20">
                                    <AlertCircle className="h-4 w-4 shrink-0" />
                                    {error}
                                </div>
                            )}

                            {fieldKeys.map(key => {
                                const field = fields[key];
                                const label = field.label || key;
                                const required = field.required;

                                return (
                                    <div key={key} className="space-y-2">
                                        <div className="flex items-center gap-2">
                                            <Label htmlFor={key} className="text-sm font-medium">
                                                {label}
                                            </Label>
                                            {required && (
                                                <span className="text-xs text-destructive">*</span>
                                            )}
                                            <Badge variant="outline" className="text-[10px] px-1 py-0 font-normal opacity-40 ml-auto">
                                                {field.type}
                                            </Badge>
                                        </div>

                                        {field.type === 'boolean' ? (
                                            <div className="flex items-center gap-3 rounded-lg border p-3">
                                                <Switch
                                                    id={key}
                                                    checked={!!formData[key]}
                                                    onCheckedChange={(checked) => handleChange(key, checked)}
                                                />
                                                <Label htmlFor={key} className="text-sm text-muted-foreground cursor-pointer">
                                                    {formData[key] ? 'Enabled' : 'Disabled'}
                                                </Label>
                                            </div>
                                        ) : field.type === 'select' ? (
                                            <Select
                                                value={formData[key] || ''}
                                                onValueChange={(value) => handleChange(key, value)}
                                            >
                                                <SelectTrigger id={key}>
                                                    <SelectValue placeholder="Select an option..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {field.options?.map((opt: any) => (
                                                        <SelectItem key={opt.value} value={opt.value}>
                                                            {opt.label}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        ) : field.type === 'textarea' ? (
                                            <Textarea
                                                id={key}
                                                value={formData[key] || ''}
                                                onChange={e => handleChange(key, e.target.value)}
                                                rows={3}
                                                required={required}
                                                placeholder={`Enter ${label.toLowerCase()}...`}
                                                className="resize-none"
                                            />
                                        ) : (
                                            <Input
                                                id={key}
                                                type={field.type === 'number' ? 'number' : 'text'}
                                                value={formData[key] || ''}
                                                onChange={e => handleChange(key, e.target.value)}
                                                required={required}
                                                placeholder={`Enter ${label.toLowerCase()}...`}
                                            />
                                        )}
                                        {field.description && (
                                            <p className="text-xs text-muted-foreground">{field.description}</p>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </ScrollArea>

                    <DialogFooter className="px-6 py-4 border-t bg-muted/30">
                        <Button variant="outline" onClick={onCancel} type="button" className="gap-1.5">
                            Cancel
                        </Button>
                        <Button type="submit" disabled={loading} className="gap-1.5">
                            {loading ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" /> Saving...
                                </>
                            ) : (
                                <>
                                    <Save className="h-4 w-4" /> {isEdit ? 'Update' : 'Create'}
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
