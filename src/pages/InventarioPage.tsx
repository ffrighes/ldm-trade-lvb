import { useState, useMemo } from 'react';
import { useProjects } from '@/hooks/useSupabaseData';
import { useInventario } from '@/hooks/useInventario';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Package, ChevronDown, ChevronRight } from 'lucide-react';
import { formatBRL } from '@/lib/formatCurrency';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface InventarioItem {
  id: string;
  descricao: string;
  bitola: string;
  quantidade: number;
  unidade: string;
  custo_unitario: number;
  custo_total: number;
  solicitacao_numero: string;
  solicitacao_id: string;
}

interface GroupedItem {
  descricao: string;
  bitola: string;
  unidade: string;
  totalQuantidade: number;
  totalCusto: number;
  origens: { solicitacao_numero: string; quantidade: number; custo_unitario: number; custo_total: number }[];
}

export default function InventarioPage() {
  const { data: projects } = useProjects();
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const { data: inventario, isLoading } = useInventario(selectedProjectId);
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());

  const selectedProject = projects?.find(p => p.id === selectedProjectId);

  const grouped = useMemo(() => {
    if (!inventario) return [];
    const map = new Map<string, GroupedItem>();
    for (const item of inventario as InventarioItem[]) {
      const key = `${item.descricao}||${item.bitola}||${item.unidade}`;
      const existing = map.get(key);
      if (existing) {
        existing.totalQuantidade += Number(item.quantidade);
        existing.totalCusto += Number(item.custo_total);
        existing.origens.push({
          solicitacao_numero: item.solicitacao_numero,
          quantidade: Number(item.quantidade),
          custo_unitario: Number(item.custo_unitario),
          custo_total: Number(item.custo_total),
        });
      } else {
        map.set(key, {
          descricao: item.descricao,
          bitola: item.bitola,
          unidade: item.unidade,
          totalQuantidade: Number(item.quantidade),
          totalCusto: Number(item.custo_total),
          origens: [{
            solicitacao_numero: item.solicitacao_numero,
            quantidade: Number(item.quantidade),
            custo_unitario: Number(item.custo_unitario),
            custo_total: Number(item.custo_total),
          }],
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.descricao.localeCompare(b.descricao));
  }, [inventario]);

  const totalItems = grouped.length;
  const totalCost = grouped.reduce((sum, g) => sum + g.totalCusto, 0);

  const toggleGroup = (key: string) => {
    setOpenGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Gestão de Inventário</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Inventário de materiais por projeto — itens compilados por descrição.
        </p>
      </div>

      <div className="flex items-center gap-4">
        <div className="w-80">
          <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione um projeto" />
            </SelectTrigger>
            <SelectContent>
              {projects?.map(p => (
                <SelectItem key={p.id} value={p.id}>
                  {p.numero} — {p.descricao}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {selectedProjectId && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Projeto</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-lg font-semibold">{selectedProject?.numero}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Materiais Distintos</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-lg font-semibold">{totalItems}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Custo Total</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-lg font-semibold">{formatBRL(totalCost)}</p>
              </CardContent>
            </Card>
          </div>

          {isLoading ? (
            <p className="text-muted-foreground text-sm">Carregando inventário...</p>
          ) : totalItems === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Package className="h-12 w-12 mb-3 opacity-40" />
              <p className="text-sm">Nenhum item no inventário deste projeto.</p>
              <p className="text-xs mt-1">Itens serão adicionados ao finalizar solicitações.</p>
            </div>
          ) : (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8"></TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Bitola</TableHead>
                      <TableHead className="text-right">Qtd Total</TableHead>
                      <TableHead>Unidade</TableHead>
                      <TableHead className="text-right">Custo Total</TableHead>
                      <TableHead>Solicitações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {grouped.map(group => {
                      const key = `${group.descricao}||${group.bitola}||${group.unidade}`;
                      const isOpen = openGroups.has(key);
                      const hasMultiple = group.origens.length > 1;

                      return (
                        <Collapsible key={key} open={isOpen} onOpenChange={() => toggleGroup(key)} asChild>
                          <>
                            <CollapsibleTrigger asChild>
                              <TableRow className={hasMultiple ? 'cursor-pointer hover:bg-muted/50' : ''}>
                                <TableCell className="w-8 px-2">
                                  {hasMultiple && (
                                    isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                  )}
                                </TableCell>
                                <TableCell className="font-medium">{group.descricao}</TableCell>
                                <TableCell>{group.bitola}</TableCell>
                                <TableCell className="text-right font-semibold">{group.totalQuantidade}</TableCell>
                                <TableCell>{group.unidade}</TableCell>
                                <TableCell className="text-right font-semibold">{formatBRL(group.totalCusto)}</TableCell>
                                <TableCell>
                                  <div className="flex flex-wrap gap-1">
                                    {group.origens.map((o, i) => (
                                      <Badge key={i} variant="outline" className="text-xs">{o.solicitacao_numero}</Badge>
                                    ))}
                                  </div>
                                </TableCell>
                              </TableRow>
                            </CollapsibleTrigger>
                            <CollapsibleContent asChild>
                              <>
                                {isOpen && group.origens.map((o, i) => (
                                  <TableRow key={i} className="bg-muted/30">
                                    <TableCell></TableCell>
                                    <TableCell className="pl-8 text-muted-foreground text-sm">↳ {o.solicitacao_numero}</TableCell>
                                    <TableCell></TableCell>
                                    <TableCell className="text-right text-sm">{o.quantidade}</TableCell>
                                    <TableCell></TableCell>
                                    <TableCell className="text-right text-sm">{formatBRL(o.custo_total)}</TableCell>
                                    <TableCell>
                                      <Badge variant="secondary" className="text-xs">{o.solicitacao_numero}</Badge>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </>
                            </CollapsibleContent>
                          </>
                        </Collapsible>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
