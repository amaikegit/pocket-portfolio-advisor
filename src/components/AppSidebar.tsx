import { useNavigate, useLocation } from "react-router-dom";
import {
  BarChart3, RefreshCw, Loader2, FileText, LogOut, DollarSign, History,
  Settings, BrainCircuit, Upload, Plus, Home,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar,
} from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAuth } from "@/contexts/AuthContext";
import { AddAssetDialog } from "@/components/AddAssetDialog";
import { AddTransactionDialog } from "@/components/AddTransactionDialog";
import { CSVImportDialog } from "@/components/CSVImportDialog";
import { AIAnalysisPanel } from "@/components/AIAnalysisPanel";
import type { Asset, Transaction, AssetCalculated } from "@/types/portfolio";

export interface AppSidebarActions {
  refreshing?: boolean;
  onRefresh?: () => void;
  calculatedAssets?: AssetCalculated[];
  assets?: Asset[];
  addAsset?: (a: Omit<Asset, "id">) => void;
  addTransaction?: (t: Omit<Transaction, "id">) => void;
  importCSV?: (csv: string) => number | Promise<number>;
}

const NAV = [
  { url: "/",                       label: "Dashboard",   icon: Home },
  { url: "/lancamentos",            label: "Lançamentos", icon: FileText },
  { url: "/dividendos",             label: "Dividendos",  icon: DollarSign },
  { url: "/snapshots",              label: "Snapshots",   icon: History },
  { url: "/configuracoes/rating",   label: "Rating",      icon: Settings },
];

export function AppSidebar(props: AppSidebarActions) {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { state, isMobile, setOpen, setOpenMobile } = useSidebar();
  const collapsed = state === "collapsed" && !isMobile;

  // Retract sidebar after any click (and re-expand toggling via header trigger)
  const collapseAfterClick = () => {
    if (isMobile) setOpenMobile(false);
    else setOpen(false);
  };

  const handleNav = (url: string) => {
    navigate(url);
    collapseAfterClick();
  };

  const isActive = (url: string) => location.pathname === url;

  const {
    refreshing, onRefresh,
    calculatedAssets = [], assets = [],
    addAsset, addTransaction, importCSV,
  } = props;

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-2 py-2">
          <div className="h-7 w-7 rounded-md bg-primary/20 flex items-center justify-center shrink-0">
            <BarChart3 className="h-3.5 w-3.5 text-primary" />
          </div>
          {!collapsed && (
            <h1 className="font-mono-display text-sm font-bold tracking-tight truncate">
              Portfolio<span className="text-primary">Tracker</span>
            </h1>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navegação</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton
                    isActive={isActive(item.url)}
                    onClick={() => handleNav(item.url)}
                    tooltip={item.label}
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {(onRefresh || addAsset || addTransaction || importCSV) && (
          <SidebarGroup>
            <SidebarGroupLabel>Ações</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {onRefresh && (
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      onClick={() => { onRefresh(); collapseAfterClick(); }}
                      disabled={refreshing}
                      tooltip="Atualizar Cotações"
                    >
                      {refreshing
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : <RefreshCw className="h-4 w-4" />}
                      <span>Atualizar Cotações</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )}

                {calculatedAssets.length >= 0 && onRefresh && (
                  <SidebarMenuItem>
                    <AIAnalysisPanel
                      assets={calculatedAssets}
                      trigger={
                        <SidebarMenuButton
                          onClick={collapseAfterClick}
                          tooltip="Análise IA"
                        >
                          <BrainCircuit className="h-4 w-4" />
                          <span>Análise IA</span>
                        </SidebarMenuButton>
                      }
                    />
                  </SidebarMenuItem>
                )}

                {importCSV && (
                  <SidebarMenuItem>
                    <CSVImportDialog
                      onImport={importCSV}
                      trigger={
                        <SidebarMenuButton
                          onClick={collapseAfterClick}
                          tooltip="Importar CSV"
                        >
                          <Upload className="h-4 w-4" />
                          <span>Importar CSV</span>
                        </SidebarMenuButton>
                      }
                    />
                  </SidebarMenuItem>
                )}

                {addTransaction && (
                  <SidebarMenuItem>
                    <AddTransactionDialog
                      onAdd={addTransaction}
                      existingTickers={assets.map((a) => a.ticker)}
                      trigger={
                        <SidebarMenuButton
                          onClick={collapseAfterClick}
                          tooltip="Adicionar Lançamento"
                        >
                          <Plus className="h-4 w-4" />
                          <span>Adicionar Lançamento</span>
                        </SidebarMenuButton>
                      }
                    />
                  </SidebarMenuItem>
                )}

                {addAsset && (
                  <SidebarMenuItem>
                    <AddAssetDialog
                      onAdd={addAsset}
                      trigger={
                        <SidebarMenuButton
                          onClick={collapseAfterClick}
                          tooltip="Adicionar Ativo"
                        >
                          <Plus className="h-4 w-4" />
                          <span>Adicionar Ativo</span>
                        </SidebarMenuButton>
                      }
                    />
                  </SidebarMenuItem>
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        <SidebarGroup>
          <SidebarGroupLabel>Preferências</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <div className="flex items-center gap-2 px-2 py-1.5">
                  <ThemeToggle />
                  {!collapsed && (
                    <span className="text-sm text-sidebar-foreground/80">Tema</span>
                  )}
                </div>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => { signOut(); collapseAfterClick(); }}
                  tooltip="Sair"
                  className="text-destructive hover:text-destructive"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Sair</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
