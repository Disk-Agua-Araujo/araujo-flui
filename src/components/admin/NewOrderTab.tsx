import { useEffect, useState, useRef, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { OrderLabel, type LabelData } from "@/components/OrderLabel";
import { FulfillmentToggle } from "@/components/FulfillmentToggle";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, Save, Search, X, Loader2 } from "lucide-react";
import { QuantityInput } from "@/components/ui/quantity-input";
import { PaymentIcon } from "@/components/PaymentIcon";
import { SplitPaymentSection, emptySplitPayment, validateSplitPayment, splitPaymentToPayload, type SplitPaymentValue } from "@/components/admin/SplitPaymentSection";
import { cn } from "@/lib/utils";
import { maskCnpj, isValidCnpj } from "@/lib/cnpj";
import { lookupCep } from "@/lib/cep";
import { useToast } from "@/hooks/use-toast";
import { trackEvent } from "@/hooks/use-analytics";
import { adminApi, type AdminProductRow, type AdminCustomerRow, type AdminCategoryRow } from "@/services/admin-api";
import { useDebounce } from "@/hooks/use-debounce";
import { getMinDeliveryDate, isDeliveryDateDisabled } from "@/lib/deliveryRules";
import { normalize } from "@/lib/normalize";

const horarios = ["08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00"];
const canais = [
  { value: "ligacao", label: "Ligação" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "admin", label: "Cadastro interno" },
] as const;

const PREFILL_KEY = "admin-new-order-customer";

// Dentro da categoria Carvão a ordem útil na hora de separar o pedido é varejo
// antes do atacado e do menor para o maior peso, não a ordem de cadastro.
const SLUG_CARVAO = "carvao";

type CustomerAddress = NonNullable<AdminCustomerRow["addresses"]>[number];

