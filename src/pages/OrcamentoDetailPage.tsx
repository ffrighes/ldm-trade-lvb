import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { usePermissions } from '@/hooks/usePermissions';
import { useMaterials } from '@/hooks/useSupabaseData';
import {
  useOrcamento,
  useOrcamentoItens,
  useUpdateOrcamento,
  useAddOrcamentoItem,
  useUpdateOrcamentoItem,
  useDeleteOrcamentoItem,
} from '@/hooks/useOrcamentos';
import { FornecedorPicker } from '@/components/orcamentos/FornecedorPicker';
import { calcOrcamentoLinha, calcOrcamentoTotais } from '@/lib/orcamentoCalc';
import { formatBRL } from '@/lib/formatCurrency';
import type { OrcamentoItem } from '@/types/orcamento';

interface MaterialLite {
  id: string;
  descricao: string;
  bitola: string;
  unidade: string;
  erp?: string | null;
  notas?: string | null;
}

/** Ordenação de bitolas: "1 1/2" → 1.5, "3/4" → 0.75 (espelha BomTreeView). */
function parseBitolaValue(b: string): number {
  const trimmed = b.trim();
  const spaceParts = trimmed.split(' ');
  if (spaceParts.length === 2) {
    const whole = parseFloat(spaceParts[0]) || 0;
    const fracParts = spaceParts[1].split('/');
    const frac = fracParts.length === 2 ? (parseFloat(fracParts[0]) || 0) / (parseFloat(fracParts[1]) || 1) : 0;
    return whole + frac;
  }
  if (trimmed.includes('/')) {
    const fracParts = trimmed.split('/');
    return (parseFloat(fracParts[0]) || 0) / (parseFloat(fracParts[1]) || 1);
  }
  return parseFloat(trimmed) || 0;
}

const numClass = 'h-9 w-24 text-right';
const pctClass = 'h-9 w-20 text-right';

