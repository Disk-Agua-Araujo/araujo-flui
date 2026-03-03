import { MessageCircle, ShoppingCart, Star, Truck, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { business } from "@/config/business";
import { trackEvent } from "@/hooks/use-analytics";
import { Link } from "react-router-dom";

export function Hero() {
  return (
    <section id="inicio" className="relative overflow-hidden">
      {/* Thin accent line */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-accent to-primary z-10" />

      <div className="container py-12 md:py-0">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-0 items-center min-h-[auto] md:min-h-[520px]">
          {/* Mobile: image first */}
          <div className="md:hidden relative rounded-2xl overflow-hidden shadow-lg aspect-[4/3]">
            <img
              src="/hero-frente-loja.jpg"
              alt="Fachada da Disk Água Araujo em Santo André"
              className="w-full h-full object-cover object-center"
              loading="eager"
              fetchPriority="high"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-primary/20 to-transparent" />
          </div>

          {/* Text column */}
          <div className="text-center md:text-left md:pr-8 py-4 md:py-16">
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

            {/* Trust row */}
            <div className="mt-8 flex flex-wrap justify-center md:justify-start gap-3 text-sm text-muted-foreground animate-fade-in-up" style={{ animationDelay: "0.3s" }}>
              <div className="flex items-center gap-1.5 bg-card px-3 py-1.5 rounded-full shadow-sm border border-primary/10">
                <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                <span className="font-medium">{business.rating} • {business.reviewCount} avaliações</span>
              </div>
              <div className="flex items-center gap-1.5 bg-card px-3 py-1.5 rounded-full shadow-sm border border-primary/10">
                <Truck className="h-4 w-4 text-primary" />
                <span>Entrega rápida</span>
              </div>
              <div className="flex items-center gap-1.5 bg-card px-3 py-1.5 rounded-full shadow-sm border border-primary/10">
                <Heart className="h-4 w-4 text-accent" />
                <span>Atendimento humanizado</span>
              </div>
            </div>
          </div>

          {/* Desktop: image column */}
          <div className="hidden md:block relative h-full min-h-[520px]">
            <img
              src="/hero-frente-loja.jpg"
              alt="Fachada da Disk Água Araujo em Santo André"
              className="absolute inset-0 w-full h-full object-cover object-center rounded-l-3xl"
              loading="eager"
              fetchPriority="high"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-background/60 via-transparent to-transparent rounded-l-3xl" />
          </div>
        </div>
      </div>
    </section>
  );
}
