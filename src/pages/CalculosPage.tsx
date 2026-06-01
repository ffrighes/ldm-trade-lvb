import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Calculator, Plus, Pencil, Trash2, Eye } from 'lucide-react';
import 'katex/dist/katex.min.css';
import { InlineMath } from 'react-katex';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { usePermissions } from '@/hooks/usePermissions';
import {
  useCalculos,
  useAddCalculo,
  useUpdateCalculo,
  useDeleteCalculo,
  type Calculo,
  type InsertCalculo,
} from '@/hooks/useCalculos';
import { CALCULO_TEMPLATES, getTemplateById } from '@/lib/calculoTemplates';

// ─── KaTeX safe renderer ─────────────────────────────────────────────────────

function SafeFormula({ formula }: { formula: string }) {
  if (!formula) return null;
  try {
    return <InlineMath math={formula} />;
  } catch {
    return <span className="font-mono text-sm text-muted-foreground">{formula}</span>;
  }
}

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'outline'> = {
  'Rascunho': 'secondary',
  'Em Revisão': 'outline',
  'Aprovado': 'default',
};

function StatusBadge({ status }: { status: string }) {
  return <Badge variant={STATUS_VARIANT[status] ?? 'secondary'}>{status}</Badge>;
}

// ─── Types ────────────────────────────────────────────────────────────────────

type DialogMode = 'create' | 'edit' | 'view' | null;

interface FormState {
  templateId: string;
  titulo: string;
  valoresMap: Record<string, string>;
  resultadoValor: string;
  resultadoUnidade: string;
  premissas: string;
  referencias: string;
  revisao: string;
  status: 'Rascunho' | 'Em Revisão' | 'Aprovado';
}

function emptyForm(): FormState {
  return {
    templateId: '',
    titulo: '',
    valoresMap: {},
    resultadoValor: '',
    resultadoUnidade: '',
    premissas: '',
    referencias: '',
    revisao: '0',
    status: 'Rascunho',
  };
}

