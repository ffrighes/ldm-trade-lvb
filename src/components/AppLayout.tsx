import { useState, useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { FolderKanban, Database, LayoutDashboard, Sun, Moon, Users, LogOut, ChevronDown, Settings, PanelLeft, PanelLeftClose } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { useProjects } from '@/hooks/useSupabaseData';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import ProjectEnvironmentPanel, { useProjectEnvironmentMatch } from '@/components/ProjectEnvironmentPanel';
import { useSidebarCollapsed } from '@/hooks/useSidebarCollapsed';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const { user, signOut } = useAuth();
  const { canAccessAdmin } = usePermissions();
  const { data: projects = [] } = useProjects();
  const projectEnv = useProjectEnvironmentMatch();
  const isProjectsActive = pathname.startsWith('/projetos');
  const [projectsOpen, setProjectsOpen] = useState(isProjectsActive);
  const { collapsed, toggle: toggleSidebar } = useSidebarCollapsed();

  const sortedProjects = useMemo(
    () => [...projects].sort((a, b) => a.numero.localeCompare(b.numero)),
    [projects],
  );

  const STATIC_NAV_ITEMS = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/base-dados', label: 'Base de Dados', icon: Database },
    ...(canAccessAdmin ? [{ to: '/admin/usuarios', label: 'Usuários', icon: Users }] : []),
  ];

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const renderProjectsDropdown = (variant: 'desktop' | 'mobile' = 'desktop') => {
    if (collapsed && variant === 'desktop') {
      return (
        <Popover>
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <button
                    className={cn(
                      'flex items-center justify-center w-10 h-10 mx-auto rounded-md transition-colors',
                      isProjectsActive
                        ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                        : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                    )}
                    aria-label="Projetos"
                  >
                    <FolderKanban className="h-4 w-4" />
                  </button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent side="right">Projetos</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <PopoverContent side="right" align="start" className="min-w-64 p-2">
            <p className="px-2 py-1 text-xs font-medium text-muted-foreground">Projetos</p>
            <div className="max-h-72 overflow-y-auto space-y-0.5">
              {sortedProjects.length === 0 ? (
                <p className="px-3 py-2 text-xs text-muted-foreground">
                  Nenhum projeto encontrado
                </p>
              ) : (
                sortedProjects.map((p) => {
                  const to = `/projetos/${p.id}`;
                  const active = pathname.startsWith(`/projetos/${p.id}`);
                  return (
                    <Link
                      key={p.id}
                      to={to}
                      className={cn(
                        'block px-3 py-2 rounded-md text-sm transition-colors truncate',
                        active
                          ? 'bg-accent text-accent-foreground font-medium'
                          : 'hover:bg-accent hover:text-accent-foreground',
                      )}
                      title={`${p.numero} — ${p.descricao}`}
                    >
                      <span className="font-mono text-xs mr-2">{p.numero}</span>
                      <span className="text-xs opacity-80">{p.descricao}</span>
                    </Link>
                  );
                })
              )}
              <Link
                to="/projetos"
                className="flex items-center gap-2 px-3 py-2 rounded-md text-xs text-muted-foreground hover:bg-accent transition-colors mt-1"
              >
                <Settings className="h-3.5 w-3.5" />
                Gerenciar projetos
              </Link>
            </div>
          </PopoverContent>
        </Popover>
      );
    }

    return (
      <Collapsible open={projectsOpen} onOpenChange={setProjectsOpen}>
        <CollapsibleTrigger
          className={cn(
            'flex items-center gap-3 w-full px-3 py-2.5 rounded-md text-sm font-medium transition-colors',
            isProjectsActive
              ? 'bg-sidebar-primary text-sidebar-primary-foreground'
              : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
          )}
          aria-label="Selecionar projeto"
        >
          <FolderKanban className="h-4 w-4" />
          <span className="flex-1 text-left">Projetos</span>
          <ChevronDown
            className={cn('h-4 w-4 transition-transform', projectsOpen && 'rotate-180')}
          />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div
            className={cn(
              'mt-1 ml-2 pl-3 border-l border-sidebar-border space-y-0.5 overflow-y-auto',
              variant === 'mobile' ? 'max-h-48' : 'max-h-72',
            )}
          >
            {sortedProjects.length === 0 ? (
              <p className="px-3 py-2 text-xs text-sidebar-foreground/60">
                Nenhum projeto encontrado
              </p>
            ) : (
              sortedProjects.map((p) => {
                const to = `/projetos/${p.id}`;
                const active = pathname.startsWith(`/projetos/${p.id}`);
                return (
                  <Link
                    key={p.id}
                    to={to}
                    className={cn(
                      'block px-3 py-2 rounded-md text-sm transition-colors truncate',
                      active
                        ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                        : 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                    )}
                    title={`${p.numero} — ${p.descricao}`}
                  >
                    <span className="font-mono text-xs mr-2">{p.numero}</span>
                    <span className="text-xs opacity-80">{p.descricao}</span>
                  </Link>
                );
              })
            )}
            <Link
              to="/projetos"
              className="flex items-center gap-2 px-3 py-2 rounded-md text-xs text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors mt-1"
            >
              <Settings className="h-3.5 w-3.5" />
              Gerenciar projetos
            </Link>
          </div>
        </CollapsibleContent>
      </Collapsible>
    );
  };

  return (
    <div className="flex min-h-screen bg-background">
      <aside
        className={cn(
          'hidden md:flex flex-col bg-sidebar border-r border-sidebar-border',
          'transition-[width] duration-200 ease-out',
          collapsed ? 'w-14' : 'w-64',
        )}
      >
        <div
          className={cn(
            'flex items-start justify-between',
            collapsed ? 'p-2 flex-col items-center gap-2' : 'p-6',
          )}
        >
          {!collapsed && (
            <div>
              <h1 className="text-lg font-bold text-sidebar-primary-foreground tracking-tight">
                Gestor de Materiais
              </h1>
              <p className="text-xs text-sidebar-foreground/60 mt-0.5">Trade Management</p>
            </div>
          )}
          <button
            onClick={toggleTheme}
            className={cn(
              'p-1.5 rounded-md text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors',
              !collapsed && 'mt-1',
            )}
            title={theme === 'dark' ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </div>

        <nav className={cn('flex-1 space-y-1 overflow-y-auto', collapsed ? 'px-2' : 'px-3')}>
          {STATIC_NAV_ITEMS.slice(0, 1).map(({ to, label, icon: Icon }) => {
            const active = to === '/' ? pathname === '/' : pathname.startsWith(to);
            return (
              <Link
                key={to}
                to={to}
                title={collapsed ? label : undefined}
                className={cn(
                  'rounded-md text-sm font-medium transition-colors',
                  collapsed
                    ? 'flex items-center justify-center w-10 h-10 mx-auto'
                    : 'flex items-center gap-3 px-3 py-2.5',
                  active
                    ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                )}
              >
                <Icon className="h-4 w-4" />
                {!collapsed && label}
              </Link>
            );
          })}

          {renderProjectsDropdown('desktop')}

          {STATIC_NAV_ITEMS.slice(1).map(({ to, label, icon: Icon }) => {
            const active = pathname.startsWith(to);
            return (
              <Link
                key={to}
                to={to}
                title={collapsed ? label : undefined}
                className={cn(
                  'rounded-md text-sm font-medium transition-colors',
                  collapsed
                    ? 'flex items-center justify-center w-10 h-10 mx-auto'
                    : 'flex items-center gap-3 px-3 py-2.5',
                  active
                    ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                )}
              >
                <Icon className="h-4 w-4" />
                {!collapsed && label}
              </Link>
            );
          })}
        </nav>

        {/* Toggle collapse — sempre visível */}
        <div className={cn('px-3 pb-1', collapsed && 'px-2')}>
          <button
            onClick={toggleSidebar}
            title={collapsed ? 'Expandir menu' : 'Recolher menu'}
            aria-label={collapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'}
            className={cn(
              'flex items-center gap-3 rounded-md text-sm font-medium text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors',
              collapsed
                ? 'justify-center w-10 h-10 mx-auto'
                : 'w-full px-3 py-2',
            )}
          >
            {collapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            {!collapsed && <span>Recolher</span>}
          </button>
        </div>

        {/* User info + logout */}
        <div className={cn('border-t border-sidebar-border', collapsed ? 'p-2' : 'p-3')}>
          {!collapsed && (
            <div className="px-3 py-2">
              <p className="text-xs text-sidebar-foreground/60 truncate" title={user?.email ?? ''}>
                {user?.email}
              </p>
            </div>
          )}
          <button
            onClick={handleSignOut}
            title={collapsed ? 'Sair' : undefined}
            aria-label="Sair"
            className={cn(
              'rounded-md text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors',
              collapsed
                ? 'flex items-center justify-center w-10 h-10 mx-auto'
                : 'flex items-center gap-3 w-full px-3 py-2.5',
            )}
          >
            <LogOut className="h-4 w-4" />
            {!collapsed && 'Sair'}
          </button>
        </div>
      </aside>

      {/* Mobile nav */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border flex">
        <Link
          to="/"
          className={cn(
            'flex-1 flex flex-col items-center py-2 text-xs transition-colors',
            pathname === '/' ? 'text-primary' : 'text-muted-foreground',
          )}
        >
          <LayoutDashboard className="h-5 w-5 mb-0.5" />
          Dashboard
        </Link>
        <button
          onClick={() => setProjectsOpen((o) => !o)}
          className={cn(
            'flex-1 flex flex-col items-center py-2 text-xs transition-colors',
            isProjectsActive ? 'text-primary' : 'text-muted-foreground',
          )}
          aria-label="Selecionar projeto"
        >
          <FolderKanban className="h-5 w-5 mb-0.5" />
          Projetos
        </button>
        <Link
          to="/base-dados"
          className={cn(
            'flex-1 flex flex-col items-center py-2 text-xs transition-colors',
            pathname.startsWith('/base-dados') ? 'text-primary' : 'text-muted-foreground',
          )}
        >
          <Database className="h-5 w-5 mb-0.5" />
          Base
        </Link>
        {canAccessAdmin && (
          <Link
            to="/admin/usuarios"
            className={cn(
              'flex-1 flex flex-col items-center py-2 text-xs transition-colors',
              pathname.startsWith('/admin/usuarios') ? 'text-primary' : 'text-muted-foreground',
            )}
          >
            <Users className="h-5 w-5 mb-0.5" />
            Usuários
          </Link>
        )}
        <button
          onClick={handleSignOut}
          className="flex-1 flex flex-col items-center py-2 text-xs text-muted-foreground transition-colors"
        >
          <LogOut className="h-5 w-5 mb-0.5" />
          Sair
        </button>
      </div>

      {/* Mobile projects dropdown sheet */}
      {projectsOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/40"
          onClick={() => setProjectsOpen(false)}
        >
          <div
            className="absolute bottom-14 left-0 right-0 bg-card border-t border-border p-3 max-h-[60vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="px-3 pb-2 text-xs font-medium text-muted-foreground">Selecionar projeto</p>
            {sortedProjects.length === 0 ? (
              <p className="px-3 py-2 text-sm text-muted-foreground">Nenhum projeto encontrado</p>
            ) : (
              sortedProjects.map((p) => (
                <Link
                  key={p.id}
                  to={`/projetos/${p.id}`}
                  onClick={() => setProjectsOpen(false)}
                  className="block px-3 py-2 rounded-md text-sm hover:bg-accent"
                >
                  <span className="font-mono text-xs mr-2">{p.numero}</span>
                  {p.descricao}
                </Link>
              ))
            )}
            <Link
              to="/projetos"
              onClick={() => setProjectsOpen(false)}
              className="flex items-center gap-2 px-3 py-2 rounded-md text-xs text-muted-foreground hover:bg-accent mt-1"
            >
              <Settings className="h-3.5 w-3.5" />
              Gerenciar projetos
            </Link>
          </div>
        </div>
      )}

      {projectEnv && <ProjectEnvironmentPanel projetoId={projectEnv.projetoId} />}

      <main className="flex-1 overflow-auto pb-20 md:pb-0">
        <div className="p-4 md:p-8 max-w-7xl mx-auto animate-fade-in">
          {children}
        </div>
      </main>
    </div>
  );
}
