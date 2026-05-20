import { useState, useMemo } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { MobileBottomBar } from "@/components/MobileBottomBar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { FulfillmentToggle } from "@/components/FulfillmentToggle";
import { ProductSearchBar } from "@/components/ProductSearchBar";
import { ProductImage } from "@/components/ProductImage";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, MessageCircle, MapPin, Minus, Plus, Loader2, Copy, Check } from "lucide-react";
import { PaymentIcon } from "@/components/PaymentIcon";
import { cn } from "@/lib/utils";
import { maskCnpj, isValidCnpj } from "@/lib/cnpj";
import { validateDeliveryDistance, MAX_DELIVERY_KM } from "@/lib/geo";
import { buildOrderMessage, openWhatsApp } from "@/services/whatsapp";
import { createSiteOrder } from "@/services/orders";
import { useProducts } from "@/hooks/use-products";
import { trackEvent } from "@/hooks/use-analytics";
import { useToast } from "@/hooks/use-toast";
import { useDebounce } from "@/hooks/use-debounce";
import { normalize } from "@/lib/normalize";
import { getMinDeliveryDate, isDeliveryDateDisabled } from "@/lib/deliveryRules";
import { Seo } from "@/components/Seo";

const horarios = [
  "08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00",
];

type PaymentMethod = "cash" | "pix" | "card";

const PAYMENT_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: "cash", label: "Dinheiro" },
  { value: "pix", label: "PIX" },
  { value: "card", label: "Cartão" },
];

const paymentLabel = (v: PaymentMethod) =>
  PAYMENT_OPTIONS.find((o) => o.value === v)?.label ?? v;

