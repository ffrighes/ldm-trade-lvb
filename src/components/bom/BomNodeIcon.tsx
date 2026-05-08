import { Boxes, Package, Wrench } from 'lucide-react';
import type { BomNodeType } from '@/types/bom';

export function BomNodeIcon({ type, className }: { type: BomNodeType; className?: string }) {
  if (type === 'CONJUNTO') return <Boxes className={className ?? 'h-4 w-4 text-primary'} />;
  if (type === 'SUBCONJUNTO') return <Wrench className={className ?? 'h-4 w-4 text-info'} />;
  return <Package className={className ?? 'h-4 w-4 text-muted-foreground'} />;
}

export function bomNodeTypeLabel(type: BomNodeType): string {
  if (type === 'CONJUNTO') return 'Conjunto';
  if (type === 'SUBCONJUNTO') return 'Subconjunto';
  return 'Item';
}
