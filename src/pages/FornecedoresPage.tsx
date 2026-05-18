import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, Pencil, Trash2, Truck } from 'lucide-react';
import { toast } from 'sonner';
import { usePermissions } from '@/hooks/usePermissions';
import { useMaterials } from '@/hooks/useSupabaseData';
import {
  useFornecedores,
  useFornecedorPrecos,
  useAddFornecedor,
  useUpdateFornecedor,
  useDeleteFornecedor,
  useAddPreco,
  useUpdatePreco,
  useDeletePreco,
  useFornecedorItemCounts,
  type Fornecedor,
  type FornecedorPrecoComMaterial,
} from '@/hooks/useFornecedores';
import { getVigentes, formatCotacao } from '@/lib/fornecedoresUtils';
import { FornecedorDialog } from '@/components/fornecedores/FornecedorDialog';
import { PrecoDialog } from '@/components/fornecedores/PrecoDialog';

export default function FornecedoresPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const fornecedorId = searchParams.get('fornecedorId') ?? '';

  const { canModifyFornecedores } = usePermissions();
  const { data: fornecedores = [] } = useFornecedores();
  const { data: itemCounts = new Map() } = useFornecedorItemCounts();
  const { data: precos = [] } = useFornecedorPrecos(fornecedorId || undefined);
  const { data: allMaterials = [] } = useMaterials();

  const addFornecedor = useAddFornecedor();
  const updateFornecedor = useUpdateFornecedor();
  const deleteFornecedor = useDeleteFornecedor();
  const addPreco = useAddPreco();
  const updatePreco = useUpdatePreco();
  const deletePreco = useDeletePreco();

  const [busca, setBusca] = useState('');
  const [buscaPreco, setBuscaPreco] = useState('');
  const [soVigentes, setSoVigentes] = useState(true);

  const [fornecedorDialogOpen, setFornecedorDialogOpen] = useState(false);
  const [editingFornecedor, setEditingFornecedor] = useState<Fornecedor | null>(null);
  const [deleteFornecedorTarget, setDeleteFornecedorTarget] = useState<Fornecedor | null>(null);

  const [precoDialogOpen, setPrecoDialogOpen] = useState(false);
  const [editingPreco, setEditingPreco] = useState<FornecedorPrecoComMaterial | null>(null);
  const [deletePrecoTarget, setDeletePrecoTarget] = useState<FornecedorPrecoComMaterial | null>(null);

  const fornecedorSelecionado = useMemo(
    () => fornecedores.find((f) => f.id === fornecedorId) ?? null,
    [fornecedores, fornecedorId],
  );

  const fornecedoresFiltrados = useMemo(() => {
    const q = busca.toLowerCase();
    return fornecedores.filter((f) => f.nome.toLowerCase().includes(q));
  }, [fornecedores, busca]);

  const precosExibidos = useMemo(() => {
    const base = soVigentes ? getVigentes(precos) : precos;
    const q = buscaPreco.toLowerCase();
    if (!q) return base;
    return base.filter(
      (p) =>
        p.material?.descricao.toLowerCase().includes(q) ||
        p.material?.bitola.toLowerCase().includes(q) ||
        p.codigo_fornecedor.toLowerCase().includes(q),
    );
  }, [precos, soVigentes, buscaPreco]);

  const selectFornecedor = (id: string) => {
    setSearchParams({ fornecedorId: id });
    setBuscaPreco('');
  };

  const handleSaveFornecedor = async (data: { nome: string; observacoes: string; regime_tributario: string }) => {
    try {
      if (editingFornecedor) {
        await updateFornecedor.mutateAsync({ id: editingFornecedor.id, ...data });
        toast.success('Fornecedor atualizado');
      } else {
        const novo = await addFornecedor.mutateAsync(data);
        setSearchParams({ fornecedorId: novo.id });
        toast.success('Fornecedor cadastrado');
      }
      setFornecedorDialogOpen(false);
    } catch (e: any) {
      if (e.code === '23505' || e.message?.includes('unique')) {
        toast.error('Já existe um fornecedor com esse nome');
      } else {
        toast.error('Erro ao salvar fornecedor');
      }
    }
  };

  const handleDeleteFornecedor = async () => {
    if (!deleteFornecedorTarget) return;
    try {
      await deleteFornecedor.mutateAsync(deleteFornecedorTarget.id);
      if (fornecedorId === deleteFornecedorTarget.id) setSearchParams({});
      toast.success('Fornecedor excluído');
    } catch {
      toast.error('Erro ao excluir fornecedor');
    } finally {
      setDeleteFornecedorTarget(null);
    }
  };

  const handleSavePreco = async (data: {
    material_id: string;
    codigo_fornecedor: string;
    valor_unitario: number;
    moeda: string;
    moq: number;
    lead_time_dias: number;
    desconto_pct: number;
    ipi_pct: number;
    icms_pct: number;
    data_cotacao: string;
    notas: string;
  }) => {
    try {
      if (editingPreco) {
        await updatePreco.mutateAsync({ id: editingPreco.id, fornecedor_id: fornecedorId, ...data });
        toast.success('Cotação atualizada');
      } else {
        await addPreco.mutateAsync({ fornecedor_id: fornecedorId, ...data });
        toast.success('Cotação registrada');
      }
      setPrecoDialogOpen(false);
    } catch {
      toast.error('Erro ao salvar cotação');
    }
  };

  const handleDeletePreco = async () => {
    if (!deletePrecoTarget) return;
    try {
      await deletePreco.mutateAsync({ id: deletePrecoTarget.id, fornecedor_id: fornecedorId });
      toast.success('Cotação excluída');
    } catch {
      toast.error('Erro ao excluir cotação');
    } finally {
      setDeletePrecoTarget(null);
    }
  };

  return (
    <div className="flex flex-col md:flex-row gap-4 h-full">
      {/* Painel esquerdo */}
      <div className="md:w-72 shrink-0 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Fornecedores</h2>
          {canModifyFornecedores && (
            <Button
              size="sm"
              onClick={() => {
                setEditingFornecedor(null);
                setFornecedorDialogOpen(true);
              }}
            >
              <Plus className="h-4 w-4 mr-1" />
              Novo
            </Button>
          )}
        </div>
        <Input
          placeholder="Buscar fornecedor..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
        <div className="space-y-1">
          {fornecedoresFiltrados.length === 0 ? (
            <Card>
              <CardContent className="py-6 text-center text-sm text-muted-foreground">
                {busca ? 'Nenhum resultado' : 'Nenhum fornecedor cadastrado'}
              </CardContent>
            </Card>
          ) : (
            fornecedoresFiltrados.map((f) => {
              const count = itemCounts.get(f.id) ?? 0;
              const active = f.id === fornecedorId;
              return (
                <div
                  key={f.id}
                  onClick={() => selectFornecedor(f.id)}
                  className={`group flex items-center justify-between gap-2 px-3 py-2.5 rounded-md cursor-pointer transition-colors ${
                    active
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-muted'
                  }`}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{f.nome}</p>
                    <p className={`text-xs ${active ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                      {count} {count === 1 ? 'item' : 'itens'}
                    </p>
                  </div>
                  {canModifyFornecedores && (
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className={`h-7 w-7 ${active ? 'hover:bg-primary/80 text-primary-foreground' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingFornecedor(f);
                          setFornecedorDialogOpen(true);
                        }}
                        title="Editar"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={`h-7 w-7 text-destructive hover:text-destructive ${active ? 'hover:bg-primary/80' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteFornecedorTarget(f);
                        }}
                        title="Excluir"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Painel direito */}
      <div className="flex-1 min-w-0">
        {!fornecedorSelecionado ? (
          <Card className="h-full">
            <CardContent className="flex flex-col items-center justify-center py-24 text-center gap-3">
              <Truck className="h-10 w-10 text-muted-foreground/40" />
              <p className="text-muted-foreground">Selecione um fornecedor para ver os preços</p>
              {canModifyFornecedores && fornecedores.length === 0 && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setEditingFornecedor(null);
                    setFornecedorDialogOpen(true);
                  }}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Cadastrar primeiro fornecedor
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div>
                <h1 className="text-2xl font-bold">{fornecedorSelecionado.nome}</h1>
                {fornecedorSelecionado.observacoes && (
                  <p className="text-sm text-muted-foreground mt-1">{fornecedorSelecionado.observacoes}</p>
                )}
              </div>
              {canModifyFornecedores && (
                <Button
                  onClick={() => {
                    setEditingPreco(null);
                    setPrecoDialogOpen(true);
                  }}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar Cotação
                </Button>
              )}
            </div>

            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
                  <Input
                    className="sm:max-w-xs"
                    placeholder="Buscar por material ou código..."
                    value={buscaPreco}
                    onChange={(e) => setBuscaPreco(e.target.value)}
                  />
                  <div className="flex items-center gap-2">
                    <Switch
                      id="so-vigentes"
                      checked={soVigentes}
                      onCheckedChange={setSoVigentes}
                    />
                    <Label htmlFor="so-vigentes" className="text-sm cursor-pointer">
                      Apenas vigentes
                    </Label>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                {precosExibidos.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    {precos.length === 0 ? (
                      <div className="space-y-3">
                        <p>Nenhuma cotação registrada para este fornecedor.</p>
                        {canModifyFornecedores && (
                          <Button
                            variant="outline"
                            onClick={() => {
                              setEditingPreco(null);
                              setPrecoDialogOpen(true);
                            }}
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            Adicionar primeira cotação
                          </Button>
                        )}
                      </div>
                    ) : (
                      <p>Nenhum resultado para a busca.</p>
                    )}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Item</TableHead>
                          <TableHead>Código Forn.</TableHead>
                          <TableHead className="text-right">Valor Unit.</TableHead>
                          <TableHead>Moeda</TableHead>
                          <TableHead className="text-right">MOQ</TableHead>
                          <TableHead className="text-right">Lead (dias)</TableHead>
                          <TableHead className="text-right">Desc.%</TableHead>
                          <TableHead className="text-right">IPI%</TableHead>
                          <TableHead className="text-right">ICMS%</TableHead>
                          <TableHead>Data Cotação</TableHead>
                          {canModifyFornecedores && <TableHead className="w-20">Ações</TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {precosExibidos.map((p) => (
                          <TableRow key={p.id}>
                            <TableCell>
                              <div className="font-medium text-sm">{p.material?.descricao ?? '—'}</div>
                              <div className="font-mono text-xs text-muted-foreground">{p.material?.bitola}</div>
                            </TableCell>
                            <TableCell className="font-mono text-sm">{p.codigo_fornecedor || '—'}</TableCell>
                            <TableCell className="text-right font-mono text-sm">
                              {formatCotacao(Number(p.valor_unitario), p.moeda)}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">{p.moeda}</Badge>
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm">{Number(p.moq)}</TableCell>
                            <TableCell className="text-right font-mono text-sm">{p.lead_time_dias}</TableCell>
                            <TableCell className="text-right font-mono text-sm">{Number(p.desconto_pct) > 0 ? `${Number(p.desconto_pct)}%` : '—'}</TableCell>
                            <TableCell className="text-right font-mono text-sm">{Number(p.ipi_pct) > 0 ? `${Number(p.ipi_pct)}%` : '—'}</TableCell>
                            <TableCell className="text-right font-mono text-sm">{Number(p.icms_pct) > 0 ? `${Number(p.icms_pct)}%` : '—'}</TableCell>
                            <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                              {new Date(p.data_cotacao + 'T00:00:00').toLocaleDateString('pt-BR')}
                            </TableCell>
                            {canModifyFornecedores && (
                              <TableCell>
                                <div className="flex gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => {
                                      setEditingPreco(p);
                                      setPrecoDialogOpen(true);
                                    }}
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-destructive hover:text-destructive"
                                    onClick={() => setDeletePrecoTarget(p)}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </TableCell>
                            )}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Dialogs */}
      <FornecedorDialog
        open={fornecedorDialogOpen}
        onOpenChange={setFornecedorDialogOpen}
        initial={editingFornecedor}
        onSave={handleSaveFornecedor}
        saving={addFornecedor.isPending || updateFornecedor.isPending}
      />

      <PrecoDialog
        open={precoDialogOpen}
        onOpenChange={setPrecoDialogOpen}
        initial={editingPreco}
        materials={allMaterials}
        onSave={handleSavePreco}
        saving={addPreco.isPending || updatePreco.isPending}
      />

      <AlertDialog
        open={!!deleteFornecedorTarget}
        onOpenChange={(v) => { if (!v) setDeleteFornecedorTarget(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir fornecedor?</AlertDialogTitle>
            <AlertDialogDescription>
              O fornecedor <strong>{deleteFornecedorTarget?.nome}</strong> e todas as suas cotações serão excluídos permanentemente. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteFornecedor}
              className="bg-destructive hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!deletePrecoTarget}
        onOpenChange={(v) => { if (!v) setDeletePrecoTarget(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir cotação?</AlertDialogTitle>
            <AlertDialogDescription>
              A cotação de <strong>{deletePrecoTarget?.material?.descricao} {deletePrecoTarget?.material?.bitola}</strong> registrada em{' '}
              {deletePrecoTarget && new Date(deletePrecoTarget.data_cotacao + 'T00:00:00').toLocaleDateString('pt-BR')} será removida permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeletePreco}
              className="bg-destructive hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
