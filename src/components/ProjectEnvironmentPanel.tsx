import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { FileText, Boxes, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useProjects } from '@/hooks/useSupabaseData';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ConjuntosSidebarList } from '@/components/bom/ConjuntosSidebarList';

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

const PROJECT_ROUTE = /^\/projetos\/([^/]+)(?:\/.*)?$/;

export function useProjectEnvironmentMatch() {
  const { pathname } = useLocation();
  if (pathname === '/projetos') return null;
  const match = pathname.match(PROJECT_ROUTE);
  if (!match) return null;
  return { projetoId: match[1] };
}

export default function ProjectEnvironmentPanel({ projetoId }: { projetoId: string }) {
  const { pathname } = useLocation();
  const { data: projects = [] } = useProjects();
  const project = projects.find((p) => p.id === projetoId);
  const basePath = `/projetos/${projetoId}`;
  const [conjuntosOpen, setConjuntosOpen] = useState(true);

  return (
    <aside
      className="hidden md:flex w-60 shrink-0 flex-col border-r border-border bg-card/30"
      aria-label="Selecionar ambiente do projeto"
    >
      <div className="p-4 border-b border-border">
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

      <nav className="p-3 space-y-1">
        <p className="px-1 pb-1 text-xs font-medium text-muted-foreground">Ambientes</p>
        {ENVIRONMENTS.map(({ key, label, description, icon: Icon, pathSuffix }) => {
          const to = `${basePath}/${pathSuffix}`;
          const active = pathname.startsWith(to);
          const link = (
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

          if (key === 'boms' && active) {
            return (
              <div key={key} className="space-y-1">
                {link}
                <Collapsible open={conjuntosOpen} onOpenChange={setConjuntosOpen}>
                  <CollapsibleTrigger
                    className="flex w-full items-center justify-between px-3 py-1.5 rounded-md text-xs font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                  >
                    <span>Conjuntos</span>
                    <ChevronDown
                      className={cn(
                        'h-3.5 w-3.5 transition-transform',
                        conjuntosOpen ? '' : '-rotate-90',
                      )}
                    />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-1">
                    <ConjuntosSidebarList projectId={projetoId} />
                  </CollapsibleContent>
                </Collapsible>
              </div>
            );
          }

          return link;
        })}
      </nav>
    </aside>
  );
}