export default function PedidoEmpresa() {
  const { toast } = useToast();
  const { data: availableProducts = [], isLoading: productsLoading } = useProducts();
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [waMessage, setWaMessage] = useState("");
  const [copied, setCopied] = useState(false);
  const [fulfillmentType, setFulfillmentType] = useState<"delivery" | "pickup">("delivery");
  const [orderSummary, setOrderSummary] = useState<{
    pedidoId: string;
    items: { name: string; qty: number }[];
    address: string;
    entregaData?: string;
    entregaHora?: string;
  } | null>(null);

  const [cnpj, setCnpj] = useState("");
  const [empresa, setEmpresa] = useState("");
  const [telefone, setTelefone] = useState("");
  const [rua, setRua] = useState("");
  const [numero, setNumero] = useState("");
  const [bairro, setBairro] = useState("");
  const [cidade, setCidade] = useState("Santo André");
  const [cep, setCep] = useState("");
  const [complemento, setComplemento] = useState("");
  const [obs, setObs] = useState("");
  const [date, setDate] = useState<Date>();
  const [hora, setHora] = useState("");
  const [qtys, setQtys] = useState<Record<string, number>>({});
  const [payment, setPayment] = useState<PaymentMethod | null>(null);

  // Search
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 250);

  const filteredProducts = useMemo(() => {
    if (!debouncedSearch) return availableProducts;
    const q = normalize(debouncedSearch);
    return availableProducts.filter((p) => normalize(p.name).includes(q));
  }, [availableProducts, debouncedSearch]);

  const updateQty = (id: string, delta: number) => {
    setQtys((prev) => ({ ...prev, [id]: Math.max(0, (prev[id] || 0) + delta) }));
  };

  const selectedItems = Object.entries(qtys)
    .filter(([, q]) => q > 0)
    .map(([id, qty]) => ({
      productId: id,
      nome: availableProducts.find((p) => p.id === id)?.name || id,
      qtd: qty,
    }));

  const handleCopy = () => {
    if (waMessage) {
      navigator.clipboard.writeText(waMessage);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidCnpj(cnpj)) {
      toast({ title: "CNPJ inválido", description: "Verifique o número do CNPJ.", variant: "destructive" });
      return;
    }
    if (!empresa || !telefone) {
      toast({ title: "Campos obrigatórios", description: "Preencha nome da empresa e telefone.", variant: "destructive" });
      return;
    }
    if (fulfillmentType === "delivery" && (!rua || !numero || !bairro || !cidade)) {
      toast({ title: "Campos obrigatórios", description: "Preencha todos os campos de endereço para entrega.", variant: "destructive" });
      return;
    }
    if (selectedItems.length === 0) {
      toast({ title: "Selecione pelo menos um produto", variant: "destructive" });
      return;
    }
    if (!date) {
      toast({ title: "Selecione a data de entrega", variant: "destructive" });
      return;
    }
    if (isDeliveryDateDisabled(date)) {
      toast({ title: "Data de entrega inválida", description: "Pedidos realizados após as 14h só podem ser agendados para o próximo dia útil.", variant: "destructive" });
      return;
    }
    if (!hora) {
      toast({ title: "Selecione o horário de entrega", variant: "destructive" });
      return;
    }
    if (!payment) {
      toast({ title: "Selecione a forma de pagamento.", variant: "destructive" });
      return;
    }

    setSaving(true);

    if (fulfillmentType === "delivery") {
      const fullAddr = `${rua}, ${numero} - ${bairro}, ${cidade} - SP`;
      const geoResult = await validateDeliveryDistance(fullAddr);
      if (geoResult.ok === false && geoResult.reason === "too_far") {
        toast({ title: "Fora da área de entrega", description: `Entregamos até ${MAX_DELIVERY_KM}km.`, variant: "destructive" });
        setSaving(false);
        return;
      }
    }

    try {
      const entregaData = format(date, "yyyy-MM-dd");
      const orderResult = await createSiteOrder({
        customer: { name: empresa, phone: telefone, type: "PJ", cnpj },
        address: { street: rua, number: numero, neighborhood: bairro, city: cidade, state: "SP", complement: complemento, zip: cep },
        items: selectedItems.map((i) => ({ product_id: i.productId, qty: i.qtd })),
        notes: obs ? `Pagamento: ${paymentLabel(payment)}. ${obs}` : `Pagamento: ${paymentLabel(payment)}`,
        delivery_date: entregaData,
        delivery_time: hora,
        fulfillment_type: fulfillmentType,
      });

      const pedidoId = orderResult.order_id.slice(0, 8).toUpperCase();
      const entregaDataFormatted = format(date, "dd/MM/yyyy");

      const message = buildOrderMessage({
        tipo: "EMPRESA",
        canal: "site",
        cliente: empresa,
        cnpj,
        telefone,
        endereco: fulfillmentType === "delivery" ? { rua, numero, bairro, cidade, uf: "SP", complemento } : undefined,
        obs,
        itens: selectedItems.map((i) => ({ nome: i.nome, qtd: i.qtd })),
        entregaData: entregaDataFormatted,
        entregaHora: hora,
        status: "Novo",
        pedidoId,
        fulfillmentType,
        formaPagamento: paymentLabel(payment),
      });

      openWhatsApp(message);
      setWaMessage(message);

      setOrderSummary({
        pedidoId,
        items: selectedItems.map((i) => ({ name: i.nome, qty: i.qtd })),
        address: fulfillmentType === "pickup" ? "Retirada na loja" : `${rua}, ${numero} - ${bairro}, ${cidade}/SP`,
        entregaData: entregaDataFormatted,
        entregaHora: hora,
      });

      trackEvent("order_created", { tipo: "empresa", canal: "site", pedidoId, fulfillmentType });
      setSubmitted(true);
      toast({ title: "Pedido registrado com sucesso!" });
    } catch (err: any) {
      toast({ title: "Erro ao salvar pedido", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (submitted && orderSummary) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Seo title={"Pedido para Empresas | Disk Água Araujo"} description={"Canal corporativo para pedidos de água mineral. Atendimento PJ com agendamento e nota fiscal."} path={"/pedido-empresa"} />
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
                {orderSummary.entregaData && (
                  <p className="text-muted-foreground">Entrega: {orderSummary.entregaData}{orderSummary.entregaHora ? ` às ${orderSummary.entregaHora}` : ""}</p>
                )}
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
              <Button className="w-full" variant="ghost" onClick={() => { setSubmitted(false); setQtys({}); setPayment(null); }}>Novo pedido</Button>
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
      <main className="flex-1 container py-8 max-w-2xl">
        <h1 className="text-3xl font-bold mb-2">Pedido para Empresas</h1>
        <p className="text-muted-foreground mb-6">Preencha os dados abaixo para agendar seu pedido.</p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-lg">Tipo de atendimento</CardTitle></CardHeader>
            <CardContent>
              <FulfillmentToggle value={fulfillmentType} onChange={setFulfillmentType} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-lg">Dados da Empresa</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div><Label htmlFor="cnpj">CNPJ *</Label><Input id="cnpj" placeholder="00.000.000/0000-00" value={cnpj} onChange={(e) => setCnpj(maskCnpj(e.target.value))} maxLength={18} required /></div>
                <div><Label htmlFor="empresa">Nome da empresa *</Label><Input id="empresa" value={empresa} onChange={(e) => setEmpresa(e.target.value)} required /></div>
              </div>
              <div><Label htmlFor="telefone">Telefone / WhatsApp *</Label><Input id="telefone" type="tel" value={telefone} onChange={(e) => setTelefone(e.target.value)} required /></div>
            </CardContent>
          </Card>

          {fulfillmentType === "delivery" && (
            <Card>
              <CardHeader><CardTitle className="text-lg flex items-center gap-2"><MapPin className="h-5 w-5" /> Endereço de entrega</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-2"><Label htmlFor="rua">Rua *</Label><Input id="rua" value={rua} onChange={(e) => setRua(e.target.value)} required /></div>
                  <div><Label htmlFor="numero">Número *</Label><Input id="numero" value={numero} onChange={(e) => setNumero(e.target.value)} required /></div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div><Label htmlFor="bairro">Bairro *</Label><Input id="bairro" value={bairro} onChange={(e) => setBairro(e.target.value)} required /></div>
                  <div><Label htmlFor="cidade">Cidade *</Label><Input id="cidade" value={cidade} onChange={(e) => setCidade(e.target.value)} required /></div>
                  <div><Label htmlFor="cep">CEP</Label><Input id="cep" value={cep} onChange={(e) => setCep(e.target.value)} /></div>
                </div>
                <div><Label htmlFor="complemento">Complemento</Label><Input id="complemento" value={complemento} onChange={(e) => setComplemento(e.target.value)} /></div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground"><MapPin className="h-4 w-4 text-primary" /> Entregamos até {MAX_DELIVERY_KM}km (Santo André e região)</div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader><CardTitle className="text-lg">Produtos</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <ProductSearchBar value={search} onChange={setSearch} />
              {productsLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-14 rounded-md" />
                  ))}
                </div>
              ) : filteredProducts.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  {debouncedSearch ? `Nenhum produto encontrado para "${debouncedSearch}".` : "Nenhum produto disponível."}
                </p>
              ) : (
                filteredProducts.map((p) => (
                  <div key={p.id} className="flex items-center justify-between border rounded-md p-3">
                    <div className="flex items-center gap-2">
                      <ProductImage imageUrl={p.image_url} productName={p.name} size="sm" className="h-10 w-10" />
                      <div>
                        <p className="font-medium text-sm">{p.name}</p>
                        <p className="text-xs text-muted-foreground">{p.price_text}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={() => updateQty(p.id, -1)}><Minus className="h-3 w-3" /></Button>
                      <span className="w-8 text-center font-medium">{qtys[p.id] || 0}</span>
                      <Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={() => updateQty(p.id, 1)}><Plus className="h-3 w-3" /></Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-lg">Agendamento</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Data de entrega *</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {date ? format(date, "dd/MM/yyyy") : "Selecione a data"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={date} onSelect={setDate} disabled={(d) => isDeliveryDateDisabled(d)} locale={ptBR} className="p-3 pointer-events-auto" />
                    </PopoverContent>
                  </Popover>
                  <p className="text-xs text-muted-foreground mt-1">
                    Após 14h, só dias úteis a partir de amanhã.
                  </p>
                </div>
                <div>
                  <Label>Horário de entrega *</Label>
                  <Select value={hora} onValueChange={setHora}>
                    <SelectTrigger><SelectValue placeholder="Horário" /></SelectTrigger>
                    <SelectContent>{horarios.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Payment method */}
          <Card>
            <CardHeader><CardTitle className="text-lg">Forma de pagamento *</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-2">
                {PAYMENT_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setPayment(opt.value)}
                    className={`flex flex-col items-center gap-1 rounded-lg border-2 px-2 py-2.5 text-sm font-medium transition-colors ${
                      payment === opt.value
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-primary/30 bg-background text-foreground hover:border-primary/60"
                    }`}
                  >
                    <PaymentIcon method={opt.value} size={22} />
                    <span className="text-xs">{opt.label}</span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          <div>
            <Label htmlFor="obs">Observações</Label>
            <Textarea id="obs" value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Instruções especiais, ponto de referência, etc." />
          </div>

          <Button type="submit" size="lg" className="w-full bg-whatsapp hover:bg-whatsapp-dark text-white" disabled={saving}>
            {saving ? <Loader2 className="h-5 w-5 mr-2 animate-spin" /> : <MessageCircle className="h-5 w-5 mr-2" />}
            {saving ? "Salvando..." : "Agendar pedido"}
          </Button>
        </form>
      </main>
      <Footer />
      <MobileBottomBar />
    </div>
  );
}
