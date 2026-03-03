import { useState } from "react";
import { MessageCircle, Plus, Minus, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { business, buildWhatsAppOrderMessage } from "@/config/business";
import { trackEvent } from "@/hooks/use-analytics";

export function QuickOrder() {
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [name, setName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [address, setAddress] = useState("");
  const [sent, setSent] = useState(false);
  const [copied, setCopied] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const updateQty = (id: string, delta: number) => {
    setQuantities((prev) => ({
      ...prev,
      [id]: Math.max(0, (prev[id] || 0) + delta),
    }));
  };

  const selectedItems = business.products
    .filter((p) => (quantities[p.id] || 0) > 0)
    .map((p) => `${quantities[p.id]}x ${p.name}`);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = "Informe seu nome";
    if (!whatsapp.trim()) e.whatsapp = "Informe seu WhatsApp";
    if (!address.trim()) e.address = "Informe seu endereço";
    if (selectedItems.length === 0) e.items = "Selecione ao menos um produto";
    if (name.trim().length > 100) e.name = "Nome muito longo";
    if (whatsapp.trim().length > 20) e.whatsapp = "WhatsApp inválido";
    if (address.trim().length > 200) e.address = "Endereço muito longo";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const orderSummary = buildWhatsAppOrderMessage({
    name: name.trim(),
    address: address.trim(),
    items: selectedItems.join(", "),
    payment: "A combinar",
  });

  const handleSubmit = () => {
    if (!validate()) return;
    trackEvent("order_submit", { source: "quick_order", items: selectedItems });
    window.open(business.waLink(orderSummary), "_blank");
    setSent(true);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(orderSummary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (sent) {
    return (
      <section id="pedido-rapido" className="py-12 md:py-16">
        <div className="container max-w-lg">
          <Card className="shadow-lg border-primary/20">
            <CardHeader>
              <CardTitle className="text-center text-primary">✅ Pedido enviado!</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground text-center">
                Seu pedido foi aberto no WhatsApp. Confira a conversa e finalize com nosso atendente.
              </p>
              <div className="bg-muted p-3 rounded-lg text-sm break-words">{orderSummary}</div>
              <Button variant="outline" className="w-full" onClick={handleCopy}>
                {copied ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
                {copied ? "Copiado!" : "Copiar resumo do pedido"}
              </Button>
              <Button variant="ghost" className="w-full" onClick={() => setSent(false)}>
                Fazer novo pedido
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>
    );
  }

  return (
    <section id="pedido-rapido" className="py-12 md:py-16 bg-gradient-to-b from-background to-primary/5">
      <div className="container max-w-lg">
        <Card className="shadow-lg border-primary/10">
          <CardHeader>
            <CardTitle className="text-center text-primary text-xl">⚡ Pedido rápido</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Products */}
            <div className="space-y-2">
              {business.products.map((p) => (
                <div key={p.id} className="flex items-center justify-between bg-muted/50 rounded-lg px-3 py-2">
                  <span className="text-sm font-medium flex-1">{p.name}</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateQty(p.id, -1)}
                      className="h-7 w-7 rounded-full border flex items-center justify-center hover:bg-muted transition-colors"
                      aria-label={`Diminuir ${p.name}`}
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="w-6 text-center text-sm font-semibold">{quantities[p.id] || 0}</span>
                    <button
                      onClick={() => updateQty(p.id, 1)}
                      className="h-7 w-7 rounded-full border flex items-center justify-center hover:bg-muted transition-colors"
                      aria-label={`Aumentar ${p.name}`}
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))}
              {errors.items && <p className="text-xs text-destructive">{errors.items}</p>}
            </div>

            {/* Fields */}
            <div className="space-y-3">
              <div>
                <Input placeholder="Seu nome" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} />
                {errors.name && <p className="text-xs text-destructive mt-1">{errors.name}</p>}
              </div>
              <div>
                <Input placeholder="Seu WhatsApp" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} type="tel" maxLength={20} />
                {errors.whatsapp && <p className="text-xs text-destructive mt-1">{errors.whatsapp}</p>}
              </div>
              <div>
                <Input placeholder="Endereço / Bairro" value={address} onChange={(e) => setAddress(e.target.value)} maxLength={200} />
                {errors.address && <p className="text-xs text-destructive mt-1">{errors.address}</p>}
              </div>
            </div>

            <Button
              className="w-full bg-whatsapp hover:bg-whatsapp-dark text-white font-semibold"
              onClick={handleSubmit}
            >
              <MessageCircle className="h-4 w-4 mr-2" />
              Enviar pedido no WhatsApp
            </Button>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
