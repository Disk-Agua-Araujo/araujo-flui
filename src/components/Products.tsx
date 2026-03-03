import { Droplets, Sparkles, Archive, Zap, MessageCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { business } from "@/config/business";
import { trackEvent } from "@/hooks/use-analytics";

const iconMap = {
  droplets: Droplets,
  sparkles: Sparkles,
  archive: Archive,
  zap: Zap,
} as const;

export function Products() {
  return (
    <section id="produtos" className="py-12 md:py-16">
      <div className="container">
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-8">Nossos Produtos</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          {business.products.map((p) => {
            const Icon = iconMap[p.icon];
            const msg = `Olá! Tenho interesse no produto: ${p.name}. Poderia me informar o preço e disponibilidade?`;
            return (
              <Card key={p.id} className="group hover:shadow-md transition-shadow">
                <CardContent className="p-6 flex flex-col items-center text-center gap-3">
                  <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                    <Icon className="h-7 w-7 text-primary" />
                  </div>
                  <h3 className="font-semibold text-base">{p.name}</h3>
                  <p className="text-sm text-muted-foreground">{p.description}</p>
                  <span className="text-xs font-medium text-primary">Consulte no WhatsApp</span>
                  <Button
                    size="sm"
                    className="w-full mt-auto bg-[#25D366] hover:bg-[#1da851] text-white"
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
            );
          })}
        </div>
      </div>
    </section>
  );
}
