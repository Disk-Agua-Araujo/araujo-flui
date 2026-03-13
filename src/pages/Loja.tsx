import { useState, useMemo, useRef } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { MobileBottomBar } from "@/components/MobileBottomBar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FulfillmentToggle } from "@/components/FulfillmentToggle";
import {
  ShoppingCart, Plus, Minus, Trash2, MessageCircle, Droplets, Sparkles, Archive, Zap, MapPin, Check, Copy, Loader2,
} from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { useRetailProducts } from "@/hooks/use-products";
import { useCategories, type DbCategory } from "@/hooks/use-categories";
import { buildOrderMessage, openWhatsApp } from "@/services/whatsapp";
import { createSiteOrder } from "@/services/orders";
import { validateDeliveryDistance, MAX_DELIVERY_KM } from "@/lib/geo";
import { trackEvent } from "@/hooks/use-analytics";
import { useToast } from "@/hooks/use-toast";

const iconMap: Record<string, React.ReactNode> = {
  droplets: <Droplets className="h-7 w-7 text-primary" />,
  sparkles: <Sparkles className="h-7 w-7 text-primary" />,
  archive: <Archive className="h-7 w-7 text-primary" />,
  zap: <Zap className="h-7 w-7 text-primary" />,
};

const paymentOptions = ["PIX", "Dinheiro", "Cartão"];

