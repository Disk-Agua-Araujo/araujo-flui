import { Plus, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ProductImage } from "@/components/ProductImage";
import type { DbProduct } from "@/hooks/use-products";

interface StoreProductCardProps {
  product: DbProduct;
  qty: number;
  onAdd: () => void;
  onIncrease: () => void;
  onDecrease: () => void;
}

export function StoreProductCard({ product, qty, onAdd, onIncrease, onDecrease }: StoreProductCardProps) {
  const inCart = qty > 0;
  return (
    <Card className="relative flex flex-col overflow-hidden hover:shadow-md transition-shadow h-full">
      {inCart && (
        <div className="absolute top-2 right-2 z-10 h-6 min-w-6 px-1.5 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center shadow-md">
          {qty}
        </div>
      )}
      <div className="w-full aspect-square bg-white flex items-center justify-center overflow-hidden">
        <ProductImage imageUrl={product.image_url} productName={product.name} size="lg" className="rounded-none" />
      </div>
      <div className="flex-1 flex flex-col p-3 gap-2">
        <h3 className="text-sm md:text-base font-semibold text-foreground line-clamp-2">{product.name}</h3>
        {product.price_text && product.price_text.trim().toLowerCase() !== "consulte no whatsapp" && (
          <p className="text-base md:text-lg font-bold text-primary mt-auto">{product.price_text}</p>
        )}
        <div className="mt-auto" />
        {inCart ? (
          <div className="flex items-center justify-between gap-1 border border-primary/20 rounded-md p-1 bg-primary/5">
            <Button size="icon" variant="ghost" className="h-8 w-8 text-primary" onClick={onDecrease} aria-label="Diminuir quantidade">
              <Minus className="h-4 w-4" />
            </Button>
            <span className="font-bold text-primary text-sm" aria-live="polite">{qty}</span>
            <Button size="icon" variant="ghost" className="h-8 w-8 text-primary" onClick={onIncrease} aria-label="Aumentar quantidade">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <Button size="sm" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold" onClick={onAdd}>
            <Plus className="h-4 w-4 mr-1" /> Adicionar
          </Button>
        )}
      </div>
    </Card>
  );
}
