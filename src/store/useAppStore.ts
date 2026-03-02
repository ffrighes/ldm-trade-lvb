import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Project, MaterialItem, Solicitacao, SolicitacaoStatus } from '@/types';
import { seedMaterials } from './seedData';

interface AppStore {
  projects: Project[];
  materials: MaterialItem[];
  solicitacoes: Solicitacao[];
  
  // Projects
  addProject: (p: Omit<Project, 'id' | 'dataCriacao'>) => boolean;
  updateProject: (id: string, data: Partial<Pick<Project, 'numero' | 'descricao'>>) => boolean;
  deleteProject: (id: string) => void;
  
  // Materials
  addMaterial: (m: Omit<MaterialItem, 'id'>) => boolean;
  updateMaterial: (id: string, data: Partial<Omit<MaterialItem, 'id'>>) => boolean;
  deleteMaterial: (id: string) => void;
  
  // Solicitações
  addSolicitacao: (s: Omit<Solicitacao, 'id' | 'numero'>) => void;
  updateSolicitacao: (id: string, data: Partial<Solicitacao>) => void;
  deleteSolicitacao: (id: string) => void;
}

let counter = 0;
const genId = () => `${Date.now()}-${++counter}`;
const genNumero = (prefix: string, list: { numero: string }[]) => {
  const nums = list.map(i => parseInt(i.numero.replace(/\D/g, '') || '0'));
  const next = (Math.max(0, ...nums) + 1).toString().padStart(4, '0');
  return `${prefix}${next}`;
};

export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
      projects: [],
      materials: seedMaterials(),
      solicitacoes: [],

      addProject: (p) => {
        const { projects } = get();
        if (projects.some(x => x.numero === p.numero)) return false;
        set({
          projects: [...projects, {
            ...p,
            id: genId(),
            dataCriacao: new Date().toISOString().split('T')[0],
          }],
        });
        return true;
      },
      updateProject: (id, data) => {
        const { projects } = get();
        if (data.numero && projects.some(x => x.numero === data.numero && x.id !== id)) return false;
        set({ projects: projects.map(p => p.id === id ? { ...p, ...data } : p) });
        return true;
      },
      deleteProject: (id) => set(s => ({ projects: s.projects.filter(p => p.id !== id) })),

      addMaterial: (m) => {
        const { materials } = get();
        if (materials.some(x => x.descricao === m.descricao && x.bitola === m.bitola)) return false;
        set({ materials: [...materials, { ...m, id: genId() }] });
        return true;
      },
      updateMaterial: (id, data) => {
        const { materials } = get();
        set({ materials: materials.map(m => m.id === id ? { ...m, ...data } : m) });
        return true;
      },
      deleteMaterial: (id) => set(s => ({ materials: s.materials.filter(m => m.id !== id) })),

      addSolicitacao: (s) => {
        const { solicitacoes } = get();
        const numero = genNumero('SOL-', solicitacoes);
        set({ solicitacoes: [...solicitacoes, { ...s, id: genId(), numero }] });
      },
      updateSolicitacao: (id, data) => set(s => ({
        solicitacoes: s.solicitacoes.map(x => x.id === id ? { ...x, ...data } : x),
      })),
      deleteSolicitacao: (id) => set(s => ({ solicitacoes: s.solicitacoes.filter(x => x.id !== id) })),
    }),
    { name: 'gestor-materiais-trade' }
  )
);
