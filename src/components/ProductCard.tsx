import { Droplets, Sparkles, Archive, Zap } from "lucide-react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import type { DbProduct } from "@/hooks/use-products";

const iconMap: Record<string, React.ReactNode> = {
  droplets: <Droplets className="h-7 w-7 text-primary" />,
  sparkles: <Sparkles className="h-7 w-7 text-primary" />,
  archive: <Archive className="h-7 w-7 text-primary" />,
  zap: <Zap className="h-7 w-7 text-primary" />,
};

interface ProductCardProps {
  product: DbProduct;
  footer?: React.ReactNode;
}

export function ProductCard({ product, footer }: ProductCardProps) {
  return (
    <Card className="flex flex-col hover:shadow-md transition-shadow h-full">
      <CardHeader className="flex-row items-center gap-3">
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            className="h-14 w-14 rounded-lg object-cover flex-shrink-0"
            loading="lazy"
          />
        ) : (
          iconMap[product.icon ?? "droplets"] || <Droplets className="h-7 w-7 text-primary" />
        )}
        <CardTitle className="text-lg">{product.name}</CardTitle>
      </CardHeader>
      <CardContent className="flex-1">
        <p className="text-sm text-muted-foreground">{product.description}</p>
        <p className="mt-2 font-semibold text-primary">{product.price_text}</p>
      </CardContent>
      {footer && <CardFooter>{footer}</CardFooter>}
    </Card>
  );
}
