import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { OrderLabel, type LabelData } from "@/components/OrderLabel";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, Minus, Plus, MessageCircle, MapPin, Save } from "lucide-react";
import { cn } from "@/lib/utils";
import { maskCnpj, isValidCnpj } from "@/lib/cnpj";
import { buildOrderMessage, openWhatsApp } from "@/services/whatsapp";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { trackEvent } from "@/hooks/use-analytics";
import type { Tables } from "@/integrations/supabase/types";

const horarios = ["08:00","09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00"];
const canais = [
  { value: "ligacao", label: "Ligação" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "admin", label: "Cadastro interno" },
];

export function NewOrderTab() {
  const { toast } = useToast();
  const { username } = useAuth();
  const [products, setProducts] = useState<Tables<"products">[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [labelData, setLabelData] = useState<LabelData | null>(null);
  const [saving, setSaving] = useState(false);

  // Form
  const [canal, setCanal] = useState("ligacao");
  const [tipo, setTipo] = useState<"PF" | "PJ">("PF");
  const [nome, setNome] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [telefone, setTelefone] = useState("");
  const [rua, setRua] = useState("");
  const [numero, setNumero] = useState("");
  const [bairro, setBairro] = useState("");
  const [cidade, setCidade] = useState("Santo André");
  const [complemento, setComplemento] = useState("");
  const [obs, setObs] = useState("");
  const [date, setDate] = useState<Date>();
  const [hora, setHora] = useState("");
  const [qtys, setQtys] = useState<Record<string, number>>({});

  useEffect(() => {
    supabase.from("products").select("*").eq("active", true).then(({ data }) => {
      if (data) setProducts(data);
    });
  }, []);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome || !telefone || !rua || !numero || !bairro) {
      toast({ title: "Preencha os campos obrigatórios", variant: "destructive" });
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
      // 1. Create customer
      const { data: customer, error: custErr } = await supabase
        .from("customers")
        .insert({ name: nome, phone: telefone, type: tipo, cnpj: tipo === "PJ" ? cnpj : null, created_by: username })
        .select()
        .single();
      if (custErr) throw custErr;

      // 2. Create address
      const { data: address, error: addrErr } = await supabase
        .from("addresses")
        .insert({ customer_id: customer.id, street: rua, number: numero, neighborhood: bairro, city: cidade, complement: complemento || null })
        .select()
        .single();
      if (addrErr) throw addrErr;

      // 3. Create order
      const { data: order, error: ordErr } = await supabase
        .from("orders")
        .insert({
          channel: canal as any,
          customer_id: customer.id,
          address_id: address.id,
          delivery_date: date ? format(date, "yyyy-MM-dd") : null,
          delivery_time: hora || null,
          notes: obs || null,
          created_by: username,
        })
        .select()
        .single();
      if (ordErr) throw ordErr;

      // 4. Create order items
      const items = selectedItems.map((i) => ({
        order_id: order.id,
        product_id: i.productId,
        qty: i.qtd,
      }));
      const { error: itemsErr } = await supabase.from("order_items").insert(items);
      if (itemsErr) throw itemsErr;

      // Success
      const pedidoId = order.id.slice(0, 8).toUpperCase();
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
        canal: canal as any,
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

      trackEvent("order_created", { tipo: tipo === "PJ" ? "empresa" : "varejo", canal, pedidoId });
      openWhatsApp(message);
      setSubmitted(true);
      toast({ title: "Pedido salvo com sucesso!" });
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
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
          <Button className="w-full" onClick={() => { setSubmitted(false); setQtys({}); setNome(""); setTelefone(""); setCnpj(""); setRua(""); setNumero(""); setBairro(""); setComplemento(""); setObs(""); }}>
            Novo pedido
          </Button>
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
            <Select value={canal} onValueChange={setCanal}>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Nome *</Label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} required />
            </div>
            <div>
              <Label>Telefone *</Label>
              <Input type="tel" value={telefone} onChange={(e) => setTelefone(e.target.value)} required />
            </div>
          </div>
          {tipo === "PJ" && (
            <div>
              <Label>CNPJ</Label>
              <Input value={cnpj} onChange={(e) => setCnpj(maskCnpj(e.target.value))} maxLength={18} />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg flex items-center gap-2"><MapPin className="h-5 w-5" /> Endereço</CardTitle></CardHeader>
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
            <p className="text-muted-foreground text-sm">Nenhum produto cadastrado. Vá na aba "Produtos" para criar.</p>
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
        <Textarea value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Instruções especiais, ponto de referência..." />
      </div>

      <Button type="submit" size="lg" className="w-full" disabled={saving}>
        <Save className="h-5 w-5 mr-2" /> {saving ? "Salvando..." : "Salvar pedido + WhatsApp"}
      </Button>
    </form>
  );
}
