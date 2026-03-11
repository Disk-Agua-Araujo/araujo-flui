import { Star, ExternalLink } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { business } from "@/config/business";
import { ScrollReveal } from "@/components/ScrollReveal";

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
    <section id="avaliacoes" className="py-16 md:py-20 bg-[hsl(214,60%,96%)]">
      <div className="container">
        <ScrollReveal animation="fadeUp">
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 bg-card border rounded-full px-4 py-2 shadow-md mb-4">
              <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
              <span className="font-bold text-lg">{business.rating}</span>
              <span className="text-muted-foreground text-sm">★★★★☆ • {business.reviewCount} avaliações no Google</span>
            </div>
            <h2 className="text-2xl md:text-3xl lg:text-4xl font-extrabold text-foreground tracking-tight">
              O que nossos clientes dizem
            </h2>
            <div className="mx-auto mt-3 h-1 w-16 rounded-full bg-accent" />
          </div>
        </ScrollReveal>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl mx-auto">
          {business.reviews.map((r, i) => (
            <ScrollReveal key={i} animation="scaleUp" delay={Math.min(i, 5) * 100}>
              <Card className="shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 h-full">
                <CardContent className="p-5 flex flex-col h-full">
                  <Stars count={r.stars} />
                  <p className="text-sm text-muted-foreground italic mt-3 flex-grow">"{r.text}"</p>
                  <p className="text-sm font-bold mt-3">— {r.author}</p>
                </CardContent>
              </Card>
            </ScrollReveal>
          ))}
        </div>

        <ScrollReveal animation="fadeIn" delay={200}>
          <div className="text-center mt-8">
            <Button variant="outline" className="border-primary text-primary hover:bg-primary hover:text-primary-foreground font-semibold" asChild>
              <a href={business.googleReviewsLink} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-1" /> Ver todas no Google
              </a>
            </Button>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
