import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, ChevronLeft, FileSpreadsheet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useProjects } from '@/hooks/useSupabaseData';
import { useBomRoots, useBomVersions } from '@/hooks/useBomTree';
import { useCreateOrcamento, useCopyBomToOrcamento } from '@/hooks/useOrcamentos';

type Step = 1 | 2 | 3;

export default function OrcamentoNovoPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [step, setStep] = useState<Step>(1);

  // Step 1
  const [projetoId, setProjetoId] = useState('');
  // Step 2
  const [bomRootId, setBomRootId] = useState('');
  const [bomVersionId, setBomVersionId] = useState('');
  // Step 3
  const [nome, setNome] = useState('');
  const [notas, setNotas] = useState('');

  const { data: projects = [] } = useProjects();
  const { data: bomRoots = [] } = useBomRoots(projetoId || undefined);
  const { data: bomVersions = [] } = useBomVersions(bomRootId || undefined);

  const createOrcamento = useCreateOrcamento();
  const copyBom = useCopyBomToOrcamento();

  const selectedRoot = bomRoots.find((r) => r.id === bomRootId);
  const selectedVersion = bomVersions.find((v) => v.id === bomVersionId);

  const handleSubmit = async () => {
    if (!nome.trim() || !projetoId) return;

    try {
      const orc = await createOrcamento.mutateAsync({
        projeto_id: projetoId,
        nome: nome.trim(),
        notas: notas.trim(),
        origem_bom_root_codigo: selectedRoot?.codigo ?? null,
        origem_bom_version_label: selectedVersion?.label ?? (selectedVersion ? `v${selectedVersion.version_number}` : null),
        origem_data_copia: bomVersionId ? new Date().toISOString() : null,
      });

      if (bomVersionId) {
        try {
          const count = await copyBom.mutateAsync({ bomVersionId, orcamentoId: orc.id });
          toast({ title: `Orçamento criado com ${count} itens copiados da BOM` });
        } catch {
          toast({ title: 'Orçamento criado, mas falha ao copiar BOM', variant: 'destructive' });
        }
      } else {
        toast({ title: 'Orçamento criado' });
      }

      navigate(`/orcamentos/${orc.id}`);
    } catch (err) {
      toast({
        title: 'Erro ao criar orçamento',
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      });
    }
  };

  const isSubmitting = createOrcamento.isPending || copyBom.isPending;

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <FileSpreadsheet className="h-6 w-6" />
          Novo orçamento
        </h1>
        <p className="text-muted-foreground text-sm mt-0.5">Passo {step} de 3</p>
      </div>

      {/* Progress */}
      <div className="flex gap-1">
        {([1, 2, 3] as Step[]).map((s) => (
          <div
            key={s}
            className={`flex-1 h-1 rounded-full ${s <= step ? 'bg-primary' : 'bg-muted'}`}
          />
        ))}
      </div>

      {/* Step 1 — Projeto */}
      {step === 1 && (
        <div className="space-y-4">
          <h2 className="font-semibold">Selecione o projeto</h2>
          <div className="space-y-2">
            <Label>Projeto *</Label>
            <Select value={projetoId} onValueChange={setProjetoId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecionar projeto..." />
              </SelectTrigger>
              <SelectContent>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.numero} — {p.descricao}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end">
            <Button onClick={() => setStep(2)} disabled={!projetoId}>
              Próximo <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 2 — BOM (opcional) */}
      {step === 2 && (
        <div className="space-y-4">
          <h2 className="font-semibold">Origem da BOM (opcional)</h2>
          <p className="text-sm text-muted-foreground">
            Selecione uma BOM para copiar os itens automaticamente. Você também pode criar o orçamento vazio e adicionar itens manualmente.
          </p>
          <div className="space-y-2">
            <Label>BOM root</Label>
            <Select value={bomRootId} onValueChange={(v) => { setBomRootId(v); setBomVersionId(''); }}>
              <SelectTrigger>
                <SelectValue placeholder="Nenhuma (criar vazio)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Nenhuma (criar vazio)</SelectItem>
                {bomRoots.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.codigo} — {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {bomRootId && (
            <div className="space-y-2">
              <Label>Versão</Label>
              <Select value={bomVersionId} onValueChange={setBomVersionId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar versão..." />
                </SelectTrigger>
                <SelectContent>
                  {bomVersions.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      v{v.version_number}{v.label ? ` — ${v.label}` : ''} ({v.status})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(1)}>
              <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
            </Button>
            <Button onClick={() => setStep(3)}>
              Próximo <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 3 — Nome e notas */}
      {step === 3 && (
        <div className="space-y-4">
          <h2 className="font-semibold">Detalhes do orçamento</h2>
          <div className="space-y-2">
            <Label>Nome *</Label>
            <Input
              placeholder="Ex: Orçamento válvulas projeto X"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Notas</Label>
            <Textarea
              placeholder="Observações opcionais..."
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              rows={3}
            />
          </div>

          {/* Resumo */}
          <div className="bg-muted/40 rounded-md p-3 text-sm space-y-1">
            <p>
              <span className="font-medium">Projeto:</span>{' '}
              {projects.find((p) => p.id === projetoId)?.numero}
            </p>
            <p>
              <span className="font-medium">BOM:</span>{' '}
              {selectedRoot
                ? `${selectedRoot.codigo} — ${selectedRoot.name}${selectedVersion ? ` v${selectedVersion.version_number}` : ''}`
                : 'Nenhuma (orçamento vazio)'}
            </p>
          </div>

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(2)}>
              <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
            </Button>
            <Button onClick={handleSubmit} disabled={!nome.trim() || isSubmitting}>
              {isSubmitting ? 'Criando...' : 'Criar orçamento'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
