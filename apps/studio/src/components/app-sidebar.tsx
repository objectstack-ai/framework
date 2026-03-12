// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import {
  Database,
  Package,
  LayoutDashboard,
  ChevronsUpDown,
  Sparkles,
  Search,
  Check,
  Zap,
  BarChart3,
  FileText,
  Workflow,
  Bot,
  Globe,
  BookOpen,
  Shield,
  AppWindow,
  Layers,
  Eye,
  EyeOff,
  FileCode,
  Palette,
  CheckSquare,
  Webhook,
  Lock,
  Link2,
  Map,
  PieChart,
  Anchor,
  UserCog,
  ChevronRight,
  Settings,
  type LucideIcon,
} from "lucide-react"
import { useState, useEffect, useCallback, useMemo } from "react"
import { useClient } from '@objectstack/client-react';
import type { InstalledPackage } from '@objectstack/spec/kernel';

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarHeader,
  SidebarSeparator,
  SidebarInput,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
} from "@/components/ui/sidebar"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

// ─── Icon & label hints ──────────────────────────────────────────────
const META_TYPE_HINTS: Record<string, { label: string; icon: LucideIcon }> = {
  object:         { label: 'Objects',         icon: Package },
  objects:        { label: 'Objects',         icon: Package },
  hooks:          { label: 'Hooks',           icon: Anchor },
  mappings:       { label: 'Mappings',        icon: Map },
  analyticsCubes: { label: 'Analytics Cubes', icon: PieChart },
  data:           { label: 'Seed Data',       icon: Database },
  app:            { label: 'Apps',            icon: AppWindow },
  apps:           { label: 'Apps',            icon: AppWindow },
  actions:        { label: 'Actions',         icon: Zap },
  views:          { label: 'Views',           icon: Eye },
  pages:          { label: 'Pages',           icon: FileCode },
  dashboards:     { label: 'Dashboards',      icon: BarChart3 },
  reports:        { label: 'Reports',         icon: FileText },
  themes:         { label: 'Themes',          icon: Palette },
  flows:          { label: 'Flows',           icon: Workflow },
  workflows:      { label: 'Workflows',       icon: Workflow },
  approvals:      { label: 'Approvals',       icon: CheckSquare },
  webhooks:       { label: 'Webhooks',        icon: Webhook },
  roles:          { label: 'Roles',           icon: UserCog },
  permissions:    { label: 'Permissions',     icon: Lock },
  profiles:       { label: 'Profiles',        icon: Shield },
  sharingRules:   { label: 'Sharing Rules',   icon: Shield },
  policies:       { label: 'Policies',        icon: Shield },
  agents:         { label: 'Agents',          icon: Bot },
  ragPipelines:   { label: 'RAG Pipelines',   icon: BookOpen },
  apis:           { label: 'APIs',            icon: Globe },
  connectors:     { label: 'Connectors',      icon: Link2 },
  plugin:         { label: 'Plugins',         icon: Layers },
  plugins:        { label: 'Plugins',         icon: Layers },
  kind:           { label: 'Kinds',           icon: Database },
};

function getTypeLabel(type: string): string {
  return META_TYPE_HINTS[type]?.label || type.charAt(0).toUpperCase() + type.slice(1);
}
function getTypeIcon(type: string): LucideIcon {
  return META_TYPE_HINTS[type]?.icon || Layers;
}

// ─── Protocol groups ─────────────────────────────────────────────────
interface ProtocolGroup {
  key: string;
  label: string;
  icon: LucideIcon;
  types: string[];
}

const PROTOCOL_GROUPS: ProtocolGroup[] = [
  { key: 'data',       label: 'Data',       icon: Database,  types: ['object', 'objects', 'hooks', 'mappings', 'analyticsCubes', 'data'] },
  { key: 'ui',         label: 'UI',         icon: AppWindow,  types: ['actions', 'views', 'pages', 'dashboards', 'reports', 'themes'] },
  { key: 'automation', label: 'Automation', icon: Workflow,   types: ['flows', 'workflows', 'approvals', 'webhooks'] },
  { key: 'security',   label: 'Security',   icon: Shield,     types: ['roles', 'permissions', 'profiles', 'sharingRules', 'policies'] },
  { key: 'ai',         label: 'AI',         icon: Bot,        types: ['agents', 'ragPipelines'] },
  { key: 'api',        label: 'API',        icon: Globe,      types: ['apis', 'connectors'] },
];

/** Types that are internal / should be hidden from the sidebar */
const HIDDEN_TYPES = new Set(['plugin', 'plugins', 'kind', 'app', 'apps', 'package']);

/** System namespace used for FQN-based names (e.g., sys__user) */
const SYSTEM_NAMESPACE = 'sys';

