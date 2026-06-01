import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Boxes, Calculator, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useProjects } from '@/hooks/useSupabaseData';
import { useResizablePanel } from '@/hooks/useResizablePanel';
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
  const { width, isResizing, startResize, reset } = useResizablePanel({
    storageKey: 'project-env-panel-width',
    defaultWidth: 240,
    minWidth: 200,
    maxWidth: 480,
  });

  const bomPath = `${basePath}/boms`;
  const bomActive = pathname.startsWith(bomPath);
  const calculosPath = `${basePath}/calculos`;
  const calculosActive = pathname.startsWith(calculosPath);

  return (
    <aside
      className="hidden md:flex shrink-0 flex-col relative"
      style={{ width }}
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
            to={bomPath}
            className={cn(
              'flex items-start gap-3 px-3 py-2.5 rounded-md text-sm transition-colors border',
              bomActive
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-transparent hover:bg-accent hover:text-accent-foreground',
            )}
          >
            <Boxes className="h-4 w-4 mt-0.5 shrink-0" />
            <div className="min-w-0">
              <div className="font-medium leading-tight">BOMs</div>
            </div>
          </NavLink>

          {bomActive && (
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

          <NavLink
            to={calculosPath}
            className={cn(
              'flex items-start gap-3 px-3 py-2.5 rounded-md text-sm transition-colors border',
              calculosActive
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-transparent hover:bg-accent hover:text-accent-foreground',
            )}
          >
            <Calculator className="h-4 w-4 mt-0.5 shrink-0" />
            <div className="min-w-0">
              <div className="font-medium leading-tight">Cálculos</div>
            </div>
          </NavLink>
        </div>
      </nav>

      {/* Resize handle — invisible at rest, reveals vertical line on hover/drag */}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Redimensionar painel"
        aria-valuenow={width}
        aria-valuemin={200}
        aria-valuemax={480}
        onMouseDown={startResize}
        onDoubleClick={reset}
        className={cn(
          'absolute top-0 bottom-0 -right-1 w-2 cursor-col-resize z-10',
          'group flex items-center justify-center',
        )}
      >
        <span
          className={cn(
            'block h-full transition-all',
            isResizing
              ? 'w-0.5 bg-primary'
              : 'w-px bg-border group-hover:w-0.5 group-hover:bg-primary/60',
          )}
        />
      </div>
    </aside>
  );
}
