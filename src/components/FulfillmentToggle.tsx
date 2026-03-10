import { cn } from "@/lib/utils";
import { Truck, Store } from "lucide-react";

interface FulfillmentToggleProps {
  value: "delivery" | "pickup";
  onChange: (value: "delivery" | "pickup") => void;
  className?: string;
}

export function FulfillmentToggle({ value, onChange, className }: FulfillmentToggleProps) {
  return (
    <div className={cn("flex gap-2", className)}>
      <button
        type="button"
        onClick={() => onChange("delivery")}
        className={cn(
          "flex-1 flex items-center justify-center gap-2 rounded-lg border-2 px-4 py-3 text-sm font-medium transition-all",
          value === "delivery"
            ? "border-[#033D7B] bg-[#033D7B]/10 text-[#033D7B]"
            : "border-border bg-background text-muted-foreground hover:border-muted-foreground/50"
        )}
      >
        <Truck className="h-4 w-4" /> Entrega
      </button>
      <button
        type="button"
        onClick={() => onChange("pickup")}
        className={cn(
          "flex-1 flex items-center justify-center gap-2 rounded-lg border-2 px-4 py-3 text-sm font-medium transition-all",
          value === "pickup"
            ? "border-muted-foreground bg-muted text-foreground"
            : "border-border bg-background text-muted-foreground hover:border-muted-foreground/50"
        )}
      >
        <Store className="h-4 w-4" /> Retirada na loja
      </button>
    </div>
  );
}
