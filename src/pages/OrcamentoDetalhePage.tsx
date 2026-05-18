import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, FileSpreadsheet, Plus, Users, Download, Pencil, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  useOrcamento,
  useUpdateOrcamento,
  useAddOrcamentoItem,
  useUpdateOrcamentoItem,
  useDeleteOrcamentoItem,
  useSetOrcamentoFornecedores,
  useUpsertOrcamentoItemCotacao,
  useFetchVigenteCotacoes,
  useApplyCotacoes,
  type OrcamentoItemCotacao,
} from '@/hooks/useOrcamentos';
import { usePermissions } from '@/hooks/usePermissions';
import { OrcamentoMatrix } from '@/components/orcamentos/OrcamentoMatrix';
import { SelectFornecedoresDialog } from '@/components/orcamentos/SelectFornecedoresDialog';
import { AddOrcamentoItemDialog } from '@/components/orcamentos/AddOrcamentoItemDialog';
import { exportOrcamentoPdf } from '@/lib/exportOrcamentoPdf';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export default function OrcamentoDetalhePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { canEditOrcamento } = usePermissions();

  const { data: orc, isLoading } = useOrcamento(id!);
  const updateOrcamento = useUpdateOrcamento();
  const addItem = useAddOrcamentoItem();
  const updateItem = useUpdateOrcamentoItem();
  const deleteItem = useDeleteOrcamentoItem();
  const setFornecedores = useSetOrcamentoFornecedores();
  const upsertCotacao = useUpsertOrcamentoItemCotacao();
  const applyCotacoes = useApplyCotacoes();

  const [editingNome, setEditingNome] = useState(false);
  const [nomeValue, setNomeValue] = useState('');
  const [showFornDialog, setShowFornDialog] = useState(false);
  const [showAddItem, setShowAddItem] = useState(false);
  const [editCotacao, setEditCotacao] = useState<OrcamentoItemCotacao | null>(null);

  // Todos os fornecedores para o dialog de seleção
  const { data: allFornecedores = [] } = useQuery({
    queryKey: ['fornecedores_all'],
    queryFn: async () => {
      const { data, error } = await supabase.from('fornecedores').select('id, nome').order('nome');
      if (error) throw error;
      return data ?? [];
    },
  });

  const materialIds = orc?.itens.filter((i) => i.material_id).map((i) => i.material_id!) ?? [];
  const fornecedorIds = orc?.fornecedores.map((f) => f.fornecedor_id) ?? [];

  const { data: cotacoesVigentes = [] } = useFetchVigenteCotacoes(materialIds, fornecedorIds);

  if (isLoading) return <div className="py-12 text-center text-muted-foreground">Carregando...</div>;
  if (!orc) return <div className="py-12 text-center text-muted-foreground">Orçamento não encontrado.</div>;

  const handleSaveNome = async () => {
    await updateOrcamento.mutateAsync({ id: orc.id, nome: nomeValue });
    setEditingNome(false);
  };

  const handleSetFornecedores = async (ids: string[]) => {
    try {
      await setFornecedores.mutateAsync({ orcamentoId: orc.id, fornecedorIds: ids });
      // Auto-aplicar cotações vigentes após adicionar fornecedores
      if (orc.itens.length > 0 && ids.length > 0) {
        await applyCotacoes.mutateAsync({
          orcamentoId: orc.id,
          itens: orc.itens,
          fornecedorIds: ids,
          cotacoesVigentes,
        });
      }
      toast({ title: 'Fornecedores atualizados' });
      setShowFornDialog(false);
    } catch {
      toast({ title: 'Erro ao atualizar fornecedores', variant: 'destructive' });
    }
  };

  const handleAddItem = async (item: {
    material_id: string | null;
    descricao: string;
    bitola: string;
    erp: string;
    unidade: string;
    quantidade: number;
  }) => {
    try {
      const newItem = await addItem.mutateAsync({
        orcamento_id: orc.id,
        posicao: orc.itens.length,
        ...item,
      });
      // Buscar cotações vigentes para o novo item
      if (newItem.material_id && fornecedorIds.length > 0) {
        const cots = cotacoesVigentes.filter((c) => c.material_id === newItem.material_id);
        await applyCotacoes.mutateAsync({
          orcamentoId: orc.id,
          itens: [newItem],
          fornecedorIds,
          cotacoesVigentes: cots,
        });
      }
      toast({ title: 'Item adicionado' });
      setShowAddItem(false);
    } catch {
      toast({ title: 'Erro ao adicionar item', variant: 'destructive' });
    }
  };

  const handleEditQty = async (item: typeof orc.itens[0], quantidade: number) => {
    try {
      await updateItem.mutateAsync({ id: item.id, orcamento_id: orc.id, quantidade });
    } catch {
      toast({ title: 'Erro ao atualizar quantidade', variant: 'destructive' });
    }
  };

  const handleDeleteItem = async (item: typeof orc.itens[0]) => {
    try {
      await deleteItem.mutateAsync({ id: item.id, orcamentoId: orc.id });
      toast({ title: 'Item removido' });
    } catch {
      toast({ title: 'Erro ao remover item', variant: 'destructive' });
    }
  };

  const handleSaveCotacao = async () => {
    if (!editCotacao) return;
    try {
      await upsertCotacao.mutateAsync({ ...editCotacao, orcamentoId: orc.id });
      toast({ title: 'Cotação atualizada' });
      setEditCotacao(null);
    } catch {
      toast({ title: 'Erro ao salvar cotação', variant: 'destructive' });
    }
  };

  const handleExportPdf = () => {
    try {
      const proj = orc.projeto ?? { numero: '', descricao: '' };
      exportOrcamentoPdf(orc, proj);
    } catch {
      toast({ title: 'Erro ao gerar PDF', variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/orcamentos')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-muted-foreground" />
            <span className="font-mono text-sm text-muted-foreground">{orc.numero}</span>
          </div>
          {editingNome ? (
            <div className="flex items-center gap-2 mt-1">
              <Input
                value={nomeValue}
                onChange={(e) => setNomeValue(e.target.value)}
                className="text-xl font-bold h-8"
                autoFocus
              />
              <Button size="icon" variant="ghost" onClick={handleSaveNome}>
                <Check className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="ghost" onClick={() => setEditingNome(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2 mt-1">
              <h1 className="text-2xl font-bold">{orc.nome}</h1>
              {canEditOrcamento && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={() => { setNomeValue(orc.nome); setEditingNome(true); }}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-2 mt-1 text-sm text-muted-foreground">
            {orc.projeto && (
              <span>Projeto: {orc.projeto.numero} — {orc.projeto.descricao}</span>
            )}
            {orc.origem_bom_root_codigo && (
              <span>
                | Copiado de: {orc.origem_bom_root_codigo}
                {orc.origem_bom_version_label ? ` v${orc.origem_bom_version_label}` : ''}
                {orc.origem_data_copia
                  ? ` em ${format(new Date(orc.origem_data_copia), 'dd/MM/yyyy', { locale: ptBR })}`
                  : ''}
              </span>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          {canEditOrcamento && (
            <>
              <Button variant="outline" onClick={() => setShowAddItem(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Adicionar item
              </Button>
              <Button variant="outline" onClick={() => setShowFornDialog(true)}>
                <Users className="h-4 w-4 mr-2" />
                Fornecedores
              </Button>
            </>
          )}
          <Button variant="outline" onClick={handleExportPdf}>
            <Download className="h-4 w-4 mr-2" />
            Exportar PDF
          </Button>
        </div>
      </div>

      {/* Fornecedores chips */}
      {orc.fornecedores.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {orc.fornecedores.map((of) => (
            <Badge key={of.fornecedor_id} variant="secondary">
              {of.fornecedor.nome}
            </Badge>
          ))}
        </div>
      )}

      {/* Matriz */}
      <div className="border rounded-lg p-4">
        <h2 className="font-semibold mb-4">Matriz comparativa</h2>
        <OrcamentoMatrix
          itens={orc.itens}
          fornecedores={orc.fornecedores}
          cotacoes={orc.cotacoes}
          canEdit={canEditOrcamento}
          onEditQty={handleEditQty}
          onDeleteItem={handleDeleteItem}
          onEditCotacao={(cot) => setEditCotacao({ ...cot })}
        />
      </div>

      {/* Dialogs */}
      <SelectFornecedoresDialog
        open={showFornDialog}
        onOpenChange={setShowFornDialog}
        fornecedores={allFornecedores}
        selected={orc.fornecedores.map((f) => f.fornecedor_id)}
        onConfirm={handleSetFornecedores}
        loading={setFornecedores.isPending || applyCotacoes.isPending}
      />

      <AddOrcamentoItemDialog
        open={showAddItem}
        onOpenChange={setShowAddItem}
        onConfirm={handleAddItem}
        loading={addItem.isPending}
      />

      {/* Editar cotação manualmente */}
      {editCotacao && (
        <Dialog open onOpenChange={(v) => !v && setEditCotacao(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Editar cotação</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-3 text-sm">
              {(
                [
                  ['valor_unitario', 'Valor unitário (R$)'],
                  ['desconto_pct', 'Desconto (%)'],
                  ['ipi_pct', 'IPI (%)'],
                  ['icms_pct', 'ICMS (%)'],
                  ['pis_pct', 'PIS (%)'],
                  ['cofins_pct', 'COFINS (%)'],
                  ['lead_time_dias', 'Lead time (dias)'],
                  ['moq', 'MOQ'],
                ] as const
              ).map(([field, label]) => (
                <div key={field} className="space-y-1">
                  <Label className="text-xs">{label}</Label>
                  <Input
                    type="number"
                    min={0}
                    step="any"
                    value={(editCotacao as Record<string, number | null>)[field] ?? ''}
                    onChange={(e) =>
                      setEditCotacao((prev) =>
                        prev ? { ...prev, [field]: parseFloat(e.target.value) || 0 } : null,
                      )
                    }
                  />
                </div>
              ))}
              <div className="col-span-2 flex items-center gap-2">
                <input
                  type="checkbox"
                  id="sem_cot"
                  checked={editCotacao.sem_cotacao_vigente}
                  onChange={(e) =>
                    setEditCotacao((prev) =>
                      prev ? { ...prev, sem_cotacao_vigente: e.target.checked } : null,
                    )
                  }
                />
                <Label htmlFor="sem_cot" className="text-xs cursor-pointer">
                  Sem cotação vigente
                </Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditCotacao(null)}>Cancelar</Button>
              <Button onClick={handleSaveCotacao} disabled={upsertCotacao.isPending}>
                {upsertCotacao.isPending ? 'Salvando...' : 'Salvar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
