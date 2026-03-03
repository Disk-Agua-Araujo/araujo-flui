import { useState } from "react";
import { MessageCircle, Phone, MapPin, Clock, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { business } from "@/config/business";
import { trackEvent } from "@/hooks/use-analytics";

const contactCards = [
  { icon: MessageCircle, label: "WhatsApp", value: business.phone, action: business.waLink(business.waDefaultMessage), external: true, event: "whatsapp_click" as const },
  { icon: Phone, label: "Telefone", value: business.phone, action: business.telLink, external: false, event: "call_click" as const },
  { icon: MapPin, label: "Endereço", value: business.address.full, action: business.mapsDirectionsLink, external: true, event: null },
  { icon: Clock, label: "Horário", value: `${business.hours}\n${business.hoursNote}`, action: null, external: false, event: null },
];

export function Contact() {
  const [cName, setCName] = useState("");
  const [cWa, setCWa] = useState("");
  const [cMsg, setCMsg] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cName.trim() || !cWa.trim() || !cMsg.trim()) return;
    const msg = `Olá! Meu nome é ${cName.trim()}. WhatsApp: ${cWa.trim()}. Mensagem: ${cMsg.trim()}`;
    trackEvent("lead_submit", { source: "contact_form" });
    window.open(business.waLink(msg), "_blank");
  };

  return (
    <section id="contato" className="py-12 md:py-16 bg-muted/50">
      <div className="container">
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-8">Contato</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-4xl mx-auto mb-12">
          {contactCards.map((c, i) => (
            <Card key={i} className="hover:shadow-md transition-shadow border-primary/10">
              <CardContent className="p-4 flex flex-col items-center text-center gap-2">
                <c.icon className="h-6 w-6 text-primary" />
                <span className="font-semibold text-sm">{c.label}</span>
                <span className="text-xs text-muted-foreground whitespace-pre-line">{c.value}</span>
                {c.action && (
                  <Button variant="ghost" size="sm" className="mt-1" asChild onClick={() => c.event && trackEvent(c.event, { source: "contact_card" })}>
                    <a href={c.action} target={c.external ? "_blank" : undefined} rel={c.external ? "noopener noreferrer" : undefined}>Abrir</a>
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Lead form */}
        <div className="max-w-md mx-auto">
          <Card className="shadow-lg">
            <CardContent className="p-6">
              <h3 className="font-bold text-lg mb-4 text-center">Fale com a gente</h3>
              <form onSubmit={handleSubmit} data-netlify="true" name="contato" className="space-y-3">
                <input type="hidden" name="form-name" value="contato" />
                <Input placeholder="Nome" value={cName} onChange={(e) => setCName(e.target.value)} required maxLength={100} name="nome" />
                <Input placeholder="WhatsApp" value={cWa} onChange={(e) => setCWa(e.target.value)} required maxLength={20} type="tel" name="whatsapp" />
                <textarea
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 min-h-[80px] resize-none"
                  placeholder="Sua mensagem"
                  value={cMsg}
                  onChange={(e) => setCMsg(e.target.value)}
                  required
                  maxLength={500}
                  name="mensagem"
                />
                <Button className="w-full" type="submit">
                  <Send className="h-4 w-4 mr-2" /> Enviar mensagem
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Final CTA */}
        <div className="mt-12 rounded-2xl p-8 text-center text-primary-foreground" style={{ background: "linear-gradient(135deg, hsl(var(--brand-blue-dark)), hsl(var(--brand-blue)))" }}>
          <h3 className="text-xl md:text-2xl font-bold mb-3">Peça agora e receba com agilidade</h3>
          <p className="text-primary-foreground/80 mb-6 text-sm">
            Entrega rápida de água mineral em Santo André. Fale conosco!
          </p>
          <Button
            size="lg"
            className="bg-whatsapp hover:bg-whatsapp-dark text-white font-semibold"
            asChild
            onClick={() => trackEvent("whatsapp_click", { source: "cta_band" })}
          >
            <a href={business.waLink(business.waDefaultMessage)} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="h-5 w-5 mr-2" /> Pedir no WhatsApp
            </a>
          </Button>
        </div>
      </div>
    </section>
  );
}