export default function OrcamentoDetailPage() {
  const { orcamentoId } = useParams();
  const navigate = useNavigate();
  const { canManageOrcamentos } = usePermissions();
  const readOnly = !canManageOrcamentos;

  const { data: orcamento, isLoading } = useOrcamento(orcamentoId);
  const { data: itens = [] } = useOrcamentoItens(orcamentoId);
  const { data: materials = [] } = useMaterials();
  const materialsLite = materials as MaterialLite[];

  const updateOrcamento = useUpdateOrcamento();

  // Estado do cabeçalho (sincronizado quando o orçamento carrega).
  const [fornecedorId, setFornecedorId] = useState<string | null>(null);
  const [data, setData] = useState('');
  const [notas, setNotas] = useState('');

  useEffect(() => {
    if (orcamento) {
      setFornecedorId(orcamento.fornecedor_id);
      setData(orcamento.data_orcamento ?? '');
      setNotas(orcamento.notas ?? '');
    }
  }, [orcamento]);

  const handleFornecedorChange = (id: string | null) => {
    setFornecedorId(id);
    if (!orcamentoId || !id || id === orcamento?.fornecedor_id) return;
    updateOrcamento.mutate(
      { id: orcamentoId, fornecedor_id: id },
      { onError: () => toast.error('Erro ao atualizar fornecedor') },
    );
  };

  const saveHeaderField = (fields: { data_orcamento?: string | null; notas?: string | null }) => {
    if (!orcamentoId) return;
    updateOrcamento.mutate(
      { id: orcamentoId, ...fields },
      { onError: () => toast.error('Erro ao salvar') },
    );
  };

  const totais = useMemo(
    () =>
      calcOrcamentoTotais(
        itens.map((i) => ({
          quantidade: Number(i.quantidade) || 0,
          precoUnitComImpostos: Number(i.preco_unit_com_impostos) || 0,
          icmsPct: Number(i.icms_pct) || 0,
          pisCofinsPct: Number(i.pis_cofins_pct) || 0,
          ipiPct: Number(i.ipi_pct) || 0,
        })),
      ),
    [itens],
  );

  const nextPosition = itens.length ? Math.max(...itens.map((i) => i.position)) + 1 : 0;

  if (isLoading) {
    return <div className="text-muted-foreground">Carregando…</div>;
  }
  if (!orcamento) {
    return (
      <div>
        <Button variant="ghost" onClick={() => navigate('/orcamentos')}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
        </Button>
        <p className="mt-4 text-muted-foreground">Orçamento não encontrado.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-2">
        <Button variant="ghost" size="icon" aria-label="Voltar" onClick={() => navigate('/orcamentos')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="text-sm text-muted-foreground">
          Orçamentos / {orcamento.fornecedores?.nome ?? '…'}
        </div>
      </div>

      <h1 className="text-2xl font-bold mb-6">Orçamento</h1>

      {/* Cabeçalho editável */}
      <Card className="mb-4">
        <CardHeader>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2 md:col-span-1">
              <Label>Fornecedor *</Label>
              <FornecedorPicker
                value={fornecedorId}
                onChange={handleFornecedorChange}
                disabled={readOnly}
                canCreate={!readOnly}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="orc-data">Data</Label>
              <Input
                id="orc-data"
                type="date"
                value={data}
                disabled={readOnly}
                onChange={(e) => setData(e.target.value)}
                onBlur={() => saveHeaderField({ data_orcamento: data || null })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="orc-notas">Observação</Label>
              <Textarea
                id="orc-notas"
                value={notas}
                disabled={readOnly}
                onChange={(e) => setNotas(e.target.value)}
                onBlur={() => saveHeaderField({ notas: notas.trim() || null })}
                placeholder="Opcional"
              />
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Itens */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs font-normal text-muted-foreground">
                  <th className="py-2 px-2 font-normal w-10">#</th>
                  <th className="py-2 px-2 font-normal min-w-[220px]">Descrição</th>
                  <th className="py-2 px-2 font-normal min-w-[140px]">Bitola</th>
                  <th className="py-2 px-2 font-normal">ERP</th>
                  <th className="py-2 px-2 font-normal text-right">Qtd</th>
                  <th className="py-2 px-2 font-normal">Un.</th>
                  <th className="py-2 px-2 font-normal text-right">Preço unit. c/ imp.</th>
                  <th className="py-2 px-2 font-normal text-right">ICMS %</th>
                  <th className="py-2 px-2 font-normal text-right">PIS/COFINS %</th>
                  <th className="py-2 px-2 font-normal text-right">IPI %</th>
                  <th className="py-2 px-2 font-normal text-right">Líquido unit.</th>
                  <th className="py-2 px-2 font-normal text-right">Total líquido</th>
                  <th className="py-2 px-2 font-normal text-right">Total c/ imp.</th>
                  <th className="py-2 px-2 font-normal min-w-[160px]">Notas</th>
                  {!readOnly && <th className="py-2 px-2 font-normal w-1" />}
                </tr>
              </thead>
              <tbody>
                {itens.length === 0 && (
                  <tr>
                    <td colSpan={readOnly ? 14 : 15} className="text-center text-muted-foreground py-8">
                      Nenhum item. {readOnly ? '' : 'Adicione itens abaixo.'}
                    </td>
                  </tr>
                )}
                {itens.map((item, idx) => (
                  <ItemRow
                    key={item.id}
                    index={idx}
                    item={item}
                    materials={materialsLite}
                    readOnly={readOnly}
                  />
                ))}
                {!readOnly && orcamentoId && (
                  <DraftRow
                    index={itens.length}
                    orcamentoId={orcamentoId}
                    position={nextPosition}
                    materials={materialsLite}
                  />
                )}
              </tbody>
              <tfoot>
                <tr className="border-t font-medium">
                  <td colSpan={10} className="py-3 px-2 text-right text-muted-foreground">
                    Totais
                  </td>
                  <td className="py-3 px-2 text-right text-muted-foreground">
                    Impostos: {formatBRL(totais.totalImpostos)}
                  </td>
                  <td className="py-3 px-2 text-right">{formatBRL(totais.totalLiquido)}</td>
                  <td className="py-3 px-2 text-right">{formatBRL(totais.totalComImpostos)}</td>
                  <td colSpan={readOnly ? 1 : 2} />
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------- linha existente

function ItemRow({
  index,
  item,
  materials,
  readOnly,
}: {
  index: number;
  item: OrcamentoItem;
  materials: MaterialLite[];
  readOnly: boolean;
}) {
  const updateItem = useUpdateOrcamentoItem();
  const deleteItem = useDeleteOrcamentoItem();

  const material = useMemo(
    () => materials.find((m) => m.id === item.material_id) ?? null,
    [materials, item.material_id],
  );

  const [descricao, setDescricao] = useState(material?.descricao ?? '');
  const [bitola, setBitola] = useState(material?.bitola ?? '');
  const [materialId, setMaterialId] = useState<string | null>(item.material_id);
  const [quantidade, setQuantidade] = useState(String(item.quantidade));
  const [precoCom, setPrecoCom] = useState(String(item.preco_unit_com_impostos));
  const [icms, setIcms] = useState(String(item.icms_pct));
  const [pisCofins, setPisCofins] = useState(String(item.pis_cofins_pct));
  const [ipi, setIpi] = useState(String(item.ipi_pct));
  const [notas, setNotas] = useState(item.notas ?? '');

  // Ressincroniza quando o material vinculado é resolvido após carregar materiais.
  useEffect(() => {
    if (material) {
      setDescricao(material.descricao);
      setBitola(material.bitola);
    }
  }, [material]);

  const descriptions = useMemo(
    () => [...new Set(materials.map((m) => m.descricao))].sort(),
    [materials],
  );
  const bitolas = useMemo(() => {
    if (!descricao) return [] as string[];
    const set = new Set(materials.filter((m) => m.descricao === descricao).map((m) => m.bitola));
    return [...set].sort((a, b) => parseBitolaValue(a) - parseBitolaValue(b));
  }, [materials, descricao]);

  const currentMaterial = useMemo(
    () => materials.find((m) => m.id === materialId) ?? null,
    [materials, materialId],
  );

  const calc = calcOrcamentoLinha({
    quantidade: Number(quantidade) || 0,
    precoUnitComImpostos: Number(precoCom) || 0,
    icmsPct: Number(icms) || 0,
    pisCofinsPct: Number(pisCofins) || 0,
    ipiPct: Number(ipi) || 0,
  });

  type ItemPatch = {
    material_id?: string | null;
    quantidade?: number;
    preco_unit_com_impostos?: number;
    icms_pct?: number;
    pis_cofins_pct?: number;
    ipi_pct?: number;
    notas?: string | null;
  };
  const persist = (fields: ItemPatch) => {
    updateItem.mutate(
      { id: item.id, orcamento_id: item.orcamento_id, ...fields },
      { onError: () => toast.error('Erro ao salvar item') },
    );
  };

  const handleDescChange = (v: string) => {
    setDescricao(v);
    setBitola('');
    setMaterialId(null);
  };
  const handleBitolaChange = (v: string) => {
    setBitola(v);
    const mat = materials.find((m) => m.descricao === descricao && m.bitola === v);
    setMaterialId(mat?.id ?? null);
    if (mat) persist({ material_id: mat.id });
  };

  const saveNum = (
    field: 'quantidade' | 'preco_unit_com_impostos' | 'icms_pct' | 'pis_cofins_pct' | 'ipi_pct',
    raw: string,
  ) => {
    const value = Number(raw);
    persist({ [field]: Number.isFinite(value) ? value : 0 } as ItemPatch);
  };

  return (
    <tr className="border-b align-top">
      <td className="py-2 px-2 text-muted-foreground">{index + 1}</td>
      <td className="py-2 px-2">
        {readOnly ? (
          descricao || '—'
        ) : (
          <SearchableSelect
            options={descriptions}
            value={descricao}
            onValueChange={handleDescChange}
            placeholder="Selecione"
            searchPlaceholder="Buscar material..."
            emptyMessage="Nenhum material encontrado."
          />
        )}
      </td>
      <td className="py-2 px-2">
        {readOnly ? (
          bitola || '—'
        ) : (
          <SearchableSelect
            options={bitolas}
            value={bitola}
            onValueChange={handleBitolaChange}
            disabled={!descricao}
            placeholder="Bitola"
            searchPlaceholder="Buscar bitola..."
            emptyMessage="Nenhuma bitola encontrada."
          />
        )}
      </td>
      <td className="py-2 px-2 text-muted-foreground">{currentMaterial?.erp || '—'}</td>
      <td className="py-2 px-2 text-right">
        {readOnly ? (
          quantidade
        ) : (
          <Input
            type="number"
            min={0}
            step="any"
            className={numClass}
            value={quantidade}
            onChange={(e) => setQuantidade(e.target.value)}
            onBlur={(e) => saveNum('quantidade', e.target.value)}
          />
        )}
      </td>
      <td className="py-2 px-2 text-muted-foreground">{currentMaterial?.unidade || '—'}</td>
      <td className="py-2 px-2 text-right">
        {readOnly ? (
          formatBRL(Number(precoCom) || 0)
        ) : (
          <Input
            type="number"
            min={0}
            step="any"
            className={numClass}
            value={precoCom}
            onChange={(e) => setPrecoCom(e.target.value)}
            onBlur={(e) => saveNum('preco_unit_com_impostos', e.target.value)}
          />
        )}
      </td>
      <td className="py-2 px-2 text-right">
        {readOnly ? (
          icms
        ) : (
          <Input
            type="number"
            min={0}
            max={100}
            step="any"
            className={pctClass}
            value={icms}
            onChange={(e) => setIcms(e.target.value)}
            onBlur={(e) => saveNum('icms_pct', e.target.value)}
          />
        )}
      </td>
      <td className="py-2 px-2 text-right">
        {readOnly ? (
          pisCofins
        ) : (
          <Input
            type="number"
            min={0}
            max={100}
            step="any"
            className={pctClass}
            value={pisCofins}
            onChange={(e) => setPisCofins(e.target.value)}
            onBlur={(e) => saveNum('pis_cofins_pct', e.target.value)}
          />
        )}
      </td>
      <td className="py-2 px-2 text-right">
        {readOnly ? (
          ipi
        ) : (
          <Input
            type="number"
            min={0}
            max={100}
            step="any"
            className={pctClass}
            value={ipi}
            onChange={(e) => setIpi(e.target.value)}
            onBlur={(e) => saveNum('ipi_pct', e.target.value)}
          />
        )}
      </td>
      <td className="py-2 px-2 text-right">
        <span className={calc.excedeImpostos ? 'text-destructive inline-flex items-center gap-1' : ''}>
          {calc.excedeImpostos && <AlertTriangle className="h-3.5 w-3.5" />}
          {formatBRL(calc.precoUnitLiquido)}
        </span>
      </td>
      <td className="py-2 px-2 text-right">{formatBRL(calc.totalLiquido)}</td>
      <td className="py-2 px-2 text-right">{formatBRL(calc.totalComImpostos)}</td>
      <td className="py-2 px-2">
        {readOnly ? (
          notas || '—'
        ) : (
          <Input
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            onBlur={() => persist({ notas: notas.trim() || null })}
            placeholder="Observações"
            className="h-9"
          />
        )}
      </td>
      {!readOnly && (
        <td className="py-2 px-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            title="Remover"
            onClick={() =>
              deleteItem.mutate(
                { id: item.id, orcamento_id: item.orcamento_id },
                {
                  onSuccess: () => toast.success('Item removido'),
                  onError: () => toast.error('Erro ao remover'),
                },
              )
            }
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </td>
      )}
    </tr>
  );
}

// -------------------------------------------------------------------- linha nova

function DraftRow({
  index,
  orcamentoId,
  position,
  materials,
}: {
  index: number;
  orcamentoId: string;
  position: number;
  materials: MaterialLite[];
}) {
  const add = useAddOrcamentoItem();

  const [descricao, setDescricao] = useState('');
  const [bitola, setBitola] = useState('');
  const [materialId, setMaterialId] = useState<string | null>(null);
  const [quantidade, setQuantidade] = useState('1');
  const [precoCom, setPrecoCom] = useState('0');
  const [icms, setIcms] = useState('0');
  const [pisCofins, setPisCofins] = useState('0');
  const [ipi, setIpi] = useState('0');
  const [notas, setNotas] = useState('');

  const descriptions = useMemo(
    () => [...new Set(materials.map((m) => m.descricao))].sort(),
    [materials],
  );
  const bitolas = useMemo(() => {
    if (!descricao) return [] as string[];
    const set = new Set(materials.filter((m) => m.descricao === descricao).map((m) => m.bitola));
    return [...set].sort((a, b) => parseBitolaValue(a) - parseBitolaValue(b));
  }, [materials, descricao]);

  const currentMaterial = useMemo(
    () => materials.find((m) => m.id === materialId) ?? null,
    [materials, materialId],
  );

  const calc = calcOrcamentoLinha({
    quantidade: Number(quantidade) || 0,
    precoUnitComImpostos: Number(precoCom) || 0,
    icmsPct: Number(icms) || 0,
    pisCofinsPct: Number(pisCofins) || 0,
    ipiPct: Number(ipi) || 0,
  });

  const handleDescChange = (v: string) => {
    setDescricao(v);
    setBitola('');
    setMaterialId(null);
  };
  const handleBitolaChange = (v: string) => {
    setBitola(v);
    const mat = materials.find((m) => m.descricao === descricao && m.bitola === v);
    setMaterialId(mat?.id ?? null);
    if (mat?.notas) setNotas(mat.notas);
  };

  const reset = () => {
    setDescricao('');
    setBitola('');
    setMaterialId(null);
    setQuantidade('1');
    setPrecoCom('0');
    setIcms('0');
    setPisCofins('0');
    setIpi('0');
    setNotas('');
  };

  const persist = async () => {
    if (!materialId) {
      toast.error('Selecione descrição e bitola');
      return;
    }
    const qtd = Number(quantidade);
    if (!Number.isFinite(qtd) || qtd < 0) {
      toast.error('Quantidade inválida');
      return;
    }
    try {
      await add.mutateAsync({
        orcamento_id: orcamentoId,
        material_id: materialId,
        quantidade: qtd,
        preco_unit_com_impostos: Number(precoCom) || 0,
        icms_pct: Number(icms) || 0,
        pis_cofins_pct: Number(pisCofins) || 0,
        ipi_pct: Number(ipi) || 0,
        notas: notas.trim() || null,
        position,
      });
      toast.success('Item adicionado');
      reset();
    } catch {
      toast.error('Erro ao adicionar item');
    }
  };

  return (
    <tr className="border-b bg-muted/20 align-top">
      <td className="py-2 px-2 text-muted-foreground">{index + 1}</td>
      <td className="py-2 px-2">
        <SearchableSelect
          options={descriptions}
          value={descricao}
          onValueChange={handleDescChange}
          placeholder="Selecione"
          searchPlaceholder="Buscar material..."
          emptyMessage="Nenhum material encontrado."
        />
      </td>
      <td className="py-2 px-2">
        <SearchableSelect
          options={bitolas}
          value={bitola}
          onValueChange={handleBitolaChange}
          disabled={!descricao}
          placeholder="Bitola"
          searchPlaceholder="Buscar bitola..."
          emptyMessage="Nenhuma bitola encontrada."
        />
      </td>
      <td className="py-2 px-2 text-muted-foreground">{currentMaterial?.erp || '—'}</td>
      <td className="py-2 px-2 text-right">
        <Input type="number" min={0} step="any" className={numClass} value={quantidade} onChange={(e) => setQuantidade(e.target.value)} />
      </td>
      <td className="py-2 px-2 text-muted-foreground">{currentMaterial?.unidade || '—'}</td>
      <td className="py-2 px-2 text-right">
        <Input type="number" min={0} step="any" className={numClass} value={precoCom} onChange={(e) => setPrecoCom(e.target.value)} />
      </td>
      <td className="py-2 px-2 text-right">
        <Input type="number" min={0} max={100} step="any" className={pctClass} value={icms} onChange={(e) => setIcms(e.target.value)} />
      </td>
      <td className="py-2 px-2 text-right">
        <Input type="number" min={0} max={100} step="any" className={pctClass} value={pisCofins} onChange={(e) => setPisCofins(e.target.value)} />
      </td>
      <td className="py-2 px-2 text-right">
        <Input type="number" min={0} max={100} step="any" className={pctClass} value={ipi} onChange={(e) => setIpi(e.target.value)} />
      </td>
      <td className="py-2 px-2 text-right">
        <span className={calc.excedeImpostos ? 'text-destructive inline-flex items-center gap-1' : ''}>
          {calc.excedeImpostos && <AlertTriangle className="h-3.5 w-3.5" />}
          {formatBRL(calc.precoUnitLiquido)}
        </span>
      </td>
      <td className="py-2 px-2 text-right">{formatBRL(calc.totalLiquido)}</td>
      <td className="py-2 px-2 text-right">{formatBRL(calc.totalComImpostos)}</td>
      <td className="py-2 px-2">
        <Input value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Observações" className="h-9" />
      </td>
      <td className="py-2 px-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          title="Adicionar item"
          onClick={persist}
          disabled={add.isPending}
        >
          <Plus className="h-4 w-4 text-primary" />
        </Button>
      </td>
    </tr>
  );
}
