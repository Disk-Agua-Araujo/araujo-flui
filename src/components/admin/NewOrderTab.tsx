import { useEffect, useState, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { OrderLabel, type LabelData } from "@/components/OrderLabel";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, Minus, Plus, Save, Search, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { maskCnpj, isValidCnpj } from "@/lib/cnpj";
import { buildOrderMessage, openWhatsApp } from "@/services/whatsapp";
import { useToast } from "@/hooks/use-toast";
import { trackEvent } from "@/hooks/use-analytics";
import { adminApi, type AdminProductRow, type AdminCustomerRow } from "@/services/admin-api";
import { useDebounce } from "@/hooks/use-debounce";

const horarios = ["08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00"];
const canais = [
  { value: "ligacao", label: "Ligação" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "admin", label: "Cadastro interno" },
] as const;

const PREFILL_KEY = "admin-new-order-customer";

export function NewOrderTab() {
  const { toast } = useToast();
  const [searchParams] = useSearchParams();

  const [products, setProducts] = useState<AdminProductRow[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [labelData, setLabelData] = useState<LabelData | null>(null);
  const [saving, setSaving] = useState(false);

  // Customer search
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<AdminCustomerRow[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debouncedQuery = useDebounce(searchQuery, 300);

  const [canal, setCanal] = useState<(typeof canais)[number]["value"]>("ligacao");
  const [tipo, setTipo] = useState<"PF" | "PJ">("PF");
  const [nome, setNome] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [rua, setRua] = useState("");
  const [numero, setNumero] = useState("");
  const [bairro, setBairro] = useState("");
  const [cidade, setCidade] = useState("Santo André");
  const [complemento, setComplemento] = useState("");
  const [obs, setObs] = useState("");
  const [date, setDate] = useState<Date>();
  const [hora, setHora] = useState("");
  const [qtys, setQtys] = useState<Record<string, number>>({});

  const fetchProducts = async () => {
    try {
      const { products } = await adminApi.listProducts();
      setProducts((products || []).filter((p) => p.active));
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
        const customer = JSON.parse(fromShortcut) as { name?: string; phone?: string; type?: "PF" | "PJ"; cnpj?: string; email?: string };
        if (customer.name) setNome(customer.name);
        if (customer.phone) setTelefone(customer.phone);
        if (customer.type) setTipo(customer.type);
        if (customer.cnpj) setCnpj(customer.cnpj);
        if (customer.email) setEmail(customer.email);
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

  const selectCustomer = (c: AdminCustomerRow) => {
    setSelectedCustomerId(c.id);
    setNome(c.name);
    setTelefone(c.phone ?? "");
    setTipo(c.type);
    setCnpj(c.cnpj ?? "");
    setEmail(c.email ?? "");
    setShowDropdown(false);
    setSearchQuery("");

    // Fill address from primary address
    const primaryAddr = c.addresses?.find((a) => a.is_primary) ?? c.addresses?.[0];
    if (primaryAddr) {
      setRua(primaryAddr.street);
      setNumero(primaryAddr.number);
      setBairro(primaryAddr.neighborhood);
      setCidade(primaryAddr.city || "Santo André");
      setComplemento(primaryAddr.complement ?? "");
    }
  };

  const clearSelection = () => {
    setSelectedCustomerId(null);
    setSearchQuery("");
    setSearchResults([]);
  };

  const updateQty = (id: string, delta: number) => {
    setQtys((prev) => ({ ...prev, [id]: Math.max(0, (prev[id] || 0) + delta) }));
  };

  const selectedItems = Object.entries(qtys)
    .filter(([, q]) => q > 0)
    .map(([id, qty]) => ({
      productId: id,
      nome: products.find((p) => p.id === id)?.name || id,
      qtd: qty,
    }));

  const resetForm = () => {
    setSubmitted(false);
    setLabelData(null);
    setCanal("ligacao");
    setTipo("PF");
    setNome("");
    setTelefone("");
    setEmail("");
    setCnpj("");
    setRua("");
    setNumero("");
    setBairro("");
    setCidade("Santo André");
    setComplemento("");
    setObs("");
    setDate(undefined);
    setHora("");
    setQtys({});
    setSelectedCustomerId(null);
    setSearchQuery("");
    setSearchResults([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!nome.trim() || !telefone.trim() || !rua.trim() || !numero.trim() || !bairro.trim()) {
      toast({ title: "Campos obrigatórios", description: "Preencha nome, telefone e endereço completo.", variant: "destructive" });
      return;
    }

    if (tipo === "PJ" && !cnpj.trim()) {
      toast({ title: "CNPJ obrigatório", description: "Para Pessoa Jurídica, informe o CNPJ.", variant: "destructive" });
      return;
    }

    if (tipo === "PJ" && cnpj && !isValidCnpj(cnpj)) {
      toast({ title: "CNPJ inválido", variant: "destructive" });
      return;
    }

    if (selectedItems.length === 0) {
      toast({ title: "Selecione ao menos um produto", variant: "destructive" });
      return;
    }

    setSaving(true);

    try {
      const result = await adminApi.createAdminOrder({
        channel: canal,
        customer: {
          name: nome.trim(),
          phone: telefone,
          type: tipo,
          cnpj: tipo === "PJ" ? cnpj : null,
          email: email.trim() || null,
        },
        address: {
          street: rua.trim(),
          number: numero.trim(),
          neighborhood: bairro.trim(),
          city: cidade.trim(),
          state: "SP",
          complement: complemento.trim() || undefined,
        },
        items: selectedItems.map((i) => ({ product_id: i.productId, qty: i.qtd })),
        notes: obs.trim() || undefined,
        delivery_date: date ? format(date, "yyyy-MM-dd") : undefined,
        delivery_time: hora || undefined,
      });

      const pedidoId = result.order_id.slice(0, 8).toUpperCase();
      const entregaData = date ? format(date, "dd/MM/yyyy") : undefined;

      setLabelData({
        pedidoId,
        cliente: nome,
        endereco: `${rua}, ${numero} - ${bairro}, ${cidade}/SP`,
        complemento,
        itens: selectedItems.map((i) => ({ nome: i.nome, qtd: i.qtd })),
        entregaData,
        entregaHora: hora || undefined,
      });

      const message = buildOrderMessage({
        tipo: tipo === "PJ" ? "EMPRESA" : "VAREJO",
        canal,
        cliente: nome,
        cnpj: tipo === "PJ" ? cnpj : undefined,
        telefone,
        endereco: { rua, numero, bairro, cidade, uf: "SP", complemento },
        obs,
        itens: selectedItems.map((i) => ({ nome: i.nome, qtd: i.qtd })),
        entregaData,
        entregaHora: hora || undefined,
        status: "Novo",
        pedidoId,
      });

      openWhatsApp(message);
      trackEvent("order_created", { tipo: tipo === "PJ" ? "empresa" : "varejo", canal, pedidoId });
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
          <CardTitle className="text-center">
            <Badge className="bg-whatsapp text-white mb-2">Pedido salvo!</Badge>
            <br />Pedido registrado no sistema
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <OrderLabel data={labelData} />
          <Button className="w-full" onClick={resetForm}>Novo pedido</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl mx-auto space-y-6">
      <Card>
        <CardHeader><CardTitle className="text-lg">Canal e tipo</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
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
              <div className="absolute z-10 mt-1 w-full bg-popover border rounded-md shadow-lg max-h-48 overflow-y-auto">
                {searchResults.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className="w-full text-left px-3 py-2 hover:bg-muted text-sm border-b last:border-b-0"
                    onClick={() => selectCustomer(c)}
                  >
                    <span className="font-medium">{c.name}</span>
                    <span className="text-muted-foreground ml-2">{c.phone ?? ""}</span>
                  </button>
                ))}
              </div>
            )}
            {selectedCustomerId && (
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="secondary" className="text-xs">Cliente selecionado: {nome}</Badge>
                <Button type="button" variant="ghost" size="sm" className="h-6 text-xs" onClick={clearSelection}>
                  <X className="h-3 w-3 mr-1" /> Limpar seleção
                </Button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><Label>Nome *</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} required /></div>
            <div><Label>Telefone *</Label><Input type="tel" value={telefone} onChange={(e) => setTelefone(e.target.value)} required /></div>
          </div>
          <div><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          {tipo === "PJ" && (
            <div>
              <Label>CNPJ *</Label>
              <Input value={cnpj} onChange={(e) => setCnpj(maskCnpj(e.target.value))} maxLength={18} />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Endereço</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2"><Label>Rua *</Label><Input value={rua} onChange={(e) => setRua(e.target.value)} required /></div>
            <div><Label>Nº *</Label><Input value={numero} onChange={(e) => setNumero(e.target.value)} required /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Bairro *</Label><Input value={bairro} onChange={(e) => setBairro(e.target.value)} required /></div>
            <div><Label>Cidade</Label><Input value={cidade} onChange={(e) => setCidade(e.target.value)} /></div>
          </div>
          <div><Label>Complemento</Label><Input value={complemento} onChange={(e) => setComplemento(e.target.value)} /></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Produtos</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {products.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nenhum produto cadastrado.</p>
          ) : (
            products.map((p) => (
              <div key={p.id} className="flex items-center justify-between border rounded-md p-3">
                <div>
                  <p className="font-medium text-sm">{p.name}</p>
                  <p className="text-xs text-muted-foreground">{p.price_text}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={() => updateQty(p.id, -1)}>
                    <Minus className="h-3 w-3" />
                  </Button>
                  <span className="w-8 text-center font-medium">{qtys[p.id] || 0}</span>
                  <Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={() => updateQty(p.id, 1)}>
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))
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
                <Calendar mode="single" selected={date} onSelect={setDate} locale={ptBR} className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
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

      <div>
        <Label>Observações</Label>
        <Textarea value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Instruções especiais..." />
      </div>

      <Button type="submit" size="lg" className="w-full" disabled={saving}>
        <Save className="h-5 w-5 mr-2" /> {saving ? "Salvando..." : "Salvar pedido + WhatsApp"}
      </Button>
    </form>
  );
}