/** System object FQN prefix (namespace + double underscore separator) */
const SYSTEM_FQN_PREFIX = `${SYSTEM_NAMESPACE}__`;

/** Legacy system object name prefix (namespace + single underscore) */
const SYSTEM_LEGACY_PREFIX = `${SYSTEM_NAMESPACE}_`;

/** Check if an object item is a system object */
function isSystemObject(item: any): boolean {
  if (item.isSystem === true) return true;
  if (item.namespace === SYSTEM_NAMESPACE) return true;
  const name = item.name || item.id || '';
  // Match FQN format (sys__user) or legacy format (sys_user)
  return name.startsWith(SYSTEM_FQN_PREFIX) || name.startsWith(SYSTEM_LEGACY_PREFIX);
}

/** Icon mapping for package types */
const PKG_TYPE_ICONS: Record<string, LucideIcon> = {
  app: AppWindow, plugin: Layers, driver: Database, server: Globe,
  ui: Sparkles, theme: Sparkles, agent: Bot, module: Package,
  objectql: Database, adapter: Zap,
};

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  selectedObject: string | null;
  onSelectObject: (name: string) => void;
  selectedMeta?: { type: string; name: string } | null;
  onSelectMeta?: (type: string, name: string) => void;
  packages: InstalledPackage[];
  selectedPackage: InstalledPackage | null;
  onSelectPackage: (pkg: InstalledPackage) => void;
  onSelectView?: (view: 'overview' | 'packages' | 'api-console') => void;
  selectedView?: 'overview' | 'packages' | 'object' | 'metadata' | 'api-console';
}

