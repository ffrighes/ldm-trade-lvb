import * as React from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { normalizeForSearch } from "@/lib/normalizeSearch";
import { highlightMatch } from "@/lib/highlight";
import { Button } from "@/components/ui/button";
import { Command, CommandGroup, CommandItem, CommandInput, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface FamilyComboboxProps {
  value: string;
  onValueChange: (value: string) => void;
  families: string[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  id?: string;
  disabled?: boolean;
  className?: string;
  onBlur?: () => void;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
}

/**
 * Combobox creatable para a "Descrição (Família)" da base de materiais.
 * Filtra as famílias existentes de forma accent-insensitive e só cria uma
 * família nova quando o usuário seleciona explicitamente o item
 * "Criar família: ..." — nunca como efeito colateral da digitação.
 */
export const FamilyCombobox = React.forwardRef<HTMLButtonElement, FamilyComboboxProps>(
  (
    {
      value,
      onValueChange,
      families,
      placeholder = "Selecione ou digite uma família...",
      searchPlaceholder = "Buscar família...",
      emptyMessage = "Nenhuma família encontrada.",
      id,
      disabled = false,
      className,
      onBlur,
      ...ariaProps
    },
    ref,
  ) => {
    const [open, setOpen] = React.useState(false);
    const [search, setSearch] = React.useState("");

    const trimmedSearch = search.trim();

    const filtered = React.useMemo(() => {
      if (!trimmedSearch) return families;
      const needle = normalizeForSearch(trimmedSearch);
      return families.filter((f) => normalizeForSearch(f).includes(needle));
    }, [families, trimmedSearch]);

    const exactMatch = families.some((f) => normalizeForSearch(f) === normalizeForSearch(trimmedSearch));

    const handleSelect = (v: string) => {
      onValueChange(v);
      setSearch("");
      setOpen(false);
    };

    return (
      <Popover
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          setSearch("");
          if (!o) onBlur?.();
        }}
      >
        <PopoverTrigger asChild>
          <Button
            ref={ref}
            id={id}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className={cn("w-full justify-between font-normal", !value && "text-muted-foreground", className)}
            {...ariaProps}
          >
            <span className="truncate">{value || placeholder}</span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="p-0" style={{ width: "var(--radix-popover-trigger-width)" }} align="start">
          <Command shouldFilter={false}>
            <CommandInput placeholder={searchPlaceholder} value={search} onValueChange={setSearch} />
            <CommandList>
              {filtered.length === 0 && !trimmedSearch && (
                <div className="py-6 text-center text-sm text-muted-foreground">{emptyMessage}</div>
              )}
              {filtered.length > 0 && (
                <CommandGroup>
                  {filtered.map((f) => (
                    <CommandItem key={f} value={f} onSelect={() => handleSelect(f)}>
                      <Check className={cn("mr-2 h-4 w-4", value === f ? "opacity-100" : "opacity-0")} />
                      {highlightMatch(f, trimmedSearch)}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              {trimmedSearch && !exactMatch && (
                <CommandGroup>
                  <CommandItem value={`__create__${trimmedSearch}`} onSelect={() => handleSelect(trimmedSearch)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Criar família: "{trimmedSearch}"
                  </CommandItem>
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    );
  },
);
FamilyCombobox.displayName = "FamilyCombobox";
