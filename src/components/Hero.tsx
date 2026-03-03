import { MessageCircle, ShoppingCart, Star, Truck, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { business } from "@/config/business";
import { trackEvent } from "@/hooks/use-analytics";
import { Link } from "react-router-dom";

export function Hero() {
  return (
    <section id="inicio" className="relative overflow-hidden bg-gradient-to-br from-primary/5 via-background to-primary/10 py-16 md:py-24">
      {/* Decorative shapes */}
      <div className="absolute top-10 right-0 w-64 h-64 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/3" />
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-accent/5 rounded-full translate-y-1/3 -translate-x-1/4" />
      <div className="absolute top-1/2 right-1/4 w-20 h-20 bg-primary/10 rounded-lg rotate-45" />

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
              className="bg-[#25D366] hover:bg-[#1da851] text-white font-semibold text-base"
              asChild
              onClick={() => trackEvent("whatsapp_click", { source: "hero" })}
            >
              <a href={business.waLink(business.waDefaultMessage)} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="h-5 w-5 mr-2" />
                Pedir no WhatsApp
              </a>
            </Button>
            <Button size="lg" variant="outline" className="font-semibold text-base" asChild>
              <Link to="/pedido">
                <ShoppingCart className="h-5 w-5 mr-2" />
                Fazer pedido pelo site
              </Link>
            </Button>
          </div>
        </div>

        {/* Trust row */}
        <div className="mt-12 flex flex-wrap justify-center md:justify-start gap-4 md:gap-8 text-sm text-muted-foreground animate-fade-in-up" style={{ animationDelay: "0.3s" }}>
          <div className="flex items-center gap-1.5 bg-card px-4 py-2 rounded-full shadow-sm border">
            <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
            <span className="font-medium">{business.rating} ★★★★☆ • {business.reviewCount} avaliações</span>
          </div>
          <div className="flex items-center gap-1.5 bg-card px-4 py-2 rounded-full shadow-sm border">
            <Truck className="h-4 w-4 text-primary" />
            <span>Entrega rápida em Santo André</span>
          </div>
          <div className="flex items-center gap-1.5 bg-card px-4 py-2 rounded-full shadow-sm border">
            <Heart className="h-4 w-4 text-accent" />
            <span>Atendimento humanizado</span>
          </div>
        </div>
      </div>
    </section>
  );
}