function formFromCalculo(c: Calculo): FormState {
  const valoresMap: Record<string, string> = {};
  for (const v of c.valores) {
    valoresMap[v.nome] = String(v.valor);
  }
  return {
    templateId: c.template_id,
    titulo: c.titulo,
    valoresMap,
    resultadoValor: c.resultado_valor != null ? String(c.resultado_valor) : '',
    resultadoUnidade: c.resultado_unidade,
    premissas: c.premissas,
    referencias: c.referencias,
    revisao: c.revisao,
    status: c.status,
  };
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CalculosPage() {
  const { projetoId } = useParams<{ projetoId: string }>();
  const { canCreateCalculo, canEditCalculo, canDeleteCalculo, canApproveCalculo } = usePermissions();

  const { data: calculos = [], isLoading } = useCalculos(projetoId);
  const addCalculo = useAddCalculo();
  const updateCalculo = useUpdateCalculo();
  const deleteCalculo = useDeleteCalculo();

  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [editing, setEditing] = useState<Calculo | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [deleteTarget, setDeleteTarget] = useState<Calculo | null>(null);

  // ── Dialog helpers ────────────────────────────────────────────────────────

  function openCreate() {
    setEditing(null);
    setForm(emptyForm());
    setDialogMode('create');
  }

  function openEdit(c: Calculo) {
    setEditing(c);
    setForm(formFromCalculo(c));
    setDialogMode('edit');
  }

  function openView(c: Calculo) {
    setEditing(c);
    setForm(formFromCalculo(c));
    setDialogMode('view');
  }

  function closeDialog() {
    setDialogMode(null);
    setEditing(null);
  }

  // ── Template selection ────────────────────────────────────────────────────

  function handleTemplateChange(templateId: string) {
    const tpl = getTemplateById(templateId);
    if (!tpl) return;
    setForm((prev) => ({
      ...prev,
      templateId,
      titulo: tpl.nome.startsWith('[') ? prev.titulo : tpl.nome,
      valoresMap: {},
      resultadoUnidade: tpl.resultadoUnidade,
    }));
  }

  // ── Save ─────────────────────────────────────────────────────────────────

  async function handleSave() {
    if (!projetoId) return;
    const tpl = getTemplateById(form.templateId);

    const valores = tpl
      ? tpl.campos.map((c) => ({
          nome: c.nome,
          valor: form.valoresMap[c.nome] ?? '',
          unidade: c.unidade,
        }))
      : editing
      ? editing.valores.map((v) => ({
          ...v,
          valor: form.valoresMap[v.nome] ?? v.valor,
        }))
      : [];

    const payload: InsertCalculo = {
      projeto_id: projetoId,
      template_id: form.templateId || (editing?.template_id ?? ''),
      titulo: form.titulo.trim(),
      tipo: tpl?.grandeza ?? editing?.tipo ?? '',
      valores,
      formula: tpl?.formulaKatex ?? editing?.formula ?? '',
      resultado_valor: form.resultadoValor !== '' ? Number(form.resultadoValor) : null,
      resultado_unidade: form.resultadoUnidade,
      premissas: form.premissas,
      referencias: form.referencias,
      revisao: form.revisao,
      status: form.status,
    };

    try {
      if (dialogMode === 'create') {
        await addCalculo.mutateAsync(payload);
        toast.success('Cálculo registrado com sucesso.');
      } else if (dialogMode === 'edit' && editing) {
        await updateCalculo.mutateAsync({ id: editing.id, projetoId, ...payload });
        toast.success('Cálculo atualizado.');
      }
      closeDialog();
    } catch (err: unknown) {
      toast.error('Erro ao salvar cálculo.', {
        description: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  async function handleDelete() {
    if (!deleteTarget || !projetoId) return;
    try {
      await deleteCalculo.mutateAsync({ id: deleteTarget.id, projetoId });
      toast.success('Cálculo excluído.');
    } catch (err: unknown) {
      toast.error('Erro ao excluir.', {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setDeleteTarget(null);
    }
  }

  // ── Derived form data ─────────────────────────────────────────────────────

  const activeTpl = getTemplateById(form.templateId);
  const formulaToShow =
    dialogMode === 'view' ? editing?.formula ?? '' : activeTpl?.formulaKatex ?? '';
  const camposToRender =
    dialogMode === 'view'
      ? editing?.valores.map((v) => ({ id: v.nome, nome: v.nome, unidade: v.unidade })) ?? []
      : activeTpl?.campos ?? [];

  const isSaving = addCalculo.isPending || updateCalculo.isPending;

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Calculator className="h-6 w-6 text-muted-foreground" />
          <h1 className="text-2xl font-bold tracking-tight">Cálculos</h1>
        </div>
        {canCreateCalculo && (
          <Button onClick={openCreate} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Novo Cálculo
          </Button>
        )}
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : calculos.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Calculator className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-muted-foreground text-sm">
              Nenhum cálculo documentado neste projeto.
            </p>
            {canCreateCalculo && (
              <Button variant="outline" size="sm" className="mt-4" onClick={openCreate}>
                <Plus className="h-4 w-4 mr-2" />
                Registrar primeiro cálculo
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium">
              {calculos.length} {calculos.length === 1 ? 'registro' : 'registros'}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Título</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Tipo</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Rev.</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Resultado</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {calculos.map((c) => (
                    <tr key={c.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-medium">{c.titulo}</td>
                      <td className="px-4 py-3 text-muted-foreground">{c.tipo}</td>
                      <td className="px-4 py-3 font-mono text-xs">{c.revisao}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={c.status} />
                      </td>
                      <td className="px-4 py-3">
                        {c.resultado_valor != null
                          ? `${c.resultado_valor} ${c.resultado_unidade}`
                          : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openView(c)} title="Visualizar">
                            <Eye className="h-4 w-4" />
                          </Button>
                          {canEditCalculo && (
                            <Button variant="ghost" size="icon" onClick={() => openEdit(c)} title="Editar">
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}
                          {canDeleteCalculo && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive"
                              onClick={() => setDeleteTarget(c)}
                              title="Excluir"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Create / Edit / View Dialog ────────────────────────────────────── */}
      <Dialog open={dialogMode !== null} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {dialogMode === 'create' && 'Novo Cálculo'}
              {dialogMode === 'edit' && 'Editar Cálculo'}
              {dialogMode === 'view' && 'Visualizar Cálculo'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Template selector — só no modo criar */}
            {dialogMode === 'create' && (
              <div className="space-y-1.5">
                <Label>Template</Label>
                <Select value={form.templateId} onValueChange={handleTemplateChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um template de cálculo" />
                  </SelectTrigger>
                  <SelectContent>
                    {CALCULO_TEMPLATES.map((tpl) => (
                      <SelectItem key={tpl.id} value={tpl.id}>
                        <span>{tpl.nome}</span>
                        <span className="ml-2 text-xs text-muted-foreground">— {tpl.grandeza}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Título */}
            <div className="space-y-1.5">
              <Label>Título *</Label>
              {dialogMode === 'view' ? (
                <p className="text-sm font-medium">{form.titulo}</p>
              ) : (
                <Input
                  value={form.titulo}
                  onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))}
                  placeholder="Título do cálculo"
                />
              )}
            </div>

            {/* Fórmula KaTeX */}
            {formulaToShow && (
              <div className="space-y-1.5">
                <Label>Fórmula</Label>
                <div className="rounded-md border bg-muted/40 px-4 py-3">
                  <SafeFormula formula={formulaToShow} />
                </div>
              </div>
            )}

            {/* Campos de entrada */}
            {camposToRender.length > 0 && (
              <div className="space-y-3">
                <Label>Valores de entrada</Label>
                {camposToRender.map((campo) => (
                  <div key={campo.id ?? campo.nome} className="flex items-center gap-3">
                    <Label className="w-40 shrink-0 text-sm text-muted-foreground">{campo.nome}</Label>
                    {dialogMode === 'view' ? (
                      <span className="text-sm">
                        {form.valoresMap[campo.nome] ?? '—'}{' '}
                        <span className="text-muted-foreground">{campo.unidade}</span>
                      </span>
                    ) : (
                      <>
                        <Input
                          className="flex-1"
                          type="number"
                          value={form.valoresMap[campo.nome] ?? ''}
                          onChange={(e) =>
                            setForm((f) => ({
                              ...f,
                              valoresMap: { ...f.valoresMap, [campo.nome]: e.target.value },
                            }))
                          }
                          placeholder="0"
                        />
                        <span className="text-sm text-muted-foreground w-16 shrink-0">{campo.unidade}</span>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Resultado */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Resultado</Label>
                {dialogMode === 'view' ? (
                  <p className="text-sm">
                    {form.resultadoValor !== '' ? form.resultadoValor : '—'}
                    {' '}
                    <span className="text-muted-foreground">{form.resultadoUnidade}</span>
                  </p>
                ) : (
                  <Input
                    type="number"
                    value={form.resultadoValor}
                    onChange={(e) => setForm((f) => ({ ...f, resultadoValor: e.target.value }))}
                    placeholder="Valor numérico"
                  />
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Unidade do resultado</Label>
                {dialogMode === 'view' ? (
                  <p className="text-sm">{form.resultadoUnidade || '—'}</p>
                ) : (
                  <Input
                    value={form.resultadoUnidade}
                    onChange={(e) => setForm((f) => ({ ...f, resultadoUnidade: e.target.value }))}
                    placeholder="ex.: bar, m³/h, mm"
                    list="unidades-datalist"
                  />
                )}
              </div>
            </div>

            <datalist id="unidades-datalist">
              {['bar','m³/h','mm','°C','kg','kN','MPa','m/s','L/min','m','in','psi','%','adim'].map((u) => (
                <option key={u} value={u} />
              ))}
            </datalist>

            {/* Premissas */}
            <div className="space-y-1.5">
              <Label>Premissas</Label>
              {dialogMode === 'view' ? (
                <p className="text-sm whitespace-pre-wrap">{form.premissas || '—'}</p>
              ) : (
                <Textarea
                  value={form.premissas}
                  onChange={(e) => setForm((f) => ({ ...f, premissas: e.target.value }))}
                  placeholder="Hipóteses e premissas adotadas no cálculo"
                  rows={3}
                />
              )}
            </div>

            {/* Referências */}
            <div className="space-y-1.5">
              <Label>Referências / Normas</Label>
              {dialogMode === 'view' ? (
                <p className="text-sm">{form.referencias || '—'}</p>
              ) : (
                <Input
                  value={form.referencias}
                  onChange={(e) => setForm((f) => ({ ...f, referencias: e.target.value }))}
                  placeholder="ex.: ABNT NBR 6118, ASME B31.3"
                />
              )}
            </div>

            {/* Revisão + Status */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Revisão</Label>
                {dialogMode === 'view' ? (
                  <p className="font-mono text-sm">{form.revisao}</p>
                ) : (
                  <Input
                    value={form.revisao}
                    onChange={(e) => setForm((f) => ({ ...f, revisao: e.target.value }))}
                    placeholder="0"
                  />
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                {dialogMode === 'view' ? (
                  <StatusBadge status={form.status} />
                ) : (
                  <Select
                    value={form.status}
                    onValueChange={(v) => setForm((f) => ({ ...f, status: v as FormState['status'] }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Rascunho">Rascunho</SelectItem>
                      <SelectItem value="Em Revisão">Em Revisão</SelectItem>
                      <SelectItem value="Aprovado" disabled={!canApproveCalculo}>
                        Aprovado
                      </SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>
              {dialogMode === 'view' ? 'Fechar' : 'Cancelar'}
            </Button>
            {dialogMode !== 'view' && (
              <Button onClick={handleSave} disabled={isSaving || !form.titulo.trim()}>
                {isSaving ? 'Salvando…' : 'Salvar'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirm ─────────────────────────────────────────────────── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir cálculo?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{deleteTarget?.titulo}</strong> será excluído permanentemente.
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