function maskCep(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  return digits.length <= 5 ? digits : `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** "12,5" ou "12.50" vira 12.5; vazio ou inválido vira null. */
function parsePrice(value: string | undefined): number | null {
  if (!value?.trim()) return null;
  const n = Number(value.replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** Data local no formato aaaa-mm-dd, sem passar por UTC. */
function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function addDaysISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

export function NewOrderTab() {
  const { toast } = useToast();
  const [searchParams] = useSearchParams();

  const [products, setProducts] = useState<AdminProductRow[]>([]);
  const [categories, setCategories] = useState<AdminCategoryRow[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [labelData, setLabelData] = useState<LabelData | null>(null);
  const [saving, setSaving] = useState(false);

  // Customer search
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<AdminCustomerRow[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [customerAddresses, setCustomerAddresses] = useState<CustomerAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debouncedQuery = useDebounce(searchQuery, 300);

  const [canal, setCanal] = useState<(typeof canais)[number]["value"]>("ligacao");
  const [tipo, setTipo] = useState<"PF" | "PJ">("PF");
  const [fulfillmentType, setFulfillmentType] = useState<"delivery" | "pickup">("delivery");
  const [nome, setNome] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [rua, setRua] = useState("");
  const [numero, setNumero] = useState("");
  const [bairro, setBairro] = useState("");
  const [cidade, setCidade] = useState("Santo André");
  const [complemento, setComplemento] = useState("");
  const [cep, setCep] = useState("");
  const [ibge, setIbge] = useState("");
  const [cepLoading, setCepLoading] = useState(false);
  const [obs, setObs] = useState("");
  const [date, setDate] = useState<Date>();
  const [hora, setHora] = useState("");
  const [qtys, setQtys] = useState<Record<string, number>>({});
  // Preço unitário digitado por produto. Começa com o preço do cadastro e pode
  // ser trocado no pedido (galão 20L, atacado, negociação).
  const [prices, setPrices] = useState<Record<string, string>>({});
  // Enquanto ninguém mexe no total, ele acompanha a soma dos itens.
  const [totalTouched, setTotalTouched] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const debouncedProductSearch = useDebounce(productSearch, 250);
  const [payment, setPayment] = useState<SplitPaymentValue>(emptySplitPayment());
  const [aPrazo, setAPrazo] = useState(false);
  const [dueDate, setDueDate] = useState("");

  // Botões de filtro: Todos e as categorias que têm produto cadastrado.
  const productFilters = useMemo(() => {
    const comProduto = categories.filter((c) => products.some((p) => p.category_id === c.id));
    return [{ id: "all", label: "Todos" }, ...comProduto.map((c) => ({ id: c.id, label: c.name }))];
  }, [products, categories]);

  const filteredProducts = useMemo(() => {
    let result = products;

    if (categoryFilter !== "all") {
      result = result.filter((p) => p.category_id === categoryFilter);

      if (categories.find((c) => c.id === categoryFilter)?.slug === SLUG_CARVAO) {
        const pesoKg = (nome: string) => {
          const match = normalize(nome).match(/(\d+)\s*kg/);
          return match ? parseInt(match[1], 10) : 0;
        };
        result.sort((a, b) => {
          const atacadoA = normalize(a.name).includes("atacado") ? 1 : 0;
          const atacadoB = normalize(b.name).includes("atacado") ? 1 : 0;
          if (atacadoA !== atacadoB) return atacadoA - atacadoB;
          return pesoKg(a.name) - pesoKg(b.name);
        });
      }
    }

    if (debouncedProductSearch) {
      const q = normalize(debouncedProductSearch);
      result = result.filter((p) => normalize(p.name).includes(q));
    }

    return result;
  }, [products, categories, categoryFilter, debouncedProductSearch]);

  const isEnterprise = tipo === "PJ";

  const totalAmountNum = parseFloat(payment.totalAmount) || 0;

  const fetchProducts = async () => {
    try {
      const { products, categories } = await adminApi.listProducts();
      setProducts((products || []).filter((p) => p.active));
      setCategories(categories || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao carregar produtos";
      toast({ title: "Erro ao carregar produtos", description: message, variant: "destructive" });
    }
  };

  useEffect(() => {
    fetchProducts();

    const fromShortcut = localStorage.getItem(PREFILL_KEY);
    if (fromShortcut) {
      try {
        const data = JSON.parse(fromShortcut) as AdminCustomerRow;
        if (data.id) {
          setSelectedCustomerId(data.id);
          setNome(data.name || "");
          setTelefone(data.phone ?? "");
          setTipo(data.type || "PF");
          setCnpj(data.cnpj ?? "");
          setEmail(data.email ?? "");

          const addrs = data.addresses ?? [];
          setCustomerAddresses(addrs);

          const primary = addrs.find((a) => a.is_primary) ?? addrs[0];
          if (primary) {
            setSelectedAddressId(primary.id);
            applyAddress(primary);
          }
        } else {
          const c = data as any;
          if (c.name) setNome(c.name);
          if (c.phone) setTelefone(c.phone);
          if (c.type) setTipo(c.type);
          if (c.cnpj) setCnpj(c.cnpj);
          if (c.email) setEmail(c.email);
        }
      } catch {
        // noop
      }
      localStorage.removeItem(PREFILL_KEY);
    }

    if (searchParams.get("tab") === "new-order") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, []);

  // Customer search effect
  useEffect(() => {
    if (!debouncedQuery || debouncedQuery.length < 2 || selectedCustomerId) {
      setSearchResults([]);
      return;
    }
    let cancelled = false;
    setSearchLoading(true);
    adminApi.searchCustomers(debouncedQuery).then((data) => {
      if (!cancelled) {
        setSearchResults(data ?? []);
        setShowDropdown(true);
      }
    }).catch(() => {
      if (!cancelled) setSearchResults([]);
    }).finally(() => {
      if (!cancelled) setSearchLoading(false);
    });
    return () => { cancelled = true; };
  }, [debouncedQuery, selectedCustomerId]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const applyAddress = (addr: CustomerAddress) => {
    setRua(addr.street);
    setNumero(addr.number);
    setBairro(addr.neighborhood);
    setCidade(addr.city || "Santo André");
    setComplemento(addr.complement ?? "");
    setCep(maskCep(addr.zip ?? ""));
    setIbge(addr.ibge_code ?? "");
  };

  // CEP completo acha cidade e o código IBGE (exigido na nota). Rua e bairro só
  // entram se estiverem vazios, para não apagar o que o atendente digitou.
  const handleCepChange = async (value: string) => {
    const masked = maskCep(value);
    setCep(masked);
    setIbge("");
    if (masked.replace(/\D/g, "").length !== 8) return;
    setCepLoading(true);
    const found = await lookupCep(masked);
    setCepLoading(false);
    if (!found) {
      toast({ title: "CEP não encontrado", description: "Confira o número ou siga sem ele.", variant: "destructive" });
      return;
    }
    setIbge(found.ibge);
    if (found.city) setCidade(found.city);
    setRua((prev) => prev.trim() ? prev : found.street);
    setBairro((prev) => prev.trim() ? prev : found.neighborhood);
  };

  const selectCustomer = (c: AdminCustomerRow) => {
    setSelectedCustomerId(c.id);
    setNome(c.name);
    setTelefone(c.phone ?? "");
    setTipo(c.type);
    setCnpj(c.cnpj ?? "");
    setEmail(c.email ?? "");
    setShowDropdown(false);
    setSearchQuery("");

    const addrs = c.addresses ?? [];
    setCustomerAddresses(addrs);

    const primary = addrs.find((a) => a.is_primary) ?? addrs[0];
    if (primary) {
      setSelectedAddressId(primary.id);
      applyAddress(primary);
    } else {
      setSelectedAddressId(null);
    }
  };

  const clearSelection = () => {
    setSelectedCustomerId(null);
    setSearchQuery("");
    setSearchResults([]);
    setCustomerAddresses([]);
    setSelectedAddressId(null);
  };

  const updateQty = (id: string, delta: number) => {
    setQtys((prev) => ({ ...prev, [id]: Math.max(0, (prev[id] || 0) + delta) }));
  };

  const changeQty = (id: string, n: number) => {
    setQtys((prev) => ({ ...prev, [id]: n }));
    if (n > 0 && prices[id] === undefined) {
      const price = products.find((p) => p.id === id)?.price;
      setPrices((prev) => ({ ...prev, [id]: price != null ? String(price) : "" }));
    }
  };

  const selectedItems = Object.entries(qtys)
    .filter(([, q]) => q > 0)
    .map(([id, qty]) => ({
      productId: id,
      nome: products.find((p) => p.id === id)?.name || id,
      qtd: qty,
      unitPrice: parsePrice(prices[id]),
    }));

  const itemsTotal = selectedItems.reduce((sum, i) => sum + (i.unitPrice ?? 0) * i.qtd, 0);
  const itemsWithoutPrice = selectedItems.filter((i) => i.unitPrice === null).length;

  useEffect(() => {
    if (totalTouched) return;
    setPayment((prev) => ({ ...prev, totalAmount: itemsTotal > 0 ? itemsTotal.toFixed(2) : "" }));
  }, [itemsTotal, totalTouched]);

  const handlePaymentChange = (next: SplitPaymentValue) => {
    // Total apagado volta a acompanhar a soma dos itens.
    if (next.totalAmount !== payment.totalAmount) setTotalTouched(next.totalAmount.trim() !== "");
    setPayment(next);
  };

  const resetForm = () => {
    setSubmitted(false);
    setLabelData(null);
    setCanal("ligacao");
    setTipo("PF");
    setFulfillmentType("delivery");
    setNome("");
    setTelefone("");
    setEmail("");
    setCnpj("");
    setRua("");
    setNumero("");
    setBairro("");
    setCidade("Santo André");
    setComplemento("");
    setCep("");
    setIbge("");
    setObs("");
    setDate(undefined);
    setHora("");
    setQtys({});
    setPrices({});
    setTotalTouched(false);
    setSelectedCustomerId(null);
    setSearchQuery("");
    setSearchResults([]);
    setPayment(emptySplitPayment());
    setAPrazo(false);
    setDueDate("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedItems.length === 0) {
      toast({ title: "Selecione ao menos um produto", variant: "destructive" });
      return;
    }

    const splitErr = validateSplitPayment(payment);
    if (splitErr) {
      toast({ title: splitErr, variant: "destructive" });
      return;
    }

    if (aPrazo && !dueDate) {
      toast({ title: "Informe o vencimento", description: "Pedido a prazo precisa de uma data de vencimento.", variant: "destructive" });
      return;
    }

    if (aPrazo && totalAmountNum <= 0) {
      toast({ title: "Informe o valor total", description: "Sem valor o pedido não entra nas contas a receber.", variant: "destructive" });
      return;
    }

    if (tipo === "PJ" && cnpj && !isValidCnpj(cnpj)) {
      toast({ title: "CNPJ inválido", variant: "destructive" });
      return;
    }

    // Enterprise delivery date validation
    if (isEnterprise && date) {
      if (isDeliveryDateDisabled(date)) {
        toast({ title: "Data de entrega inválida", description: "Pedidos realizados após as 14h só podem ser agendados para o próximo dia útil.", variant: "destructive" });
        return;
      }
    }

    setSaving(true);

    try {
      const hasCustomer = nome.trim() && telefone.trim();
      const hasAddress = rua.trim() && numero.trim();
      // Endereço do cadastro sem alteração é reaproveitado, em vez de virar
      // um endereço novo a cada pedido.
      const pickedAddress = customerAddresses.find((a) => a.id === selectedAddressId);
      const sameAsPicked = !!pickedAddress
        && pickedAddress.street.trim() === rua.trim()
        && pickedAddress.number.trim() === numero.trim()
        && (pickedAddress.complement ?? "").trim() === complemento.trim();

      const result = await adminApi.createAdminOrder({
        channel: canal,
        customer_id: selectedCustomerId,
        address_id: selectedCustomerId && sameAsPicked ? selectedAddressId : null,
        customer: hasCustomer ? {
          name: nome.trim(),
          phone: telefone,
          type: tipo,
          cnpj: tipo === "PJ" ? cnpj : null,
          email: email.trim() || null,
        } : undefined,
        address: (hasAddress && fulfillmentType === "delivery") ? {
          street: rua.trim(),
          number: numero.trim(),
          neighborhood: bairro.trim() || "—",
          city: cidade.trim(),
          state: "SP",
          complement: complemento.trim() || undefined,
          zip: cep.replace(/\D/g, "") || undefined,
          ibge_code: ibge || undefined,
        } : undefined,
        items: selectedItems.map((i) => ({ product_id: i.productId, qty: i.qtd, unit_price: i.unitPrice })),
        notes: obs.trim() || undefined,
        delivery_date: date ? format(date, "yyyy-MM-dd") : undefined,
        delivery_time: hora || undefined,
        fulfillment_type: fulfillmentType,
        ...splitPaymentToPayload(payment),
        payment_due_date: aPrazo ? dueDate : null,
      });

      const pedidoId = result.order_id.slice(0, 8).toUpperCase();
      const entregaData = date ? format(date, "dd/MM/yyyy") : undefined;

      setLabelData({
        pedidoId,
        cliente: nome || "Retirada / Sem cadastro",
        endereco: fulfillmentType === "pickup" ? "Retirada na loja" : (hasAddress ? `${rua}, ${numero} - ${bairro || "—"}, ${cidade}/SP` : "—"),
        complemento: fulfillmentType === "delivery" ? complemento : undefined,
        itens: selectedItems.map((i) => ({ nome: i.nome, qtd: i.qtd })),
        entregaData,
        entregaHora: hora || undefined,
        pagamento: payment.paymentMethod || undefined,
        obs: obs.trim() || undefined,
        totalAmount: totalAmountNum > 0 ? totalAmountNum : undefined,
        changeFor: payment.paymentMethod === "cash" && parseFloat(payment.changeFor) > 0 ? parseFloat(payment.changeFor) : undefined,
        isSplitPayment: payment.isSplit,
        pagamento2: payment.paymentMethod2 || undefined,
        paymentAmount1: payment.isSplit && parseFloat(payment.paymentAmount1) > 0 ? parseFloat(payment.paymentAmount1) : undefined,
        paymentAmount2: payment.isSplit && parseFloat(payment.paymentAmount2) > 0 ? parseFloat(payment.paymentAmount2) : undefined,
        changeFor2: payment.isSplit && payment.paymentMethod2 === "cash" && parseFloat(payment.changeFor2) > 0 ? parseFloat(payment.changeFor2) : undefined,
      });

      trackEvent("order_created", { tipo: tipo === "PJ" ? "empresa" : "varejo", canal, pedidoId, fulfillmentType });
      setSubmitted(true);
      toast({ title: "Pedido salvo com sucesso!" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao salvar pedido";
      toast({ title: "Erro ao salvar", description: message, variant: "destructive" });
      console.error("new-order", err);
    } finally {
      setSaving(false);
    }
  };

  if (submitted && labelData) {
    return (
      <Card className="max-w-lg mx-auto">
        <CardHeader>
          <CardTitle className="text-center space-y-2">
            <div className="flex justify-center">
              <Badge className="bg-green-600 text-white text-sm px-3 py-1">✅ Pedido salvo com sucesso!</Badge>
            </div>
            <p className="text-base font-medium text-muted-foreground">Pedido #{labelData.pedidoId}</p>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="border rounded-lg p-4 bg-muted/30 text-sm space-y-1">
            <p className="font-semibold">{labelData.cliente}</p>
            <p className="text-muted-foreground">{labelData.endereco}</p>
            {labelData.complemento && <p className="text-muted-foreground text-xs">Compl.: {labelData.complemento}</p>}
            <ul className="list-disc list-inside mt-2">
              {labelData.itens.map((i) => (
                <li key={i.nome}>{i.nome}: {i.qtd}</li>
              ))}
            </ul>
            {labelData.entregaData && (
              <p className="mt-1">Entrega: {labelData.entregaData}{labelData.entregaHora ? ` às ${labelData.entregaHora}` : ""}</p>
            )}
          </div>
          <OrderLabel data={labelData} />
          <div className="grid grid-cols-2 gap-2">
            <Button className="w-full" onClick={resetForm}>Novo pedido</Button>
            <Button variant="outline" className="w-full" onClick={() => {
              const params = new URLSearchParams({ tab: "orders" });
              window.location.search = params.toString();
            }}>Ver pedidos</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl mx-auto space-y-6">
      <Card>
        <CardHeader><CardTitle className="text-lg">Canal, tipo e atendimento</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Canal *</Label>
              <Select value={canal} onValueChange={(v) => setCanal(v as (typeof canais)[number]["value"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{canais.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tipo *</Label>
              <Select value={tipo} onValueChange={(v) => setTipo(v as "PF" | "PJ")}> 
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PF">Pessoa Física</SelectItem>
                  <SelectItem value="PJ">Pessoa Jurídica</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Tipo de atendimento</Label>
            <FulfillmentToggle value={fulfillmentType} onChange={setFulfillmentType} className="mt-1" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Dados do cliente</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {/* Customer search */}
          <div className="relative" ref={dropdownRef}>
            <Label>Buscar cliente existente</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Nome ou telefone..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setShowDropdown(true); }}
                className="pl-9"
                disabled={!!selectedCustomerId}
              />
              {searchLoading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />}
            </div>
            {showDropdown && searchResults.length > 0 && !selectedCustomerId && (
              <div className="absolute z-10 mt-1 w-full bg-popover border rounded-md shadow-lg max-h-60 overflow-y-auto">
                {searchResults.map((c) => {
                  const addr = c.addresses?.find((a) => a.is_primary) ?? c.addresses?.[0];
                  return (
                    <button
                      key={c.id}
                      type="button"
                      className="w-full text-left px-3 py-2 hover:bg-muted text-sm border-b last:border-b-0"
                      onClick={() => selectCustomer(c)}
                    >
                      <div>
                        <span className="font-medium">{c.name}</span>
                        <span className="text-muted-foreground ml-2">{c.phone ?? ""}</span>
                      </div>
                      {addr && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {addr.street}, {addr.number} — {addr.neighborhood}
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
            {selectedCustomerId && (
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <Badge variant="secondary" className="text-xs">Cliente: {nome}</Badge>
                <Button type="button" variant="ghost" size="sm" className="h-6 text-xs" onClick={clearSelection}>
                  <X className="h-3 w-3 mr-1" /> Desvincular
                </Button>
              </div>
            )}
            {selectedCustomerId && customerAddresses.length > 1 && fulfillmentType === "delivery" && (
              <div className="mt-2">
                <Label>Selecionar endereço</Label>
                <Select value={selectedAddressId ?? ""} onValueChange={(v) => {
                  setSelectedAddressId(v);
                  const addr = customerAddresses.find((a) => a.id === v);
                  if (addr) applyAddress(addr);
                }}>
                  <SelectTrigger><SelectValue placeholder="Escolha um endereço" /></SelectTrigger>
                  <SelectContent>
                    {customerAddresses.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.street}, {a.number} — {a.neighborhood}{a.is_primary ? " (principal)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <p className="text-xs text-muted-foreground">Campos opcionais — deixe vazio para retirada sem cadastro.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><Label>Nome</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} /></div>
            <div><Label>Telefone</Label><Input type="tel" value={telefone} onChange={(e) => setTelefone(e.target.value)} /></div>
          </div>
          <div><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          {tipo === "PJ" && (
            <div>
              <Label>CNPJ {nome.trim() ? "*" : ""}</Label>
              <Input value={cnpj} onChange={(e) => setCnpj(maskCnpj(e.target.value))} maxLength={18} />
            </div>
          )}
        </CardContent>
      </Card>

      {fulfillmentType === "delivery" && (
        <Card>
          <CardHeader><CardTitle className="text-lg">Endereço</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label className="flex items-center gap-1">CEP {cepLoading && <Loader2 className="h-3 w-3 animate-spin" />}</Label>
                <Input value={cep} onChange={(e) => handleCepChange(e.target.value)} placeholder="00000-000" maxLength={9} inputMode="numeric" />
              </div>
              <p className="col-span-2 self-end text-xs text-muted-foreground pb-2">Necessário para emitir nota fiscal. Preenche rua, bairro e cidade.</p>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2"><Label>Rua</Label><Input value={rua} onChange={(e) => setRua(e.target.value)} /></div>
              <div><Label>Nº</Label><Input value={numero} onChange={(e) => setNumero(e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Bairro</Label><Input value={bairro} onChange={(e) => setBairro(e.target.value)} /></div>
              <div><Label>Cidade</Label><Input value={cidade} onChange={(e) => setCidade(e.target.value)} /></div>
            </div>
            <div><Label>Complemento</Label><Input value={complemento} onChange={(e) => setComplemento(e.target.value)} /></div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-lg">Produtos</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar produto por nome..."
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              className="pl-9 pr-8"
            />
            {productSearch && (
              <button type="button" onClick={() => setProductSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          {productFilters.length > 1 && (
            <div className="flex gap-2 flex-wrap">
              {productFilters.map((f) => (
                <Button
                  key={f.id}
                  type="button"
                  variant={categoryFilter === f.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCategoryFilter(f.id)}
                >
                  {f.label}
                </Button>
              ))}
            </div>
          )}
          {products.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nenhum produto cadastrado.</p>
          ) : filteredProducts.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nenhum produto encontrado.</p>
          ) : (
            filteredProducts.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-2 border rounded-md p-3">
                <div className="min-w-0">
                  <p className="font-medium text-sm">{p.name}</p>
                  <p className="text-xs text-muted-foreground">{p.price_text}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {(qtys[p.id] || 0) > 0 && (
                    <div className="relative">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
                      <Input
                        inputMode="decimal"
                        placeholder="Preço"
                        aria-label={`Preço unitário de ${p.name}`}
                        className={cn("h-8 w-24 pl-7 text-sm", parsePrice(prices[p.id]) === null && "border-amber-500")}
                        value={prices[p.id] ?? ""}
                        onChange={(e) => setPrices((prev) => ({ ...prev, [p.id]: e.target.value.replace(/[^\d.,]/g, "") }))}
                      />
                    </div>
                  )}
                  <QuantityInput
                    value={qtys[p.id] || 0}
                    onChange={(n) => changeQty(p.id, n)}
                    ariaLabel={`Quantidade de ${p.name}`}
                  />
                </div>
              </div>
            ))
          )}
          {selectedItems.length > 0 && (
            <div className="border-t pt-3 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Soma dos itens</span>
                <span className="font-semibold">{formatCurrency(itemsTotal)}</span>
              </div>
              {itemsWithoutPrice > 0 && (
                <p className="text-xs text-amber-600">
                  {itemsWithoutPrice === 1 ? "1 item está sem preço." : `${itemsWithoutPrice} itens estão sem preço.`} Sem o preço de cada item não será possível emitir a nota fiscal.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Agendamento</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div>
            <Label>Data</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left", !date && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, "dd/MM/yyyy") : "Selecione"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={setDate}
                  disabled={(d) => isEnterprise ? isDeliveryDateDisabled(d) : d < new Date(new Date().setHours(0, 0, 0, 0))}
                  locale={ptBR}
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
            {isEnterprise && (
              <p className="text-xs text-muted-foreground mt-1">
                Após 14h, só dias úteis a partir de amanhã.
              </p>
            )}
          </div>
          <div>
            <Label>Horário</Label>
            <Select value={hora} onValueChange={setHora}>
              <SelectTrigger><SelectValue placeholder="Horário" /></SelectTrigger>
              <SelectContent>{horarios.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Forma de pagamento</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <SplitPaymentSection value={payment} onChange={handlePaymentChange} />
          {totalTouched && totalAmountNum > 0 && itemsTotal > 0 && Math.abs(totalAmountNum - itemsTotal) >= 0.01 && (
            <p className="text-xs text-muted-foreground">
              {totalAmountNum < itemsTotal
                ? `Desconto de ${formatCurrency(itemsTotal - totalAmountNum)} sobre a soma dos itens.`
                : `Total ${formatCurrency(totalAmountNum - itemsTotal)} acima da soma dos itens.`}
            </p>
          )}
          <p className="text-xs text-muted-foreground">Opcional — selecione se o cliente informou.</p>

          <div className="border-t pt-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <Label className="text-sm">Pagamento a prazo</Label>
                <p className="text-xs text-muted-foreground">
                  O cliente recebe agora e paga numa data combinada.
                </p>
              </div>
              <Switch
                checked={aPrazo}
                onCheckedChange={(v) => { setAPrazo(v); if (!v) setDueDate(""); }}
              />
            </div>

            {aPrazo && (
              <div>
                <Label>Vencimento</Label>
                <Input
                  type="date"
                  value={dueDate}
                  min={toISODate(new Date())}
                  onChange={(e) => setDueDate(e.target.value)}
                />
                <div className="flex gap-2 mt-2">
                  {[7, 15, 30].map((d) => (
                    <Button
                      key={d}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setDueDate(addDaysISO(d))}
                    >
                      {d} dias
                    </Button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  O pedido entra na aba Receber. O valor só vai para o caixa no dia em que a baixa for registrada.
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div>
        <Label>Observações</Label>
        <Textarea value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Instruções especiais..." />
      </div>

      <Button type="submit" size="lg" className="w-full" disabled={saving}>
        <Save className="h-5 w-5 mr-2" /> {saving ? "Salvando..." : "Salvar pedido"}
      </Button>
    </form>
  );
}