export function AppSidebar({
  selectedObject, onSelectObject, selectedMeta, onSelectMeta,
  packages, selectedPackage, onSelectPackage, onSelectView, selectedView,
  ...props
}: AppSidebarProps) {
  const client = useClient();
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [metaTypes, setMetaTypes] = useState<string[]>([]);
  const [metaItems, setMetaItems] = useState<Record<string, any[]>>({});

  // Track which metadata *types* are expanded (show individual items)
  const [expandedTypes, setExpandedTypes] = useState<Set<string>>(new Set(['object', 'objects']));

  // Toggle to show/hide system objects in the Data protocol group
  const [showSystemInData, setShowSystemInData] = useState(true);

  const toggleTypeExpanded = (type: string) => {
    setExpandedTypes(prev => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type); else next.add(type);
      return next;
    });
  };

  /** Load all metadata types and their items from the server */
  const loadMetadata = useCallback(async () => {
    setLoading(true);
    try {
      const typesResult = await client.meta.getTypes();
      let types: string[] = [];
      if (typesResult && Array.isArray(typesResult.types)) {
        types = typesResult.types;
      } else if (Array.isArray(typesResult)) {
        types = typesResult as any;
      }
      setMetaTypes(types);

      const packageId = selectedPackage?.manifest?.id;

      const entries = await Promise.all(
        types
          .filter(t => !HIDDEN_TYPES.has(t))
          .map(async (type) => {
            try {
              const result = await client.meta.getItems(type, packageId ? { packageId } : undefined);
              let items: any[] = [];
              if (Array.isArray(result)) items = result as any;
              else if (result && Array.isArray(result.items)) items = result.items;
              else if (result && Array.isArray((result as any).value)) items = (result as any).value;
              return [type, items] as const;
            } catch {
              return [type, []] as const;
            }
          })
      );
      setMetaItems(Object.fromEntries(entries));
    } catch (err) {
      console.error("Failed to load metadata types", err);
    } finally {
      setLoading(false);
    }
  }, [client, selectedPackage]);

  useEffect(() => { loadMetadata(); }, [loadMetadata]);

  // Search helper
  const matchesSearch = (label: string, name: string) =>
    !searchQuery ||
    label.toLowerCase().includes(searchQuery.toLowerCase()) ||
    name.toLowerCase().includes(searchQuery.toLowerCase());

  // Extract system objects from loaded metadata (object/objects types)
  const systemObjects = useMemo(() => {
    const objectTypes = ['object', 'objects'];
    const sysItems: any[] = [];
    for (const type of objectTypes) {
      const items = metaItems[type] || [];
      sysItems.push(...items.filter(isSystemObject));
    }
    return sysItems;
  }, [metaItems]);

  // Filter system objects out of the Data protocol group when toggled off
  const filteredMetaItems = useMemo(() => {
    if (showSystemInData) return metaItems;
    const result = { ...metaItems };
    for (const type of ['object', 'objects']) {
      if (result[type]) {
        result[type] = result[type].filter((item: any) => !isSystemObject(item));
      }
    }
    return result;
  }, [metaItems, showSystemInData]);

  // Compute visible groups: only show groups that have at least one type with items
  const visibleGroups = PROTOCOL_GROUPS.map(group => {
    const visibleTypes = group.types.filter(t =>
      metaTypes.includes(t) && !HIDDEN_TYPES.has(t) && (filteredMetaItems[t]?.length ?? 0) > 0
    );
    const totalItems = visibleTypes.reduce((sum, t) => sum + (filteredMetaItems[t]?.length ?? 0), 0);
    return { ...group, visibleTypes, totalItems };
  }).filter(g => g.totalItems > 0);

  // Package switcher state
  const SelectedPkgIcon = selectedPackage ? (PKG_TYPE_ICONS[selectedPackage.manifest?.type] || Package) : Sparkles;

  return (
    <Sidebar {...props}>
      {/* ── Package Switcher ── */}
      <SidebarHeader className="border-b">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-sidebar-accent transition-colors">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <SelectedPkgIcon className="h-4 w-4" />
              </div>
              <div className="flex flex-1 min-w-0 flex-col gap-0.5 leading-none overflow-hidden">
                <span className="truncate font-semibold text-sm">
                  {selectedPackage ? (selectedPackage.manifest?.name || selectedPackage.manifest?.id) : 'ObjectStack'}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {selectedPackage ? `v${selectedPackage.manifest?.version} · ${selectedPackage.manifest?.type}` : 'Loading packages...'}
                </span>
              </div>
              <ChevronsUpDown className="ml-auto h-4 w-4 shrink-0 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width] min-w-64" align="start" sideOffset={4}>
            <DropdownMenuLabel>Installed Packages</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {packages.map((pkg) => {
              const Icon = PKG_TYPE_ICONS[pkg.manifest?.type] || Package;
              const isSelected = selectedPackage?.manifest?.id === pkg.manifest?.id;
              return (
                <DropdownMenuItem key={pkg.manifest?.id} onClick={() => onSelectPackage(pkg)} className="gap-2 py-2">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-primary/10 text-primary">
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex flex-1 flex-col leading-tight">
                    <span className="text-sm font-medium">{pkg.manifest?.name || pkg.manifest?.id}</span>
                    <span className="text-xs text-muted-foreground">
                      v{pkg.manifest?.version} · {pkg.manifest?.type}
                      {!pkg.enabled && ' · disabled'}
                    </span>
                  </div>
                  {isSelected && <Check className="h-4 w-4 text-primary" />}
                </DropdownMenuItem>
              );
            })}
            {packages.length === 0 && (
              <div className="px-2 py-4 text-center text-xs text-muted-foreground">No packages installed</div>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarHeader>

      <SidebarContent>
        {/* ── Overview ── */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={selectedView === 'overview' && !selectedObject}
                  onClick={() => { onSelectObject(''); onSelectView?.('overview'); }}
                >
                  <LayoutDashboard className="h-4 w-4" />
                  <span>Overview</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* ── Search ── */}
        <div className="px-4 pb-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <SidebarInput
              placeholder="Search metadata..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>

        <SidebarSeparator />

        {/* ── Protocol Groups ── */}
        {loading ? (
          <SidebarGroup>
            <SidebarGroupLabel>Loading...</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {[1,2,3].map(i => <SidebarMenuItem key={i}><SidebarMenuSkeleton showIcon /></SidebarMenuItem>)}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : (
          visibleGroups.map(group => (
            <SidebarGroup key={group.key}>
              <SidebarGroupLabel>
                <group.icon className="mr-1.5 h-3.5 w-3.5" />
                <span className="flex-1 min-w-0 truncate">{group.label}</span>
                <span className="shrink-0 text-xs tabular-nums text-sidebar-foreground/50">{group.totalItems}</span>
                {/* System objects filter toggle for Data group */}
                {group.key === 'data' && systemObjects.length > 0 && (
                  <button
                    type="button"
                    title={showSystemInData ? 'Hide system objects' : 'Show system objects'}
                    aria-label={showSystemInData ? 'Hide system objects' : 'Show system objects'}
                    onClick={(e) => { e.stopPropagation(); setShowSystemInData(!showSystemInData); }}
                    className="ml-1 shrink-0 rounded p-0.5 text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
                  >
                    {showSystemInData
                      ? <Eye className="h-3 w-3" />
                      : <EyeOff className="h-3 w-3" />}
                  </button>
                )}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {group.visibleTypes.map(type => {
                    const items = filteredMetaItems[type] || [];
                    const TypeIcon = getTypeIcon(type);
                    const typeLabel = getTypeLabel(type);
                    const isObjectType = type === 'object' || type === 'objects';
                    const isExpanded = expandedTypes.has(type) || !!searchQuery;

                    const filtered = items.filter((item: any) =>
                      matchesSearch(item.label || item.name || '', item.name || '')
                    );
                    if (filtered.length === 0 && searchQuery) return null;

                    return (
                      <Collapsible key={type} open={isExpanded} onOpenChange={() => toggleTypeExpanded(type)} asChild>
                        <SidebarMenuItem>
                          <CollapsibleTrigger asChild>
                            <SidebarMenuButton tooltip={`${typeLabel} (${items.length})`}>
                              <TypeIcon className="h-4 w-4" />
                              <span className="flex-1 min-w-0 truncate">{typeLabel}</span>
                              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{items.length}</span>
                              <ChevronRight className={`h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} />
                            </SidebarMenuButton>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <SidebarMenuSub>
                              {filtered.map((item: any) => {
                                const itemName = item.name || item.id || 'unknown';
                                const itemLabel = item.label || item.name || 'Untitled';
                                const fqnParts = itemName.includes('__') ? itemName.split('__') : [null, itemName];
                                const namespace = fqnParts.length === 2 && fqnParts[0] ? fqnParts[0] : null;

                                const isActive = isObjectType
                                  ? selectedObject === itemName
                                  : selectedMeta?.type === type && selectedMeta?.name === itemName;
                                const handleClick = isObjectType
                                  ? () => onSelectObject(itemName)
                                  : () => onSelectMeta?.(type, itemName);

                                return (
                                  <SidebarMenuSubItem key={itemName}>
                                    <SidebarMenuSubButton
                                      isActive={isActive}
                                      onClick={handleClick}
                                    >
                                      <span className="truncate">
                                        {namespace && (
                                          <span className="text-muted-foreground font-mono text-xs">{namespace}__</span>
                                        )}
                                        {itemLabel}
                                      </span>
                                    </SidebarMenuSubButton>
                                  </SidebarMenuSubItem>
                                );
                              })}
                            </SidebarMenuSub>
                          </CollapsibleContent>
                        </SidebarMenuItem>
                      </Collapsible>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))
        )}

        {!loading && visibleGroups.length === 0 && (
          <div className="px-4 py-8 text-xs text-muted-foreground flex flex-col items-center gap-2">
            <Database className="h-5 w-5 opacity-40" />
            <span>No metadata registered</span>
          </div>
        )}

        <SidebarSeparator />

        {/* ── System ── */}
        <SidebarGroup>
          <SidebarGroupLabel>
            <Settings className="mr-1.5 h-3.5 w-3.5" />
            <span className="flex-1 min-w-0 truncate">System</span>
            {systemObjects.length > 0 && (
              <span className="shrink-0 text-xs tabular-nums text-sidebar-foreground/50">{systemObjects.length}</span>
            )}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {/* Dynamic system objects */}
              {systemObjects.length > 0 && (
                <Collapsible
                  open={expandedTypes.has('_system_objects') || !!searchQuery}
                  onOpenChange={(open) => {
                    const isExpanded = expandedTypes.has('_system_objects');
                    if (open && !isExpanded) toggleTypeExpanded('_system_objects');
                    if (!open && isExpanded) toggleTypeExpanded('_system_objects');
                  }}
                  asChild
                >
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton tooltip={`System Objects (${systemObjects.length})`}>
                        <Database className="h-4 w-4" />
                        <span className="flex-1 min-w-0 truncate">System Objects</span>
                        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{systemObjects.length}</span>
                        <ChevronRight className={`h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-200 ${(expandedTypes.has('_system_objects') || !!searchQuery) ? 'rotate-90' : ''}`} />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        {systemObjects
                          .filter((item: any) => matchesSearch(item.label || item.name || '', item.name || ''))
                          .map((item: any) => {
                            const itemName = item.name || item.id || 'unknown';
                            const itemLabel = item.label || item.name || 'Untitled';

                            return (
                              <SidebarMenuSubItem key={itemName}>
                                <SidebarMenuSubButton
                                  isActive={selectedObject === itemName}
                                  onClick={() => onSelectObject(itemName)}
                                >
                                  <span className="truncate">
                                    {isSystemObject(item) && (
                                      <span className="text-muted-foreground font-mono text-xs">{SYSTEM_NAMESPACE}:</span>
                                    )}
                                    {itemLabel}
                                  </span>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            );
                          })}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>
              )}

              {/* Static system items */}
              <SidebarMenuItem>
                <SidebarMenuButton
                  tooltip="API Console"
                  isActive={selectedView === 'api-console'}
                  onClick={() => onSelectView?.('api-console')}
                >
                  <Globe className="h-4 w-4" />
                  <span>API Console</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  tooltip="Packages"
                  isActive={selectedView === 'packages'}
                  onClick={() => onSelectView?.('packages')}
                >
                  <Package className="h-4 w-4" />
                  <span>Packages</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}
