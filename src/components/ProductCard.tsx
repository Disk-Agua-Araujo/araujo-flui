import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ProductImage } from "@/components/ProductImage";
import type { DbProduct } from "@/hooks/use-products";

interface ProductCardProps {
  product: DbProduct;
  footer?: React.ReactNode;
}

export function ProductCard({ product, footer }: ProductCardProps) {
  return (
    <Card className="flex flex-col hover:shadow-md transition-shadow h-full overflow-hidden">
      <div className="w-full aspect-square bg-muted">
        <ProductImage imageUrl={product.image_url} productName={product.name} size="lg" className="rounded-none rounded-t-lg" />
      </div>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">{product.name}</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 pt-0">
        <p className="text-sm text-muted-foreground">{product.description}</p>
        <p className="mt-2 font-semibold text-primary">{product.price_text}</p>
      </CardContent>
      {footer && <CardFooter>{footer}</CardFooter>}
    </Card>
  );
}
