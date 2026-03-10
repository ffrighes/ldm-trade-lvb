import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { FolderKanban, FileText, Database, LayoutDashboard, Package, Sun, Moon } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/projetos', label: 'Projetos', icon: FolderKanban },
  { to: '/solicitacoes', label: 'Solicitações', icon: FileText },
  { to: '/inventario', label: 'Inventário', icon: Package },
  { to: '/base-dados', label: 'Base de Dados', icon: Database },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden md:flex w-64 flex-col bg-sidebar border-r border-sidebar-border">
        <div className="p-6 flex items-start justify-between">
          <div>
            <h1 className="text-lg font-bold text-sidebar-primary-foreground tracking-tight">
              Gestor de Materiais
            </h1>
            <p className="text-xs text-sidebar-foreground/60 mt-0.5">Trade Management</p>
          </div>
          <button
            onClick={toggleTheme}
            className="mt-1 p-1.5 rounded-md text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
            title={theme === 'dark' ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </div>
        <nav className="flex-1 px-3 space-y-1">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => {
            const active = to === '/' ? pathname === '/' : pathname.startsWith(to);
            return (
              <Link
                key={to}
                to={to}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors',
                  active
                    ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Mobile nav */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border flex">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => {
          const active = to === '/' ? pathname === '/' : pathname.startsWith(to);
          return (
            <Link
              key={to}
              to={to}
              className={cn(
                'flex-1 flex flex-col items-center py-2 text-xs transition-colors',
                active ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              <Icon className="h-5 w-5 mb-0.5" />
              {label}
            </Link>
          );
        })}
        {/* Mobile theme toggle */}
        <button
          onClick={toggleTheme}
          className="flex-1 flex flex-col items-center py-2 text-xs text-muted-foreground transition-colors"
        >
          {theme === 'dark'
            ? <Sun className="h-5 w-5 mb-0.5" />
            : <Moon className="h-5 w-5 mb-0.5" />}
          Tema
        </button>
      </div>

      <main className="flex-1 overflow-auto pb-20 md:pb-0">
        <div className="p-4 md:p-8 max-w-7xl mx-auto animate-fade-in">
          {children}
        </div>
      </main>
    </div>
  );
}
