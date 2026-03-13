import { useState, useMemo } from "react";
import { MessageCircle, Plus, Minus, Copy, Check, Loader2, ChevronDown, ChevronUp, Droplets } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { MobileBottomBar } from "@/components/MobileBottomBar";
import { business, buildWhatsAppOrderMessage } from "@/config/business";
import { buildOrderMessage, openWhatsApp, type OrderMessageData } from "@/services/whatsapp";
import { createSiteOrder } from "@/services/orders";
import { useProducts } from "@/hooks/use-products";
import { trackEvent } from "@/hooks/use-analytics";
import { useToast } from "@/hooks/use-toast";
import { useDebounce } from "@/hooks/use-debounce";
import { normalize } from "@/lib/normalize";
import { ProductSearchBar } from "@/components/ProductSearchBar";
import { Skeleton } from "@/components/ui/skeleton";

export default function OrderPage() {
  const { toast } = useToast();
  const { data: dbProducts = [], isLoading: productsLoading } = useProducts();

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 250);

  const filteredProducts = useMemo(() => {
    if (!debouncedSearch) return dbProducts;
    const q = normalize(debouncedSearch);
    return dbProducts.filter((p) => normalize(p.name).includes(q) || normalize(p.description ?? "").includes(q));
  }, [dbProducts, debouncedSearch]);

  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [name, setName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [address, setAddress] = useState("");
  const [complement, setComplement] = useState("");
  const [bairro, setBairro] = useState("");
  const [payment, setPayment] = useState("PIX");
  const [obs, setObs] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sent, setSent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [waResult, setWaResult] = useState<{ sent: boolean; fallback: boolean; message: string } | null>(null);

  const updateQty = (id: string, delta: number) => {
    setQuantities((prev) => ({
      ...prev,
      [id]: Math.max(0, (prev[id] || 0) + delta),
    }));
  };

  const selectedItems = dbProducts
    .filter((p) => (quantities[p.id] || 0) > 0)
    .map((p) => ({ id: p.id, name: p.name, qty: quantities[p.id] }));

  const validate = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = "Informe seu nome";
    if (!whatsapp.trim()) e.whatsapp = "Informe seu WhatsApp";
    if (!address.trim()) e.address = "Informe o endereço (rua e número)";
    if (!bairro.trim()) e.bairro = "Informe o bairro";
    if (selectedItems.length === 0) e.items = "Selecione ao menos um produto";
    if (name.trim().length > 100) e.name = "Nome muito longo";
    if (whatsapp.trim().length > 20) e.whatsapp = "WhatsApp inválido";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSaving(true);

    try {
      const addressParts = address.trim().match(/^(.+?),?\s*(\d+\S*)\s*$/);
      const street = addressParts ? addressParts[1] : address.trim();
      const numero = addressParts ? addressParts[2] : "S/N";

      const orderResult = await createSiteOrder({
        customer: { name: name.trim(), phone: whatsapp.trim(), type: "PF" },
        address: { street, number: numero, neighborhood: bairro.trim(), city: "Santo André", state: "SP", complement: complement.trim() || undefined },
        items: selectedItems.map((i) => ({ product_id: i.id, qty: i.qty })),
        notes: `Pagamento: ${payment}. ${obs}`.trim(),
      });

      const pedidoId = orderResult.order_id.slice(0, 8).toUpperCase();

      const msgData: OrderMessageData = {
        tipo: "VAREJO",
        canal: "site",
        cliente: name.trim(),
        telefone: whatsapp.trim(),
        endereco: { rua: street, numero, bairro: bairro.trim(), cidade: "Santo André", uf: "SP", complemento: complement.trim() || undefined },
        obs: `Pagamento: ${payment}. ${obs}`.trim(),
        itens: selectedItems.map((i) => ({ nome: i.name, qtd: i.qty })),
        status: "Novo",
        pedidoId,
      };

      const message = buildOrderMessage(msgData);
      openWhatsApp(message);
      setWaResult({ sent: false, fallback: true, message });

      trackEvent("order_submit", { source: "order_page", items: selectedItems.map(i => i.name), payment });
      setSent(true);
      toast({ title: "Pedido registrado com sucesso!" });
    } catch (err: any) {
      toast({ title: "Erro ao salvar pedido", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleCopy = () => {
    if (waResult?.message) {
      navigator.clipboard.writeText(waResult.message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const SummaryContent = () => (
    <div className="space-y-3">
      <h3 className="font-bold text-lg">Resumo do pedido</h3>
      {selectedItems.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum item selecionado</p>
      ) : (
        <ul className="space-y-1">
          {selectedItems.map((item) => (
            <li key={item.id} className="text-sm">{item.qty}x {item.name}</li>
          ))}
        </ul>
      )}
      {name && <p className="text-sm"><span className="font-medium">Nome:</span> {name}</p>}
      {address && <p className="text-sm"><span className="font-medium">Endereço:</span> {address}{complement ? `, ${complement}` : ""} - {bairro}</p>}
      <p className="text-sm"><span className="font-medium">Pagamento:</span> {payment}</p>
      {obs && <p className="text-sm"><span className="font-medium">Obs:</span> {obs}</p>}
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
                <CardTitle className="text-center text-primary text-xl">
                  {waResult?.fallback
                    ? "✅ Pedido registrado!"
                    : "✅ Pedido registrado e enviado!"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground text-center">
                  {waResult?.fallback
                    ? "Seu pedido foi salvo. Envie a mensagem no WhatsApp para concluir."
                    : "Seu pedido foi salvo e enviado ao WhatsApp."}
                </p>
                {waResult?.message && (
                  <div className="bg-muted p-3 rounded-lg text-sm break-words max-h-48 overflow-y-auto">{waResult.message}</div>
                )}
                {waResult?.fallback && (
                  <div className="space-y-2">
                    <Button variant="outline" className="w-full" onClick={handleCopy}>
                      {copied ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
                      {copied ? "Copiado!" : "Copiar mensagem"}
                    </Button>
                    <Button className="w-full bg-whatsapp hover:bg-whatsapp-dark text-white" asChild>
                      <a href={`https://wa.me/5511940060056?text=${encodeURIComponent(waResult.message)}`} target="_blank" rel="noopener noreferrer">
                        <MessageCircle className="h-4 w-4 mr-1" /> Abrir WhatsApp novamente
                      </a>
                    </Button>
                  </div>
                )}
                <Button variant="ghost" className="w-full" onClick={() => { setSent(false); setQuantities({}); }}>
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
                <CardContent className="space-y-3">
                  <ProductSearchBar value={search} onChange={setSearch} />
                  {productsLoading ? (
                    <div className="space-y-2">
                      {Array.from({ length: 4 }).map((_, i) => (
                        <Skeleton key={i} className="h-12 rounded-lg" />
                      ))}
                    </div>
                  ) : filteredProducts.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      {debouncedSearch ? `Nenhum produto encontrado para "${debouncedSearch}".` : "Nenhum produto disponível."}
                    </p>
                  ) : (
                    filteredProducts.map((p) => (
                      <div key={p.id} className="flex items-center justify-between bg-muted/50 rounded-lg px-3 py-2">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          {p.image_url ? (
                            <img src={p.image_url} alt={p.name} className="h-8 w-8 rounded object-cover flex-shrink-0" loading="lazy" />
                          ) : (
                            <Droplets className="h-5 w-5 text-primary flex-shrink-0" />
                          )}
                          <div className="min-w-0">
                            <span className="text-sm font-medium block truncate">{p.name}</span>
                            {p.price_text && <span className="text-xs text-muted-foreground">({p.price_text})</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={() => updateQty(p.id, -1)} className="h-8 w-8 rounded-full border flex items-center justify-center hover:bg-muted transition-colors" aria-label={`Diminuir ${p.name}`}>
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="w-6 text-center font-semibold">{quantities[p.id] || 0}</span>
                          <button onClick={() => updateQty(p.id, 1)} className="h-8 w-8 rounded-full border flex items-center justify-center hover:bg-muted transition-colors" aria-label={`Aumentar ${p.name}`}>
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                  {errors.items && <p className="text-xs text-destructive">{errors.items}</p>}
                </CardContent>
              </Card>

              {/* Customer info */}
              <Card>
                <CardHeader><CardTitle className="text-lg">Seus dados</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <Input placeholder="Nome completo" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} />
                    {errors.name && <p className="text-xs text-destructive mt-1">{errors.name}</p>}
                  </div>
                  <div>
                    <Input placeholder="WhatsApp" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} type="tel" maxLength={20} />
                    {errors.whatsapp && <p className="text-xs text-destructive mt-1">{errors.whatsapp}</p>}
                  </div>
                </CardContent>
              </Card>

              {/* Delivery */}
              <Card>
                <CardHeader><CardTitle className="text-lg">Entrega</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <Input placeholder="Rua e número" value={address} onChange={(e) => setAddress(e.target.value)} maxLength={300} />
                    {errors.address && <p className="text-xs text-destructive mt-1">{errors.address}</p>}
                  </div>
                  <div>
                    <Input placeholder="Bairro" value={bairro} onChange={(e) => setBairro(e.target.value)} maxLength={100} />
                    {errors.bairro && <p className="text-xs text-destructive mt-1">{errors.bairro}</p>}
                  </div>
                  <Input placeholder="Complemento (opcional)" value={complement} onChange={(e) => setComplement(e.target.value)} maxLength={100} />
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
                        onClick={() => setPayment(m)}
                        className={`py-2 px-4 rounded-lg border text-sm font-medium transition-colors ${payment === m ? "bg-primary text-primary-foreground border-primary" : "bg-card hover:bg-muted"}`}
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
                    value={obs}
                    onChange={(e) => setObs(e.target.value)}
                    maxLength={500}
                  />
                </CardContent>
              </Card>

              {/* Actions */}
              <Button className="w-full bg-whatsapp hover:bg-whatsapp-dark text-white font-semibold" onClick={handleSubmit} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <MessageCircle className="h-4 w-4 mr-2" />}
                {saving ? "Salvando..." : "Enviar pedido"}
              </Button>
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
