import { useState, useMemo } from "react";
import { MessageCircle, Plus, Minus, Copy, Check, Loader2, Droplets } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { sendOrderToDiskWhatsApp, type OrderMessageData } from "@/services/whatsapp";
import { createSiteOrder } from "@/services/orders";
import { useQuickOrderProducts } from "@/hooks/use-products";
import { useCategories } from "@/hooks/use-categories";
import { trackEvent } from "@/hooks/use-analytics";
import { useToast } from "@/hooks/use-toast";

export function QuickOrder() {
  const { toast } = useToast();
  const { data: dbProducts = [], isLoading } = useQuickOrderProducts();
  const { data: categories = [] } = useCategories();

  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [name, setName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [address, setAddress] = useState("");
  const [bairro, setBairro] = useState("");
  const [sent, setSent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [waResult, setWaResult] = useState<{ sent: boolean; fallback: boolean; message: string } | null>(null);

  // Group by category: Galões 20L first, then 10L
  const grouped = useMemo(() => {
    const cat20 = categories.find((c) => c.slug === "galoes-20l");
    const cat10 = categories.find((c) => c.slug === "galoes-10l");
    const groups: { label: string; products: typeof dbProducts }[] = [];

    if (cat20) {
      const prods = dbProducts.filter((p) => p.category_id === cat20.id);
      if (prods.length > 0) groups.push({ label: cat20.name, products: prods });
    }
    if (cat10) {
      const prods = dbProducts.filter((p) => p.category_id === cat10.id);
      if (prods.length > 0) groups.push({ label: cat10.name, products: prods });
    }

    // Any remaining quick order products not in those categories
    const usedIds = new Set(groups.flatMap((g) => g.products.map((p) => p.id)));
    const rest = dbProducts.filter((p) => !usedIds.has(p.id));
    if (rest.length > 0) groups.push({ label: "Outros", products: rest });

    return groups;
  }, [dbProducts, categories]);

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
    if (!address.trim()) e.address = "Informe seu endereço";
    if (!bairro.trim()) e.bairro = "Informe o bairro";
    if (selectedItems.length === 0) e.items = "Selecione ao menos um produto";
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
        address: { street, number: numero, neighborhood: bairro.trim() },
        items: selectedItems.map((i) => ({ product_id: i.id, qty: i.qty })),
        notes: "Pedido rápido",
      });

      const pedidoId = orderResult.order_id.slice(0, 8).toUpperCase();

      const msgData: OrderMessageData = {
        tipo: "VAREJO",
        canal: "site",
        cliente: name.trim(),
        telefone: whatsapp.trim(),
        endereco: { rua: street, numero, bairro: bairro.trim(), cidade: "Santo André", uf: "SP" },
        itens: selectedItems.map((i) => ({ nome: i.name, qtd: i.qty })),
        status: "Novo",
        pedidoId,
      };

      const result = await sendOrderToDiskWhatsApp(msgData);
      setWaResult(result);

      trackEvent("order_submit", { source: "quick_order", items: selectedItems.map((i) => i.name) });
      setSent(true);
      toast({ title: "Pedido registrado!" });
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
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

  if (sent) {
    return (
      <section id="pedido-rapido" className="py-12 md:py-16">
        <div className="container max-w-lg">
          <Card className="shadow-lg border-primary/20">
            <CardHeader>
              <CardTitle className="text-center text-primary">✅ Pedido registrado!</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground text-center">
                {waResult?.fallback
                  ? "Seu pedido foi salvo. Envie no WhatsApp para finalizar."
                  : "Seu pedido foi salvo e enviado ao WhatsApp."}
              </p>
              {waResult?.message && (
                <div className="bg-muted p-3 rounded-lg text-sm break-words max-h-32 overflow-y-auto">{waResult.message}</div>
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
            {/* Products grouped by category */}
            <div className="space-y-4">
              {isLoading ? (
                <p className="text-sm text-muted-foreground text-center">Carregando produtos...</p>
              ) : grouped.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center">Nenhum produto disponível.</p>
              ) : (
                grouped.map((group) => (
                  <div key={group.label}>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">{group.label}</p>
                    <div className="space-y-2">
                      {group.products.map((p) => (
                        <div key={p.id} className="flex items-center justify-between bg-muted/50 rounded-lg px-3 py-2">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            {p.image_url ? (
                              <img src={p.image_url} alt={p.name} className="h-8 w-8 rounded object-cover flex-shrink-0" loading="lazy" />
                            ) : (
                              <Droplets className="h-5 w-5 text-primary flex-shrink-0" />
                            )}
                            <span className="text-sm font-medium truncate">{p.name}</span>
                          </div>
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
                    </div>
                  </div>
                ))
              )}
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
                <Input placeholder="Endereço (Rua e número)" value={address} onChange={(e) => setAddress(e.target.value)} maxLength={200} />
                {errors.address && <p className="text-xs text-destructive mt-1">{errors.address}</p>}
              </div>
              <div>
                <Input placeholder="Bairro" value={bairro} onChange={(e) => setBairro(e.target.value)} maxLength={100} />
                {errors.bairro && <p className="text-xs text-destructive mt-1">{errors.bairro}</p>}
              </div>
            </div>

            <Button
              className="w-full bg-whatsapp hover:bg-whatsapp-dark text-white font-semibold"
              onClick={handleSubmit}
              disabled={saving}
            >
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <MessageCircle className="h-4 w-4 mr-2" />}
              {saving ? "Salvando..." : "Enviar pedido no WhatsApp"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
