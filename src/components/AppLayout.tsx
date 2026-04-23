import { ReactNode } from "react";
import { Clock } from "lucide-react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Progress } from "@/components/ui/progress";
import { AppSidebar, AppSidebarActions } from "@/components/AppSidebar";

interface AppLayoutProps extends AppSidebarActions {
  title: ReactNode;
  children: ReactNode;
  fetchProgress?: { current: number; total: number; status: string };
  lastUpdated?: Date | null;
}

export function AppLayout({
  title, children, fetchProgress, lastUpdated, ...actions
}: AppLayoutProps) {
  const progressPct =
    fetchProgress && fetchProgress.total > 0
      ? (fetchProgress.current / fetchProgress.total) * 100
      : 0;

  return (
    <SidebarProvider defaultOpen={false}>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar {...actions} />

        <div className="flex-1 flex flex-col min-w-0">
          <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
            <div className="px-3 sm:px-4 py-3 flex items-center gap-2 sm:gap-3">
              <SidebarTrigger />
              <h1 className="font-mono-display text-base sm:text-lg font-bold tracking-tight truncate">
                {title}
              </h1>
            </div>
            {fetchProgress && fetchProgress.total > 0 && (
              <div className="px-3 sm:px-4 pb-3 space-y-1">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{fetchProgress.status}</span>
                  <span>{fetchProgress.current}/{fetchProgress.total}</span>
                </div>
                <Progress value={progressPct} className="h-2" />
              </div>
            )}
          </header>

          <main className="flex-1 px-3 sm:px-4 py-4 sm:py-6 space-y-4 sm:space-y-6">
            {lastUpdated && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                <span>
                  Última atualização: {lastUpdated.toLocaleDateString("pt-BR")} às {lastUpdated.toLocaleTimeString("pt-BR")}
                </span>
              </div>
            )}
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
