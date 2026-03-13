import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";

interface ProductSearchBarProps {
  value: string;
  onChange: (value: string) => void;
}

export function ProductSearchBar({ value, onChange }: ProductSearchBarProps) {
  return (
    <div className="relative max-w-md mb-6">
      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        placeholder="Buscar produto..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="pl-10 pr-9 h-11 rounded-full border-muted-foreground/20 focus-visible:ring-primary/30"
      />
      {value && (
        <button
          onClick={() => onChange("")}
          className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Limpar busca"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
