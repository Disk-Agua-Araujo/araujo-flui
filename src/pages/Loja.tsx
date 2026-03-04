import { useState } from "react";
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
import { OrderLabel, type LabelData } from "@/components/OrderLabel";
import {
  ShoppingCart, Plus, Minus, Trash2, MessageCircle, Droplets, Sparkles, Archive, Zap, MapPin, AlertTriangle, Check, Copy, Loader2,
} from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { useRetailProducts } from "@/hooks/use-products";
import { buildOrderMessage, sendOrderToDiskWhatsApp } from "@/services/whatsapp";
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

  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [rua, setRua] = useState("");
  const [numero, setNumero] = useState("");
  const [bairro, setBairro] = useState("");
  const [complemento, setComplemento] = useState("");
  const [pagamento, setPagamento] = useState("");
  const [obs, setObs] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [labelData, setLabelData] = useState<LabelData | null>(null);
  const [geoWarning, setGeoWarning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [waResult, setWaResult] = useState<{ sent: boolean; fallback: boolean; message: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome || !whatsapp || !rua || !numero || !bairro) {
      toast({ title: "Preencha todos os campos obrigatórios", variant: "destructive" });
      return;
    }
    if (!pagamento) {
      toast({ title: "Selecione a forma de pagamento", variant: "destructive" });
      return;
    }

    setSaving(true);

    const fullAddr = `${rua}, ${numero} - ${bairro}, Santo André - SP`;
    const geoResult = await validateDeliveryDistance(fullAddr);
    if (geoResult.ok === false) {
      if (geoResult.reason === "too_far") {
        toast({ title: "Fora da área de entrega", description: `Entregamos até ${MAX_DELIVERY_KM}km.`, variant: "destructive" });
        setSaving(false);
        return;
      }
      if (geoResult.reason === "no_geocoding") {
        setGeoWarning(true);
      }
    }

    try {
      // 1. Save to database
      const orderResult = await createSiteOrder({
        customer: { name: nome, phone: whatsapp, type: "PF" },
        address: { street: rua, number: numero, neighborhood: bairro, city: "Santo André", state: "SP", complement: complemento },
        items: items.map((i) => ({ product_id: i.product.id, qty: i.qty })),
        notes: `Pagamento: ${pagamento}. ${obs}`.trim(),
      });

      const pedidoId = orderResult.order_id.slice(0, 8).toUpperCase();
      const itens = items.map((i) => ({ nome: i.product.name, qtd: i.qty }));

      // 2. Send to WhatsApp
      const msgData = {
        tipo: "VAREJO" as const,
        canal: "site" as const,
        cliente: nome,
        telefone: whatsapp,
        endereco: { rua, numero, bairro, cidade: "Santo André", uf: "SP", complemento },
        obs: `Pagamento: ${pagamento}. ${obs}`,
        itens,
        status: "Novo",
        pedidoId,
      };

      const result = await sendOrderToDiskWhatsApp(msgData);
      setWaResult(result);

      setLabelData({ pedidoId, cliente: nome, endereco: fullAddr, complemento, itens });

      trackEvent("order_created", { tipo: "varejo", canal: "site", pedidoId });
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
    if (waResult?.message) {
      navigator.clipboard.writeText(waResult.message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (submitted && labelData) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-1 container py-8 max-w-lg">
          <Card>
            <CardHeader>
              <CardTitle className="text-center">
                <Badge className="bg-whatsapp text-white mb-2">
                  {waResult?.fallback ? "Pedido registrado!" : "Pedido enviado!"}
                </Badge>
                <br />
                {waResult?.fallback
                  ? "Pedido registrado. Envie no WhatsApp com 1 clique."
                  : "Pedido registrado e enviado ao WhatsApp"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {geoWarning && (
                <div className="flex items-start gap-2 bg-accent/10 rounded-md p-3 text-sm">
                  <AlertTriangle className="h-5 w-5 text-accent shrink-0 mt-0.5" />
                  <p>Não foi possível validar a distância. Confirme com a equipe.</p>
                </div>
              )}
              <OrderLabel data={labelData} />
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
                    <div><Label htmlFor="c-nome">Nome *</Label><Input id="c-nome" value={nome} onChange={(e) => setNome(e.target.value)} required /></div>
                    <div><Label htmlFor="c-wa">WhatsApp *</Label><Input id="c-wa" type="tel" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} required /></div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="col-span-2"><Label htmlFor="c-rua">Rua *</Label><Input id="c-rua" value={rua} onChange={(e) => setRua(e.target.value)} required /></div>
                      <div><Label htmlFor="c-num">Nº *</Label><Input id="c-num" value={numero} onChange={(e) => setNumero(e.target.value)} required /></div>
                    </div>
                    <div><Label htmlFor="c-bairro">Bairro *</Label><Input id="c-bairro" value={bairro} onChange={(e) => setBairro(e.target.value)} required /></div>
                    <div><Label htmlFor="c-comp">Complemento</Label><Input id="c-comp" value={complemento} onChange={(e) => setComplemento(e.target.value)} /></div>
                    <div>
                      <Label>Pagamento *</Label>
                      <Select value={pagamento} onValueChange={setPagamento}>
                        <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>{paymentOptions.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div><Label htmlFor="c-obs">Observações</Label><Textarea id="c-obs" value={obs} onChange={(e) => setObs(e.target.value)} rows={2} /></div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" /> Entregamos até {MAX_DELIVERY_KM}km</div>
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

        {isLoading ? (
          <p className="text-center text-muted-foreground py-12">Carregando produtos...</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {retailProducts.map((p) => (
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
