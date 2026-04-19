import { useState } from "react";
import { Loader2, MessageCircle, MapPin, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FulfillmentToggle } from "@/components/FulfillmentToggle";
import { useCart } from "@/contexts/CartContext";
import { useToast } from "@/hooks/use-toast";
import { validateDeliveryDistance, MAX_DELIVERY_KM } from "@/lib/geo";
import { createSiteOrder } from "@/services/orders";
import { buildOrderMessage, openWhatsApp } from "@/services/whatsapp";
import { trackEvent } from "@/hooks/use-analytics";

const paymentOptions = ["PIX", "Dinheiro", "Cartão"];

interface CheckoutFormProps {
  onBack: () => void;
  onSuccess: (summary: { pedidoId: string; items: { name: string; qty: number }[]; address: string; waMessage: string }) => void;
}

export function CheckoutForm({ onBack, onSuccess }: CheckoutFormProps) {
  const { items, clearCart } = useCart();
  const { toast } = useToast();

  const [nome, setNome] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [rua, setRua] = useState("");
  const [numero, setNumero] = useState("");
  const [bairro, setBairro] = useState("");
  const [complemento, setComplemento] = useState("");
  const [pagamento, setPagamento] = useState("");
  const [obs, setObs] = useState("");
  const [fulfillmentType, setFulfillmentType] = useState<"delivery" | "pickup">("delivery");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
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

      trackEvent("order_created", { tipo: "varejo", canal: "site", pedidoId, fulfillmentType });
      toast({ title: "Pedido registrado com sucesso!" });

      onSuccess({
        pedidoId,
        items: items.map((i) => ({ name: i.product.name, qty: i.qty })),
        address: fulfillmentType === "pickup" ? "Retirada na loja" : `${rua}, ${numero} - ${bairro}, Santo André - SP`,
        waMessage: message,
      });
      clearCart();
    } catch (err: any) {
      toast({ title: "Erro ao salvar pedido", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Button type="button" variant="ghost" size="sm" onClick={onBack} className="mb-2 -ml-2">
        <ArrowLeft className="h-4 w-4 mr-1" /> Voltar para produtos
      </Button>
      <div>
        <Label className="text-xs font-medium mb-1 block">Tipo de atendimento</Label>
        <FulfillmentToggle value={fulfillmentType} onChange={setFulfillmentType} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div><Label htmlFor="c-nome">Nome *</Label><Input id="c-nome" value={nome} onChange={(e) => setNome(e.target.value)} required /></div>
        <div><Label htmlFor="c-wa">WhatsApp *</Label><Input id="c-wa" type="tel" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} required /></div>
      </div>
      {fulfillmentType === "delivery" && (
        <>
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2"><Label htmlFor="c-rua">Rua *</Label><Input id="c-rua" value={rua} onChange={(e) => setRua(e.target.value)} required /></div>
            <div><Label htmlFor="c-num">Nº *</Label><Input id="c-num" value={numero} onChange={(e) => setNumero(e.target.value)} required /></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label htmlFor="c-bairro">Bairro *</Label><Input id="c-bairro" value={bairro} onChange={(e) => setBairro(e.target.value)} required /></div>
            <div><Label htmlFor="c-comp">Complemento</Label><Input id="c-comp" value={complemento} onChange={(e) => setComplemento(e.target.value)} placeholder="Apto, Bloco" /></div>
          </div>
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
      <Button type="submit" className="w-full bg-whatsapp hover:bg-whatsapp-dark text-white font-semibold" disabled={saving}>
        {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <MessageCircle className="h-4 w-4 mr-1" />}
        {saving ? "Salvando..." : "Confirmar e enviar pedido"}
      </Button>
    </form>
  );
}
