// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { useState } from 'react';
import { ObjectDataTable } from './ObjectDataTable';
import { ObjectSchemaInspector } from './ObjectSchemaInspector';
import { ObjectDataForm } from './ObjectDataForm';
import { ObjectApiConsole } from './ObjectApiConsole';
import { Badge } from "@/components/ui/badge";
import { Database, Code2, Table2, Globe } from 'lucide-react';

type ObjectTab = 'schema' | 'data' | 'api';

interface ObjectExplorerProps {
  objectApiName: string;
}

export function ObjectExplorer({ objectApiName }: ObjectExplorerProps) {
  const [activeTab, setActiveTab] = useState<ObjectTab>('schema');
  const [editingRecord, setEditingRecord] = useState<any>(null);
  const [showForm, setShowForm] = useState(false);
  // Refresh trigger: increment this to force data table to refetch
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  function handleEdit(record: any) {
    setEditingRecord(record);
    setShowForm(true);
  }

  function handleFormSuccess() {
    setShowForm(false);
    setEditingRecord(null);
    // Trigger data table refresh by incrementing the refresh counter
    setRefreshTrigger(prev => prev + 1);
  }

  const tabs: { id: ObjectTab; label: string; icon: React.ElementType }[] = [
    { id: 'schema', label: 'Schema', icon: Code2 },
    { id: 'data', label: 'Data', icon: Table2 },
    { id: 'api', label: 'API', icon: Globe },
  ];

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Tab bar */}
      <div className="flex items-center gap-1 border-b px-4 bg-muted/30">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium transition-colors border-b-2
                ${isActive
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                }
              `}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          );
        })}
        <div className="ml-auto flex items-center gap-2 py-2">
          <Badge variant="outline" className="font-mono text-xs gap-1">
            <Database className="h-3 w-3" />
            {objectApiName}
          </Badge>
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-auto p-4">
        {activeTab === 'schema' && (
          <ObjectSchemaInspector objectApiName={objectApiName} />
        )}
        {activeTab === 'data' && (
          <ObjectDataTable objectApiName={objectApiName} onEdit={handleEdit} refreshTrigger={refreshTrigger} />
        )}
        {activeTab === 'api' && (
          <ObjectApiConsole objectApiName={objectApiName} />
        )}
      </div>

      {/* Form Dialog */}
      {showForm && (
        <ObjectDataForm
          objectApiName={objectApiName}
          record={editingRecord && Object.keys(editingRecord).length > 0 ? editingRecord : undefined}
          onSuccess={handleFormSuccess}
          onCancel={() => { setShowForm(false); setEditingRecord(null); }}
        />
      )}
    </div>
  );
}
