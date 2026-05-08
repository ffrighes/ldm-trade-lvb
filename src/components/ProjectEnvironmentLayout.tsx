import { useMemo } from 'react';
import { NavLink, Outlet, useParams, useLocation, Navigate } from 'react-router-dom';
import { FileText, Boxes } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useProjects } from '@/hooks/useSupabaseData';

const ENVIRONMENTS = [
  {
    key: 'solicitacoes',
    label: 'Ambiente de BOMs',
    description: 'Solicitações de materiais',
    icon: FileText,
    pathSuffix: 'solicitacoes',
  },
  {
    key: 'boms',
    label: 'Ambiente de Estruturas de Produto',
    description: 'Árvore de BOMs e versões',
    icon: Boxes,
    pathSuffix: 'boms',
  },
] as const;

export default function ProjectEnvironmentLayout() {
  const { projetoId } = useParams<{ projetoId: string }>();
  const { pathname } = useLocation();
  const { data: projects = [], isLoading } = useProjects();

  const project = useMemo(
    () => projects.find((p) => p.id === projetoId),
    [projects, projetoId],
  );

  if (!isLoading && projects.length > 0 && !project) {
    return <Navigate to="/projetos" replace />;
  }

  const basePath = `/projetos/${projetoId}`;

  return (
    <div className="flex flex-col md:flex-row gap-4 md:gap-6 -m-4 md:-m-8 p-4 md:p-8 min-h-[calc(100vh-2rem)]">
      <aside
        className="md:w-64 md:shrink-0 md:border-r md:border-border md:pr-6"
        aria-label="Selecionar ambiente do projeto"
      >
        <div className="mb-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Projeto</p>
          <p className="font-mono text-sm font-semibold mt-0.5">
            {project?.numero ?? '...'}
          </p>
          {project?.descricao && (
            <p className="text-xs text-muted-foreground truncate" title={project.descricao}>
              {project.descricao}
            </p>
          )}
        </div>

        <p className="text-xs font-medium text-muted-foreground mb-2">Ambientes</p>
        <nav className="space-y-1">
          {ENVIRONMENTS.map(({ key, label, description, icon: Icon, pathSuffix }) => {
            const to = `${basePath}/${pathSuffix}`;
            const active = pathname.startsWith(to);
            return (
              <NavLink
                key={key}
                to={to}
                className={cn(
                  'flex items-start gap-3 px-3 py-2.5 rounded-md text-sm transition-colors border',
                  active
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-transparent hover:bg-accent hover:text-accent-foreground',
                )}
              >
                <Icon className="h-4 w-4 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <div className="font-medium leading-tight">{label}</div>
                  <div
                    className={cn(
                      'text-xs mt-0.5',
                      active ? 'text-primary-foreground/80' : 'text-muted-foreground',
                    )}
                  >
                    {description}
                  </div>
                </div>
              </NavLink>
            );
          })}
        </nav>
      </aside>

      <div className="flex-1 min-w-0">
        <Outlet />
      </div>
    </div>
  );
}

export function ProjectEnvironmentPlaceholder() {
  return (
    <div className="flex items-center justify-center h-full min-h-[40vh] text-center">
      <div>
        <h2 className="text-lg font-semibold mb-1">Selecione um ambiente</h2>
        <p className="text-sm text-muted-foreground">
          Escolha entre Ambiente de BOMs ou Ambiente de Estruturas de Produto no painel ao lado.
        </p>
      </div>
    </div>
  );
}
