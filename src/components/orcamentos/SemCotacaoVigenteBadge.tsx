import { Badge } from '@/components/ui/badge';
import { AlertTriangle } from 'lucide-react';

export function SemCotacaoVigenteBadge() {
  return (
    <Badge variant="destructive" className="gap-1 text-[10px] px-1.5 py-0">
      <AlertTriangle className="h-2.5 w-2.5" />
      Sem cotação
    </Badge>
  );
}
