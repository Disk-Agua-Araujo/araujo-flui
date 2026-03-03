import { useState, useEffect } from "react";
import { MessageCircle, Plus, Minus, Copy, Check, Save, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { MobileBottomBar } from "@/components/MobileBottomBar";
import { business, buildWhatsAppOrderMessage } from "@/config/business";
import { trackEvent } from "@/hooks/use-analytics";

const STORAGE_KEY = "disk-agua-araujo-order";

interface OrderData {
  quantities: Record<string, number>;
  name: string;
  whatsapp: string;
  address: string;
  complement: string;
  reference: string;
  customerType: string;
  payment: string;
  obs: string;
}

const defaultOrder: OrderData = {
  quantities: {},
  name: "",
  whatsapp: "",
  address: "",
  complement: "",
  reference: "",
  customerType: "residencia",
  payment: "PIX",
  obs: "",
};

export default function OrderPage() {
  const [order, setOrder] = useState<OrderData>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return { ...defaultOrder, ...JSON.parse(saved) };
    } catch {}
    return defaultOrder;
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sent, setSent] = useState(false);
  const [copied, setCopied] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);

  const update = <K extends keyof OrderData>(key: K, val: OrderData[K]) =>
    setOrder((prev) => ({ ...prev, [key]: val }));

  const updateQty = (id: string, delta: number) =>
    update("quantities", { ...order.quantities, [id]: Math.max(0, (order.quantities[id] || 0) + delta) });

  const selectedItems = business.products
    .filter((p) => (order.quantities[p.id] || 0) > 0)
    .map((p) => `${order.quantities[p.id]}x ${p.name}`);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!order.name.trim()) e.name = "Informe seu nome";
    if (!order.whatsapp.trim()) e.whatsapp = "Informe seu WhatsApp";
    if (!order.address.trim()) e.address = "Informe o endereço";
    if (selectedItems.length === 0) e.items = "Selecione ao menos um produto";
    if (order.name.trim().length > 100) e.name = "Nome muito longo";
    if (order.whatsapp.trim().length > 20) e.whatsapp = "WhatsApp inválido";
    if (order.address.trim().length > 300) e.address = "Endereço muito longo";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const fullAddress = [order.address.trim(), order.complement.trim(), order.reference.trim() ? `Ref: ${order.reference.trim()}` : ""].filter(Boolean).join(", ");

  const orderMessage = buildWhatsAppOrderMessage({
    name: order.name.trim(),
    address: fullAddress,
    items: selectedItems.join(", "),
    payment: order.payment,
    obs: [order.customerType === "empresa" ? "Empresa" : "Residência", order.obs.trim()].filter(Boolean).join(". "),
  });

  const handleSubmit = () => {
    if (!validate()) return;
    trackEvent("order_submit", { source: "order_page", items: selectedItems, payment: order.payment });
    window.open(business.waLink(orderMessage), "_blank");
    setSent(true);
  };

  const handleSave = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(order));
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(orderMessage);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Summary for sidebar / mobile
  const SummaryContent = () => (
    <div className="space-y-3">
      <h3 className="font-bold text-lg">Resumo do pedido</h3>
      {selectedItems.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum item selecionado</p>
      ) : (
        <ul className="space-y-1">
          {selectedItems.map((item, i) => (
            <li key={i} className="text-sm">{item}</li>
          ))}
        </ul>
      )}
      {order.name && <p className="text-sm"><span className="font-medium">Nome:</span> {order.name}</p>}
      {order.address && <p className="text-sm"><span className="font-medium">Endereço:</span> {fullAddress}</p>}
      <p className="text-sm"><span className="font-medium">Pagamento:</span> {order.payment}</p>
      {order.obs && <p className="text-sm"><span className="font-medium">Obs:</span> {order.obs}</p>}
    </div>
  );

  if (sent) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 py-12">
          <div className="container max-w-lg">
            <Card className="shadow-lg border-primary/20">
              <CardHeader>
                <CardTitle className="text-center text-primary text-xl">✅ Pedido pronto para enviar!</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground text-center">
                  Seu pedido foi aberto no WhatsApp. Finalize com nosso atendente.
                </p>
                <div className="bg-muted p-3 rounded-lg text-sm break-words">{orderMessage}</div>
                <Button variant="outline" className="w-full" onClick={handleCopy}>
                  {copied ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
                  {copied ? "Copiado!" : "Copiar resumo"}
                </Button>
                <Button variant="ghost" className="w-full" onClick={() => setSent(false)}>
                  Fazer novo pedido
                </Button>
              </CardContent>
            </Card>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 py-8 md:py-12">
        <div className="container">
          <h1 className="text-2xl md:text-3xl font-bold mb-6 text-center">Fazer pedido</h1>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {/* Form */}
            <div className="lg:col-span-2 space-y-6">
              {/* Products */}
              <Card>
                <CardHeader><CardTitle className="text-lg">Produtos</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {business.products.map((p) => (
                    <div key={p.id} className="flex items-center justify-between bg-muted/50 rounded-lg px-3 py-2">
                      <span className="text-sm font-medium flex-1">{p.name}</span>
                      <div className="flex items-center gap-2">
                        <button onClick={() => updateQty(p.id, -1)} className="h-8 w-8 rounded-full border flex items-center justify-center hover:bg-muted transition-colors" aria-label={`Diminuir ${p.name}`}>
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="w-6 text-center font-semibold">{order.quantities[p.id] || 0}</span>
                        <button onClick={() => updateQty(p.id, 1)} className="h-8 w-8 rounded-full border flex items-center justify-center hover:bg-muted transition-colors" aria-label={`Aumentar ${p.name}`}>
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                  {errors.items && <p className="text-xs text-destructive">{errors.items}</p>}
                </CardContent>
              </Card>

              {/* Customer info */}
              <Card>
                <CardHeader><CardTitle className="text-lg">Seus dados</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <Input placeholder="Nome completo" value={order.name} onChange={(e) => update("name", e.target.value)} maxLength={100} />
                    {errors.name && <p className="text-xs text-destructive mt-1">{errors.name}</p>}
                  </div>
                  <div>
                    <Input placeholder="WhatsApp" value={order.whatsapp} onChange={(e) => update("whatsapp", e.target.value)} type="tel" maxLength={20} />
                    {errors.whatsapp && <p className="text-xs text-destructive mt-1">{errors.whatsapp}</p>}
                  </div>
                </CardContent>
              </Card>

              {/* Delivery */}
              <Card>
                <CardHeader><CardTitle className="text-lg">Entrega</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <Input placeholder="Endereço completo" value={order.address} onChange={(e) => update("address", e.target.value)} maxLength={300} />
                    {errors.address && <p className="text-xs text-destructive mt-1">{errors.address}</p>}
                  </div>
                  <Input placeholder="Complemento (opcional)" value={order.complement} onChange={(e) => update("complement", e.target.value)} maxLength={100} />
                  <Input placeholder="Ponto de referência (opcional)" value={order.reference} onChange={(e) => update("reference", e.target.value)} maxLength={100} />
                  <div>
                    <label className="text-sm font-medium mb-2 block">Tipo de cliente</label>
                    <div className="flex gap-3">
                      {["residencia", "empresa"].map((t) => (
                        <button
                          key={t}
                          onClick={() => update("customerType", t)}
                          className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-colors ${order.customerType === t ? "bg-primary text-primary-foreground border-primary" : "bg-card hover:bg-muted"}`}
                        >
                          {t === "residencia" ? "Residência" : "Empresa"}
                        </button>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Payment */}
              <Card>
                <CardHeader><CardTitle className="text-lg">Pagamento</CardTitle></CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {business.paymentMethods.map((m) => (
                      <button
                        key={m}
                        onClick={() => update("payment", m)}
                        className={`py-2 px-4 rounded-lg border text-sm font-medium transition-colors ${order.payment === m ? "bg-primary text-primary-foreground border-primary" : "bg-card hover:bg-muted"}`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Observations */}
              <Card>
                <CardHeader><CardTitle className="text-lg">Observações</CardTitle></CardHeader>
                <CardContent>
                  <textarea
                    className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 min-h-[80px] resize-none"
                    placeholder="Alguma observação? (opcional)"
                    value={order.obs}
                    onChange={(e) => update("obs", e.target.value)}
                    maxLength={500}
                  />
                </CardContent>
              </Card>

              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-3">
                <Button className="flex-1 bg-[#25D366] hover:bg-[#1da851] text-white font-semibold" onClick={handleSubmit}>
                  <MessageCircle className="h-4 w-4 mr-2" />
                  Enviar pedido no WhatsApp
                </Button>
                <Button variant="outline" onClick={handleSave}>
                  <Save className="h-4 w-4 mr-1" /> Salvar pedido
                </Button>
              </div>
            </div>

            {/* Desktop sidebar */}
            <div className="hidden lg:block">
              <div className="sticky top-20">
                <Card className="shadow-md">
                  <CardContent className="p-5">
                    <SummaryContent />
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>

          {/* Mobile summary */}
          <div className="lg:hidden mt-4 max-w-5xl mx-auto">
            <button
              onClick={() => setSummaryOpen(!summaryOpen)}
              className="w-full flex items-center justify-between bg-card border rounded-lg p-3 text-sm font-medium"
            >
              <span>Resumo do pedido ({selectedItems.length} {selectedItems.length === 1 ? "item" : "itens"})</span>
              {summaryOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            {summaryOpen && (
              <Card className="mt-2">
                <CardContent className="p-4">
                  <SummaryContent />
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
      <Footer />
      <MobileBottomBar />
    </div>
  );
}
