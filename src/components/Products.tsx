import { Droplets, Sparkles, Archive, Zap, MessageCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { business } from "@/config/business";
import { trackEvent } from "@/hooks/use-analytics";
import { ScrollReveal } from "@/components/ScrollReveal";

const iconMap = {
  droplets: Droplets,
  sparkles: Sparkles,
  archive: Archive,
  zap: Zap,
} as const;

export function Products() {
  return (
    <section id="produtos" className="py-16 md:py-20">
      <div className="container">
        <ScrollReveal animation="fadeUp">
          <div className="text-center mb-10">
            <h2 className="text-2xl md:text-3xl lg:text-4xl font-extrabold text-foreground tracking-tight">
              Nossos Produtos
            </h2>
            <div className="mx-auto mt-3 h-1 w-16 rounded-full bg-accent" />
          </div>
        </ScrollReveal>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          {business.products.map((p, i) => {
            const Icon = iconMap[p.icon];
            const msg = `Olá! Tenho interesse no produto: ${p.name}. Poderia me informar o preço e disponibilidade?`;
            const hasImage = "image" in p && p.image;
            return (
              <ScrollReveal key={p.id} animation="scaleUp" delay={Math.min(i, 5) * 80}>
                <Card className="group hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 border-primary/10 shadow-lg h-full">
                  <CardContent className="p-6 flex flex-col items-center text-center gap-3 h-full">
                    <div className="w-full h-40 md:h-44 bg-white flex items-center justify-center overflow-hidden">
                      {hasImage ? (
                        <img
                          src={p.image as string}
                          alt={("imageAlt" in p && p.imageAlt) ? p.imageAlt as string : p.name}
                          loading={i === 0 ? "eager" : "lazy"}
                          className="h-full w-full object-contain p-2 group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                          <Icon className="h-7 w-7 text-primary" />
                        </div>
                      )}
                    </div>
                    <h3 className="font-bold text-base text-foreground">{p.name}</h3>
                    <p className="text-sm text-muted-foreground">{p.description}</p>
                    <span className="text-xs font-semibold text-primary">Consulte no WhatsApp</span>
                    <Button
                      size="sm"
                      className="w-full mt-auto bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-sm hover:shadow-md hover:scale-[1.02] transition-all"
                      asChild
                      onClick={() => trackEvent("whatsapp_click", { source: "product", product: p.id })}
                    >
                      <a href={business.waLink(msg)} target="_blank" rel="noopener noreferrer">
                        <MessageCircle className="h-4 w-4 mr-1" />
                        Pedir no WhatsApp
                      </a>
                    </Button>
                  </CardContent>
                </Card>
              </ScrollReveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
