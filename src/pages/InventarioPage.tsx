import { useState } from 'react';
import { useProjects } from '@/hooks/useSupabaseData';
import { useInventario } from '@/hooks/useInventario';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Package } from 'lucide-react';
import { formatBRL } from '@/lib/formatCurrency';

export default function InventarioPage() {
  const { data: projects } = useProjects();
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const { data: inventario, isLoading } = useInventario(selectedProjectId);

  const selectedProject = projects?.find(p => p.id === selectedProjectId);

  const totalItems = inventario?.length ?? 0;
  const totalCost = inventario?.reduce((sum, i) => sum + Number(i.custo_total), 0) ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Gestão de Inventário</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Inventário de materiais por projeto — itens são transferidos automaticamente ao finalizar solicitações.
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
                <CardTitle className="text-sm font-medium text-muted-foreground">Total de Itens</CardTitle>
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
                <p className="text-lg font-semibold">{formatCurrency(totalCost)}</p>
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
                      <TableHead>Descrição</TableHead>
                      <TableHead>Bitola</TableHead>
                      <TableHead className="text-right">Qtd</TableHead>
                      <TableHead>Unidade</TableHead>
                      <TableHead className="text-right">Custo Unit.</TableHead>
                      <TableHead className="text-right">Custo Total</TableHead>
                      <TableHead>Solicitação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {inventario?.map(item => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.descricao}</TableCell>
                        <TableCell>{item.bitola}</TableCell>
                        <TableCell className="text-right">{Number(item.quantidade)}</TableCell>
                        <TableCell>{item.unidade}</TableCell>
                        <TableCell className="text-right">{formatCurrency(Number(item.custo_unitario))}</TableCell>
                        <TableCell className="text-right">{formatCurrency(Number(item.custo_total))}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{item.solicitacao_numero}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
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