export default function Loja() {
  const { items, addItem, removeItem, updateQty, clearCart, totalItems } = useCart();
  const { toast } = useToast();
  const { data: retailProducts = [], isLoading } = useRetailProducts();
  const { data: categories = [] } = useCategories();
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [rua, setRua] = useState("");
  const [numero, setNumero] = useState("");
  const [bairro, setBairro] = useState("");
  const [complemento, setComplemento] = useState("");
  const [pagamento, setPagamento] = useState("");
  const [obs, setObs] = useState("");
  const [fulfillmentType, setFulfillmentType] = useState<"delivery" | "pickup">("delivery");
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [waMessage, setWaMessage] = useState("");
  const [copied, setCopied] = useState(false);
  const [orderSummary, setOrderSummary] = useState<{
    pedidoId: string;
    items: { name: string; qty: number }[];
    address: string;
  } | null>(null);

  // Group products by category
  const grouped = useMemo(() => {
    const groups: { category: DbCategory | null; products: typeof retailProducts }[] = [];
    const sortedCats = [...categories].sort((a, b) => a.sort_order - b.sort_order);

    for (const cat of sortedCats) {
      const catProducts = retailProducts.filter((p) => (p as any).category_id === cat.id);
      if (catProducts.length > 0) {
        groups.push({ category: cat, products: catProducts });
      }
    }

    const uncategorized = retailProducts.filter((p) => !(p as any).category_id || !categories.some((c) => c.id === (p as any).category_id));
    if (uncategorized.length > 0) {
      groups.push({ category: null, products: uncategorized });
    }

    return groups;
  }, [retailProducts, categories]);

  const activeTabs = grouped.map((g) => ({
    id: g.category?.slug ?? "outros",
    label: g.category?.name ?? "Outros",
  }));

  const scrollTo = (slug: string) => {
    sectionRefs.current[slug]?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome || !whatsapp) {
      toast({ title: "Preencha nome e WhatsApp", variant: "destructive" });
      return;
    }
    if (fulfillmentType === "delivery" && (!rua || !numero || !bairro)) {
      toast({ title: "Preencha o endereço completo para entrega", variant: "destructive" });
      return;
    }
    if (!pagamento) {
      toast({ title: "Selecione a forma de pagamento", variant: "destructive" });
      return;
    }

    setSaving(true);

    if (fulfillmentType === "delivery") {
      const fullAddr = `${rua}, ${numero} - ${bairro}, Santo André - SP`;
      const geoResult = await validateDeliveryDistance(fullAddr);
      if (geoResult.ok === false && geoResult.reason === "too_far") {
        toast({ title: "Fora da área de entrega", description: `Entregamos até ${MAX_DELIVERY_KM}km.`, variant: "destructive" });
        setSaving(false);
        return;
      }
    }

    try {
      const orderResult = await createSiteOrder({
        customer: { name: nome, phone: whatsapp, type: "PF" },
        address: { street: rua, number: numero, neighborhood: bairro, city: "Santo André", state: "SP", complement: complemento },
        items: items.map((i) => ({ product_id: i.product.id, qty: i.qty })),
        notes: `Pagamento: ${pagamento}. ${obs}`.trim(),
        fulfillment_type: fulfillmentType,
      });

      const pedidoId = orderResult.order_id.slice(0, 8).toUpperCase();
      const itens = items.map((i) => ({ nome: i.product.name, qtd: i.qty }));

      const message = buildOrderMessage({
        tipo: "VAREJO",
        canal: "site",
        cliente: nome,
        telefone: whatsapp,
        endereco: fulfillmentType === "delivery" ? { rua, numero, bairro, cidade: "Santo André", uf: "SP", complemento } : undefined,
        obs: `Pagamento: ${pagamento}. ${obs}`,
        itens,
        status: "Novo",
        pedidoId,
        fulfillmentType,
      });

      openWhatsApp(message);
      setWaMessage(message);

      setOrderSummary({
        pedidoId,
        items: items.map((i) => ({ name: i.product.name, qty: i.qty })),
        address: fulfillmentType === "pickup" ? "Retirada na loja" : `${rua}, ${numero} - ${bairro}, Santo André - SP`,
      });

      trackEvent("order_created", { tipo: "varejo", canal: "site", pedidoId, fulfillmentType });
      setSubmitted(true);
      clearCart();
      toast({ title: "Pedido registrado com sucesso!" });
    } catch (err: any) {
      toast({ title: "Erro ao salvar pedido", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleCopy = () => {
    if (waMessage) {
      navigator.clipboard.writeText(waMessage);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (submitted && orderSummary) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-1 container py-8 max-w-lg">
          <Card>
            <CardHeader>
              <CardTitle className="text-center">
                <Badge className="bg-whatsapp text-white mb-2">Pedido registrado!</Badge>
                <br />Pedido registrado e enviado ao WhatsApp
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-muted rounded-lg p-4 space-y-2 text-sm">
                <p className="font-mono text-xs text-muted-foreground">Pedido #{orderSummary.pedidoId}</p>
                <ul className="space-y-1">
                  {orderSummary.items.map((i, idx) => (
                    <li key={idx}>{i.qty}x {i.name}</li>
                  ))}
                </ul>
                <p className="text-muted-foreground">{orderSummary.address}</p>
              </div>

              <div className="space-y-2">
                <Button variant="outline" className="w-full" onClick={handleCopy}>
                  {copied ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
                  {copied ? "Copiado!" : "Copiar mensagem"}
                </Button>
                <Button className="w-full bg-whatsapp hover:bg-whatsapp-dark text-white" asChild>
                  <a href={`https://wa.me/5511940060056?text=${encodeURIComponent(waMessage)}`} target="_blank" rel="noopener noreferrer">
                    <MessageCircle className="h-4 w-4 mr-1" /> Abrir WhatsApp novamente
                  </a>
                </Button>
              </div>
              <Button className="w-full" variant="ghost" onClick={() => setSubmitted(false)}>Fazer outro pedido</Button>
            </CardContent>
          </Card>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 container py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">Loja</h1>
            <p className="text-muted-foreground">Selecione seus produtos e finalize no WhatsApp.</p>
          </div>
          <Sheet open={checkoutOpen} onOpenChange={setCheckoutOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" className="relative">
                <ShoppingCart className="h-5 w-5" />
                {totalItems > 0 && (
                  <Badge className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center bg-accent text-accent-foreground text-xs">
                    {totalItems}
                  </Badge>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent className="w-full sm:max-w-md overflow-y-auto">
              <SheetHeader><SheetTitle>Carrinho ({totalItems} itens)</SheetTitle></SheetHeader>
              {items.length === 0 ? (
                <p className="text-muted-foreground py-8 text-center">Seu carrinho está vazio.</p>
              ) : (
                <div className="mt-4 space-y-3">
                  {items.map((item) => (
                    <div key={item.product.id} className="flex items-center gap-3 border rounded-md p-3">
                      <div className="flex-1">
                        <p className="font-medium text-sm">{item.product.name}</p>
                        <p className="text-xs text-muted-foreground">{item.product.priceText}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => updateQty(item.product.id, item.qty - 1)}><Minus className="h-3 w-3" /></Button>
                        <span className="w-6 text-center text-sm">{item.qty}</span>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => updateQty(item.product.id, item.qty + 1)}><Plus className="h-3 w-3" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeItem(item.product.id)}><Trash2 className="h-3 w-3" /></Button>
                      </div>
                    </div>
                  ))}
                  <form onSubmit={handleCheckout} className="space-y-3 pt-4 border-t">
                    <div>
                      <Label className="text-xs font-medium mb-1 block">Tipo de atendimento</Label>
                      <FulfillmentToggle value={fulfillmentType} onChange={setFulfillmentType} />
                    </div>
                    <div><Label htmlFor="c-nome">Nome *</Label><Input id="c-nome" value={nome} onChange={(e) => setNome(e.target.value)} required /></div>
                    <div><Label htmlFor="c-wa">WhatsApp *</Label><Input id="c-wa" type="tel" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} required /></div>
                    {fulfillmentType === "delivery" && (
                      <>
                        <div className="grid grid-cols-3 gap-2">
                          <div className="col-span-2"><Label htmlFor="c-rua">Rua *</Label><Input id="c-rua" value={rua} onChange={(e) => setRua(e.target.value)} required /></div>
                          <div><Label htmlFor="c-num">Nº *</Label><Input id="c-num" value={numero} onChange={(e) => setNumero(e.target.value)} required /></div>
                        </div>
                        <div><Label htmlFor="c-bairro">Bairro *</Label><Input id="c-bairro" value={bairro} onChange={(e) => setBairro(e.target.value)} required /></div>
                        <div><Label htmlFor="c-comp">Complemento</Label><Input id="c-comp" value={complemento} onChange={(e) => setComplemento(e.target.value)} /></div>
                      </>
                    )}
                    <div>
                      <Label>Pagamento *</Label>
                      <Select value={pagamento} onValueChange={setPagamento}>
                        <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>{paymentOptions.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div><Label htmlFor="c-obs">Observações</Label><Textarea id="c-obs" value={obs} onChange={(e) => setObs(e.target.value)} rows={2} /></div>
                    {fulfillmentType === "delivery" && (
                      <div className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" /> Entregamos até {MAX_DELIVERY_KM}km</div>
                    )}
                    <Button type="submit" className="w-full bg-whatsapp hover:bg-whatsapp-dark text-white" disabled={saving}>
                      {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <MessageCircle className="h-4 w-4 mr-1" />}
                      {saving ? "Salvando..." : "Finalizar pedido"}
                    </Button>
                  </form>
                </div>
              )}
            </SheetContent>
          </Sheet>
        </div>

        {/* Category tabs */}
        {activeTabs.length > 1 && (
          <div className="flex gap-2 flex-wrap mb-6">
            {activeTabs.map((tab) => (
              <Button
                key={tab.id}
                variant="outline"
                size="sm"
                onClick={() => scrollTo(tab.id)}
                className="rounded-full"
              >
                {tab.label}
              </Button>
            ))}
          </div>
        )}

        {isLoading ? (
          <p className="text-center text-muted-foreground py-12">Carregando produtos...</p>
        ) : (
          <div className="space-y-10">
            {grouped.map((group) => {
              const slug = group.category?.slug ?? "outros";
              return (
                <div key={slug} ref={(el) => { sectionRefs.current[slug] = el; }}>
                  <h2 className="text-2xl font-bold mb-4 scroll-mt-24">
                    {group.category?.name ?? "Outros"}
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {group.products.map((p) => (
                      <Card key={p.id} className="flex flex-col">
                        <CardHeader className="flex-row items-center gap-3">
                          {iconMap[p.icon ?? "droplets"] || <Droplets className="h-7 w-7 text-primary" />}
                          <CardTitle className="text-lg">{p.name}</CardTitle>
                        </CardHeader>
                        <CardContent className="flex-1">
                          <p className="text-sm text-muted-foreground">{p.description}</p>
                          <p className="mt-2 font-semibold text-primary">{p.price_text}</p>
                        </CardContent>
                        <CardFooter>
                          <Button className="w-full" onClick={() => { addItem({ id: p.id, name: p.name, description: p.description ?? "", type: p.type, icon: p.icon ?? "droplets", active: p.active, priceText: p.price_text ?? "" }); toast({ title: `${p.name} adicionado ao carrinho` }); }}>
                            <Plus className="h-4 w-4 mr-1" /> Adicionar
                          </Button>
                        </CardFooter>
                      </Card>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {totalItems > 0 && (
          <div className="fixed bottom-16 left-0 right-0 md:hidden px-4 pb-2 z-40">
            <Button className="w-full bg-primary shadow-lg" onClick={() => setCheckoutOpen(true)}>
              <ShoppingCart className="h-4 w-4 mr-2" /> Ver carrinho ({totalItems})
            </Button>
          </div>
        )}
      </main>
      <Footer />
      <MobileBottomBar />
    </div>
  );
}
