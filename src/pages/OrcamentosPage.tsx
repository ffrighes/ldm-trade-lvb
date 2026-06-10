import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, Download, Receipt } from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { usePermissions } from '@/hooks/usePermissions';
import { useOrcamentos, useAddOrcamento, useDeleteOrcamento } from '@/hooks/useOrcamentos';
import { FornecedorPicker } from '@/components/orcamentos/FornecedorPicker';
import { formatBRL } from '@/lib/formatCurrency';
import type { OrcamentoComTotais } from '@/types/orcamento';

function formatDate(d: string | null): string {
  if (!d) return '—';
  // d vem como 'YYYY-MM-DD'; evitar timezone usando split.
  const [y, m, day] = d.split('-');
  if (!y || !m || !day) return d;
  return `${day}/${m}/${y}`;
}

export default function OrcamentosPage() {
  const navigate = useNavigate();
  const { canManageOrcamentos, canDeleteOrcamento } = usePermissions();
  const { data: orcamentos = [], isLoading } = useOrcamentos();
  const addOrcamento = useAddOrcamento();
  const deleteOrcamento = useDeleteOrcamento();

  const [openNew, setOpenNew] = useState(false);
  const [fornecedorId, setFornecedorId] = useState<string | null>(null);
  const [data, setData] = useState('');
  const [notas, setNotas] = useState('');
  const [toDelete, setToDelete] = useState<OrcamentoComTotais | null>(null);

  const resetForm = () => {
    setFornecedorId(null);
    setData('');
    setNotas('');
  };

  const handleCreate = async () => {
    if (!fornecedorId) {
      toast.error('Selecione o fornecedor');
      return;
    }
    try {
      const created = await addOrcamento.mutateAsync({
        fornecedor_id: fornecedorId,
        data_orcamento: data || null,
        notas: notas.trim() || null,
      });
      toast.success('Orçamento criado');
      setOpenNew(false);
      resetForm();
      navigate(`/orcamentos/${created.id}`);
    } catch {
      toast.error('Erro ao criar orçamento');
    }
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    try {
      await deleteOrcamento.mutateAsync(toDelete.id);
      toast.success('Orçamento excluído');
    } catch {
      toast.error('Erro ao excluir orçamento');
    } finally {
      setToDelete(null);
    }
  };

  const handleExport = () => {
    const rows = [
      ['Fornecedor', 'Data', 'Itens', 'Total líquido', 'Total c/ imp.'],
      ...orcamentos.map((o) => [
        o.fornecedor_nome,
        formatDate(o.data_orcamento),
        o.itens_count,
        o.total_liquido,
        o.total_com_impostos,
      ]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 32 }, { wch: 12 }, { wch: 8 }, { wch: 16 }, { wch: 16 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Orçamentos');
    XLSX.writeFile(wb, `orcamentos_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-2 flex-wrap">
        <h1 className="text-2xl font-bold">Orçamentos</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport} disabled={orcamentos.length === 0}>
            <Download className="h-4 w-4 mr-2" /> Exportar XLSX
          </Button>
          {canManageOrcamentos && (
            <Button
              onClick={() => {
                resetForm();
                setOpenNew(true);
              }}
            >
              <Plus className="h-4 w-4 mr-2" /> Novo Orçamento
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fornecedor</TableHead>
                <TableHead>Data</TableHead>
                <TableHead className="text-right">Itens</TableHead>
                <TableHead className="text-right">Total líquido</TableHead>
                <TableHead className="text-right">Total c/ imp.</TableHead>
                {canDeleteOrcamento && <TableHead className="w-12" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={canDeleteOrcamento ? 6 : 5} className="text-center text-muted-foreground py-8">
                    Carregando…
                  </TableCell>
                </TableRow>
              ) : orcamentos.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={canDeleteOrcamento ? 6 : 5} className="text-center text-muted-foreground py-12">
                    <Receipt className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    Nenhum orçamento cadastrado.
                  </TableCell>
                </TableRow>
              ) : (
                orcamentos.map((o) => (
                  <TableRow
                    key={o.id}
                    className="cursor-pointer"
                    onClick={() => navigate(`/orcamentos/${o.id}`)}
                  >
                    <TableCell className="font-medium">{o.fornecedor_nome}</TableCell>
                    <TableCell>{formatDate(o.data_orcamento)}</TableCell>
                    <TableCell className="text-right">{o.itens_count}</TableCell>
                    <TableCell className="text-right">{formatBRL(o.total_liquido)}</TableCell>
                    <TableCell className="text-right">{formatBRL(o.total_com_impostos)}</TableCell>
                    {canDeleteOrcamento && (
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          title="Excluir"
                          onClick={(e) => {
                            e.stopPropagation();
                            setToDelete(o);
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Novo Orçamento */}
      <Dialog open={openNew} onOpenChange={setOpenNew}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Orçamento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Fornecedor *</Label>
              <FornecedorPicker value={fornecedorId} onChange={setFornecedorId} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="orc-data">Data</Label>
              <Input id="orc-data" type="date" value={data} onChange={(e) => setData(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="orc-notas">Observação</Label>
              <Textarea
                id="orc-notas"
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                placeholder="Opcional"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenNew(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={addOrcamento.isPending}>
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmar exclusão */}
      <AlertDialog open={!!toDelete} onOpenChange={(o) => { if (!o) setToDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir orçamento?</AlertDialogTitle>
            <AlertDialogDescription>
              {toDelete
                ? `O orçamento de "${toDelete.fornecedor_nome}" e todos os seus itens serão removidos.`
                : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
