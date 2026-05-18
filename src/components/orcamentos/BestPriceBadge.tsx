import { Badge } from '@/components/ui/badge';
import { Trophy } from 'lucide-react';

export function BestPriceBadge() {
  return (
    <Badge variant="default" className="bg-emerald-600 hover:bg-emerald-600 text-white gap-1 text-[10px] px-1.5 py-0">
      <Trophy className="h-2.5 w-2.5" />
      Melhor preço
    </Badge>
  );
}
