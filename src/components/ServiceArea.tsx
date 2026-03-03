import { MapPin, Phone, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { business } from "@/config/business";
import { trackEvent } from "@/hooks/use-analytics";

export function ServiceArea() {
  return (
    <section className="py-12 md:py-16">
      <div className="container">
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-4">Área de atendimento</h2>
        <p className="text-center text-muted-foreground mb-8 max-w-md mx-auto">
          Atendemos Santo André e região (consulte disponibilidade).
        </p>

        <div className="max-w-3xl mx-auto rounded-xl overflow-hidden shadow-md border">
          <iframe
            title="Localização Disk Água Araujo"
            src={business.mapsEmbedUrl}
            width="100%"
            height="300"
            style={{ border: 0 }}
            allowFullScreen
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>

        <div className="flex flex-wrap justify-center gap-3 mt-6">
          <Button variant="outline" size="sm" asChild>
            <a href={business.mapsDirectionsLink} target="_blank" rel="noopener noreferrer">
              <MapPin className="h-4 w-4 mr-1" /> Rotas no Google Maps
            </a>
          </Button>
          <Button variant="outline" size="sm" asChild onClick={() => trackEvent("call_click")}>
            <a href={business.telLink}>
              <Phone className="h-4 w-4 mr-1" /> Ligar
            </a>
          </Button>
          <Button
            size="sm"
            className="bg-[#25D366] hover:bg-[#1da851] text-white"
            asChild
            onClick={() => trackEvent("whatsapp_click", { source: "map" })}
          >
            <a href={business.waLink(business.waDefaultMessage)} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="h-4 w-4 mr-1" /> WhatsApp
            </a>
          </Button>
        </div>
      </div>
    </section>
  );
}
