import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar as CalendarIcon, X } from 'lucide-react';
import type { DateRange } from 'react-day-picker';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface Props {
  from: string;
  to: string;
  onChange: (range: { from: string; to: string }) => void;
}

const toIsoDate = (d: Date) => format(d, 'yyyy-MM-dd');

export function DateRangeFilter({ from, to, onChange }: Props) {
  const range: DateRange | undefined =
    from || to
      ? { from: from ? parseISO(from) : undefined, to: to ? parseISO(to) : undefined }
      : undefined;

  const label = (() => {
    if (from && to) {
      return `${format(parseISO(from), 'dd/MM/yyyy', { locale: ptBR })} – ${format(parseISO(to), 'dd/MM/yyyy', { locale: ptBR })}`;
    }
    if (from) return `A partir de ${format(parseISO(from), 'dd/MM/yyyy', { locale: ptBR })}`;
    if (to) return `Até ${format(parseISO(to), 'dd/MM/yyyy', { locale: ptBR })}`;
    return 'Período';
  })();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full sm:w-64 justify-start text-left font-normal" aria-label="Filtrar por período">
          <CalendarIcon className="h-4 w-4 mr-2" />
          <span className="flex-1 truncate">{label}</span>
          {(from || to) && (
            <X
              className="h-4 w-4 opacity-60 hover:opacity-100"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onChange({ from: '', to: '' });
              }}
              aria-label="Limpar período"
            />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="range"
          numberOfMonths={2}
          locale={ptBR}
          selected={range}
          onSelect={(r) => {
            onChange({
              from: r?.from ? toIsoDate(r.from) : '',
              to: r?.to ? toIsoDate(r.to) : '',
            });
          }}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}
