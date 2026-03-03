import { Star, ExternalLink } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { business } from "@/config/business";

function Stars({ count }: { count: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`h-4 w-4 ${i < count ? "text-yellow-500 fill-yellow-500" : "text-muted-foreground/30"}`}
        />
      ))}
    </div>
  );
}

export function Reviews() {
  return (
    <section id="avaliacoes" className="py-12 md:py-16 bg-muted/50">
      <div className="container">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-card border rounded-full px-4 py-2 shadow-sm mb-4">
            <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
            <span className="font-bold text-lg">{business.rating}</span>
            <span className="text-muted-foreground text-sm">★★★★☆ • {business.reviewCount} avaliações no Google</span>
          </div>
          <h2 className="text-2xl md:text-3xl font-bold">O que nossos clientes dizem</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl mx-auto">
          {business.reviews.map((r, i) => (
            <Card key={i} className="hover:shadow-md transition-shadow">
              <CardContent className="p-5 space-y-3">
                <Stars count={r.stars} />
                <p className="text-sm text-muted-foreground italic">"{r.text}"</p>
                <p className="text-sm font-medium">— {r.author}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="text-center mt-8">
          <Button variant="outline" asChild>
            <a href={business.googleReviewsLink} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4 mr-1" /> Ver todas no Google
            </a>
          </Button>
        </div>
      </div>
    </section>
  );
}
