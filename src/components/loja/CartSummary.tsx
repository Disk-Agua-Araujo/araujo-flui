import { Trash2, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCart } from "@/contexts/CartContext";

interface CartSummaryProps {
  onCheckout: () => void;
  variant?: "sidebar" | "drawer";
}

export function CartSummary({ onCheckout, variant = "sidebar" }: CartSummaryProps) {
  const { items, updateQty, removeItem, totalItems } = useCart();

  if (items.length === 0) {
    return (
      <div className="text-center py-12 px-4">
        <ShoppingBag className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
        <p className="text-muted-foreground text-sm">Seu carrinho está vazio.</p>
        <p className="text-xs text-muted-foreground/70 mt-1">Adicione produtos para continuar.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b bg-muted/30">
        <h3 className="font-bold text-sm text-foreground">Seu pedido</h3>
        <p className="text-xs text-muted-foreground">{totalItems} {totalItems === 1 ? "item" : "itens"}</p>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {items.map((item) => (
          <div key={item.product.id} className="flex items-start gap-2 pb-3 border-b last:border-0">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground line-clamp-2">{item.product.name}</p>
              <p className="text-xs text-primary font-semibold mt-0.5">{item.product.priceText}</p>
              <div className="flex items-center gap-1 mt-2">
                <Button size="icon" variant="outline" className="h-6 w-6" onClick={() => updateQty(item.product.id, item.qty - 1)}>
                  <span className="text-xs">−</span>
                </Button>
                <span className="text-xs w-6 text-center font-semibold">{item.qty}</span>
                <Button size="icon" variant="outline" className="h-6 w-6" onClick={() => updateQty(item.product.id, item.qty + 1)}>
                  <span className="text-xs">+</span>
                </Button>
              </div>
            </div>
            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive shrink-0" onClick={() => removeItem(item.product.id)} aria-label="Remover">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </div>
      <div className="border-t px-4 py-3 bg-muted/30 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Total de itens:</span>
          <span className="font-bold text-foreground">{totalItems}</span>
        </div>
        <p className="text-[11px] text-muted-foreground">Valor total será confirmado no WhatsApp.</p>
        <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold" onClick={onCheckout}>
          Finalizar pedido →
        </Button>
      </div>
    </div>
  );
}
