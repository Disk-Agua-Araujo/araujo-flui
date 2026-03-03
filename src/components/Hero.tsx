import { MessageCircle, ShoppingCart, Star, Truck, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { business } from "@/config/business";
import { trackEvent } from "@/hooks/use-analytics";
import { Link } from "react-router-dom";

export function Hero() {
  return (
    <section id="inicio" className="relative overflow-hidden py-16 md:py-24" style={{ background: "linear-gradient(135deg, hsl(var(--brand-blue-dark) / 0.06), hsl(var(--background)), hsl(var(--brand-blue) / 0.08))" }}>
      {/* Decorative shapes */}
      <div className="absolute top-10 right-0 w-64 h-64 rounded-full -translate-y-1/2 translate-x-1/3" style={{ background: "hsl(var(--brand-blue) / 0.06)" }} />
      <div className="absolute bottom-0 left-0 w-48 h-48 rounded-full translate-y-1/3 -translate-x-1/4" style={{ background: "hsl(var(--brand-red) / 0.05)" }} />
      <div className="absolute top-1/2 right-1/4 w-20 h-20 rounded-lg rotate-45" style={{ background: "hsl(var(--brand-blue) / 0.08)" }} />
      {/* Thin red accent line */}
      <div className="absolute top-0 left-0 right-0 h-1" style={{ background: "linear-gradient(90deg, hsl(var(--brand-blue)), hsl(var(--brand-red)), hsl(var(--brand-blue)))" }} />

      <div className="container relative">
        <div className="max-w-2xl mx-auto text-center md:text-left md:mx-0">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-foreground leading-tight animate-fade-in-up">
            {business.tagline}
          </h1>
          <p className="mt-4 text-base sm:text-lg text-muted-foreground max-w-xl animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
            {business.subtitle}
          </p>

          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center md:justify-start animate-fade-in-up" style={{ animationDelay: "0.2s" }}>
            <Button
              size="lg"
              className="bg-whatsapp hover:bg-whatsapp-dark text-white font-semibold text-base"
              asChild
              onClick={() => trackEvent("whatsapp_click", { source: "hero" })}
            >
              <a href={business.waLink(business.waDefaultMessage)} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="h-5 w-5 mr-2" />
                Pedir no WhatsApp
              </a>
            </Button>
            <Button size="lg" variant="outline" className="font-semibold text-base border-primary text-primary hover:bg-primary hover:text-primary-foreground" asChild>
              <Link to="/pedido">
                <ShoppingCart className="h-5 w-5 mr-2" />
                Fazer pedido pelo site
              </Link>
            </Button>
          </div>
        </div>

        {/* Trust row */}
        <div className="mt-12 flex flex-wrap justify-center md:justify-start gap-4 md:gap-8 text-sm text-muted-foreground animate-fade-in-up" style={{ animationDelay: "0.3s" }}>
          <div className="flex items-center gap-1.5 bg-card px-4 py-2 rounded-full shadow-sm border border-primary/10">
            <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
            <span className="font-medium">{business.rating} ★★★★☆ • {business.reviewCount} avaliações</span>
          </div>
          <div className="flex items-center gap-1.5 bg-card px-4 py-2 rounded-full shadow-sm border border-primary/10">
            <Truck className="h-4 w-4 text-primary" />
            <span>Entrega rápida em Santo André</span>
          </div>
          <div className="flex items-center gap-1.5 bg-card px-4 py-2 rounded-full shadow-sm border border-primary/10">
            <Heart className="h-4 w-4 text-accent" />
            <span>Atendimento humanizado</span>
          </div>
        </div>
      </div>
    </section>
  );
}
