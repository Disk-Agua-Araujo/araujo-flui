import { MessageCircle, ShoppingCart, Star, Truck, Heart, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { business } from "@/config/business";
import { trackEvent } from "@/hooks/use-analytics";
import { Link } from "react-router-dom";
import { useRef, useState } from "react";

export function Hero() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !muted;
      setMuted(!muted);
    }
  };

  const videoBlock = (className: string) => (
    <div className={`relative ${className}`}>
      {/* Glow effect */}
      <div className="absolute -inset-2 rounded-3xl bg-gradient-to-br from-primary/20 via-accent/10 to-primary/15 blur-xl opacity-50" />
      <div className="relative rounded-2xl overflow-hidden shadow-2xl ring-1 ring-primary/20">
        <video
          ref={videoRef}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          className="w-full h-full object-cover object-center"
        >
          <source src="/media/hero-video.mp4" type="video/mp4" />
          Seu navegador não suporta vídeo HTML5.
        </video>
        <div className="absolute inset-0 bg-gradient-to-t from-primary/20 to-transparent pointer-events-none" />
        <button
          onClick={toggleMute}
          className="absolute bottom-3 right-3 z-10 bg-card/80 backdrop-blur p-2 rounded-full shadow-md hover:bg-card transition-colors"
          aria-label={muted ? "Ativar som" : "Desativar som"}
        >
          {muted ? <VolumeX className="h-4 w-4 text-foreground" /> : <Volume2 className="h-4 w-4 text-foreground" />}
        </button>
      </div>
    </div>
  );

  return (
    <section id="inicio" className="relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-accent to-primary z-10" />

      <div className="container py-12 md:py-0">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-0 items-center min-h-[auto] md:min-h-[520px]">
          {/* Mobile: video first */}
          <div className="md:hidden">
            {videoBlock("aspect-[9/16] max-w-[280px] mx-auto")}
          </div>

          {/* Text column */}
          <div className="text-center md:text-left md:pr-8 py-4 md:py-16">
            <h1 className="text-4xl sm:text-5xl md:text-5xl lg:text-6xl font-extrabold tracking-tight text-foreground leading-[1.1] animate-fade-in-up">
              {business.tagline}
            </h1>
            <p className="mt-4 text-base sm:text-lg text-muted-foreground max-w-xl leading-relaxed animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
              {business.subtitle}
            </p>

            {/* Google badge */}
            <div className="mt-5 animate-fade-in-up" style={{ animationDelay: "0.15s" }}>
              <a
                href={business.googleReviewsLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-primary text-primary-foreground text-sm font-semibold px-4 py-2 rounded-full shadow-md hover:shadow-lg hover:scale-[1.02] transition-all"
              >
                <Star className="h-4 w-4 text-yellow-400 fill-yellow-400" />
                {business.rating} no Google · +4.347 avaliações
              </a>
            </div>

            <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center md:justify-start animate-fade-in-up" style={{ animationDelay: "0.2s" }}>
              <Button
                size="lg"
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-base px-8 py-6 shadow-md hover:shadow-lg hover:scale-[1.02] transition-all"
                asChild
                onClick={() => trackEvent("whatsapp_click", { source: "hero" })}
              >
                <a href={business.waLink(business.waDefaultMessage)} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="h-5 w-5 mr-2" />
                  Pedir no WhatsApp
                </a>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="font-bold text-base border-2 border-primary text-primary hover:bg-primary hover:text-primary-foreground px-8 py-6 transition-all"
                asChild
              >
                <Link to="/pedido">
                  <ShoppingCart className="h-5 w-5 mr-2" />
                  Fazer pedido pelo site
                </Link>
              </Button>
            </div>

            {/* Trust row */}
            <div className="mt-8 flex flex-wrap justify-center md:justify-start gap-3 text-sm text-muted-foreground animate-fade-in-up" style={{ animationDelay: "0.3s" }}>
              <div className="flex items-center gap-1.5 bg-card px-3 py-1.5 rounded-full shadow-sm border border-primary/10">
                <Truck className="h-4 w-4 text-primary" />
                <span className="font-medium">Entrega rápida</span>
              </div>
              <div className="flex items-center gap-1.5 bg-card px-3 py-1.5 rounded-full shadow-sm border border-primary/10">
                <Heart className="h-4 w-4 text-accent" />
                <span>Atendimento humanizado</span>
              </div>
            </div>
          </div>

          {/* Desktop: video column */}
          <div className="hidden md:flex items-center justify-center relative h-full min-h-[520px]">
            {/* Glow effect */}
            <div className="absolute -inset-3 bg-gradient-to-br from-primary/20 via-accent/10 to-primary/15 blur-2xl opacity-40" />
            <div className="relative w-[320px] h-[480px] rounded-2xl overflow-hidden shadow-2xl ring-1 ring-primary/20">
              <video
                autoPlay
                muted
                loop
                playsInline
                preload="metadata"
                className="w-full h-full object-cover object-center"
              >
                <source src="/media/hero-video.mp4" type="video/mp4" />
              </video>
              <div className="absolute inset-0 bg-gradient-to-r from-background/40 via-transparent to-transparent pointer-events-none" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
