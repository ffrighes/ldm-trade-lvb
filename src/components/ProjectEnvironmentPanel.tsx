import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Boxes, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useProjects } from '@/hooks/useSupabaseData';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ConjuntosTreeList } from '@/components/bom/ConjuntosTreeList';

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

  const to = `${basePath}/boms`;
  const active = pathname.startsWith(to);

  return (
    <aside
      className="hidden md:flex w-60 shrink-0 flex-col"
      aria-label="Selecionar ambiente do projeto"
    >
      <div className="p-4 border-b border-border/60">
        <p className="text-[10px] uppercase tracking-widest font-medium text-muted-foreground">
          Projeto
        </p>
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
        <p className="px-1 pb-2 text-[10px] uppercase tracking-widest font-medium text-muted-foreground">
          Ambientes
        </p>

        <div className="space-y-1">
          <NavLink
            to={to}
            className={cn(
              'flex items-start gap-3 px-3 py-2.5 rounded-md text-sm transition-colors border',
              active
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-transparent hover:bg-accent hover:text-accent-foreground',
            )}
          >
            <Boxes className="h-4 w-4 mt-0.5 shrink-0" />
            <div className="min-w-0">
              <div className="font-medium leading-tight">BOMs</div>
            </div>
          </NavLink>

          {active && (
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
                <ConjuntosTreeList projectId={projetoId} />
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>
      </nav>
    </aside>
  );
}
