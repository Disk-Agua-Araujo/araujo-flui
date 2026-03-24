import { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { OrderLabel, type LabelData } from "@/components/OrderLabel";
import { openWhatsApp, buildOrderMessage } from "@/services/whatsapp";
import { Search, MessageCircle, Printer, Eye, RefreshCw, ChevronLeft, ChevronRight, Truck, Store, Settings, Plus, UserPlus, Loader2, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format, startOfDay, startOfWeek, startOfMonth } from "date-fns";
import { Constants } from "@/integrations/supabase/types";
import { adminApi, type AdminOrderRow, type DeliveryRider } from "@/services/admin-api";
import { useIsMobile } from "@/hooks/use-mobile";

const statusColors: Record<string, string> = {
  novo: "bg-blue-100 text-blue-800",
  agendado: "bg-yellow-100 text-yellow-800",
  em_rota: "bg-orange-100 text-orange-800",
  entregue: "bg-green-100 text-green-800",
  cancelado: "bg-red-100 text-red-800",
};

const paymentLabels: Record<string, string> = {
  cash: "💵 Dinheiro",
  pix: "📱 PIX",
  card: "💳 Cartão",
};

const statusLabels: Record<string, string> = {
  novo: "Novo",
  agendado: "Agendado",
  em_rota: "Em rota",
  entregue: "Entregue",
  cancelado: "Cancelado",
};

const PAGE_SIZE = 20;

function FulfillmentBadge({ type }: { type?: string }) {
  if (type === "pickup") {
    return (
      <Badge variant="secondary" className="text-xs gap-1">
        <Store className="h-3 w-3" /> Retirada
      </Badge>
    );
  }
  return (
    <Badge className="text-xs gap-1 bg-[hsl(var(--brand-blue))] hover:bg-[hsl(var(--brand-blue))]/90 text-white">
      <Truck className="h-3 w-3" /> Entrega
    </Badge>
  );
}

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// ---- Rider Management Modal ----
type DailyStats = { dia: string; total_galoes: number; total_pedidos: number };
type RiderDailyStats = Record<string, DailyStats[]>;

function RiderManagementModal({
  open, onOpenChange, riders, onSave,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  riders: DeliveryRider[];
  onSave: () => void;
}) {
  const { toast } = useToast();
  const [localRiders, setLocalRiders] = useState<(DeliveryRider & { _new?: boolean })[]>([]);
  const [saving, setSaving] = useState(false);
  const [dailyStats, setDailyStats] = useState<RiderDailyStats>({});
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsPeriod, setStatsPeriod] = useState("month");
  const [activeView, setActiveView] = useState<"stats" | "edit">("stats");

  useEffect(() => {
    setLocalRiders(riders.map((r) => ({ ...r })));
  }, [riders, open]);

  useEffect(() => {
    if (!open || riders.length === 0) return;
    loadStats();
  }, [riders, open, statsPeriod]);

  const loadStats = async () => {
    setStatsLoading(true);
    try {
      const now = new Date();
      let dateFrom: string;
      if (statsPeriod === "today") dateFrom = format(startOfDay(now), "yyyy-MM-dd");
      else if (statsPeriod === "week") dateFrom = format(startOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd");
      else dateFrom = format(startOfMonth(now), "yyyy-MM-dd");

      const data = await adminApi.getRiderDailyStats(riders.map((r) => r.id), dateFrom);
      setDailyStats(data);
    } catch { /* silent */ }
    finally { setStatsLoading(false); }
  };

  const handleSaveAll = async () => {
    setSaving(true);
    try {
      for (const r of localRiders) {
        if (!r.label.trim() || !r.name.trim()) continue;
        await adminApi.saveRider({
          id: r._new ? undefined : r.id,
          label: r.label.trim(),
          name: r.name.trim(),
          active: r.active,
          sort_order: r.sort_order,
        });
      }
      toast({ title: "Motoboys salvos com sucesso!" });
      onSave();
      onOpenChange(false);
    } catch (err) {
      toast({ title: "Erro ao salvar", description: err instanceof Error ? err.message : "Erro", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const addRider = () => {
    setLocalRiders((prev) => [
      ...prev,
      { id: crypto.randomUUID(), label: "", name: "", active: true, sort_order: prev.length, created_at: "", _new: true },
    ]);
  };

  const getTodayTotal = (riderId: string) => {
    const today = format(new Date(), "yyyy-MM-dd");
    const days = dailyStats[riderId] || [];
    const t = days.find((d) => d.dia === today);
    return t?.total_galoes ?? 0;
  };

  const getMonthTotal = (riderId: string) => {
    const days = dailyStats[riderId] || [];
    return days.reduce((s, d) => s + d.total_galoes, 0);
  };

  const getPeriodPedidos = (riderId: string) => {
    const days = dailyStats[riderId] || [];
    return days.reduce((s, d) => s + d.total_pedidos, 0);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Gerenciar motoboys</DialogTitle></DialogHeader>

        {/* Toggle stats/edit */}
        <div className="flex gap-2 mb-2">
          <Button variant={activeView === "stats" ? "default" : "outline"} size="sm" onClick={() => setActiveView("stats")}>
            📊 Estatísticas
          </Button>
          <Button variant={activeView === "edit" ? "default" : "outline"} size="sm" onClick={() => setActiveView("edit")}>
            ✏️ Editar
          </Button>
        </div>

        {activeView === "stats" && (
          <div className="space-y-4">
            {/* Period filter */}
            <Select value={statsPeriod} onValueChange={setStatsPeriod}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Hoje</SelectItem>
                <SelectItem value="week">Esta semana</SelectItem>
                <SelectItem value="month">Este mês</SelectItem>
              </SelectContent>
            </Select>

            {/* Summary cards */}
            <div className="grid grid-cols-2 gap-3">
              {riders.map((r) => (
                <Card key={r.id}>
                  <CardContent className="p-3 text-center">
                    <p className="text-2xl font-bold text-[hsl(var(--brand-blue))]">{r.label}</p>
                    <p className="text-sm font-medium">{r.name}</p>
                    <div className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                      <p>Hoje: <strong className="text-foreground">{getTodayTotal(r.id)} gal</strong></p>
                      <p>Período: <strong className="text-foreground">{getMonthTotal(r.id)} gal · {getPeriodPedidos(r.id)} ped.</strong></p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Daily breakdown per rider */}
            {statsLoading ? (
              <p className="text-center text-sm text-muted-foreground py-4"><Loader2 className="inline h-4 w-4 animate-spin mr-1" />Carregando...</p>
            ) : (
              riders.map((r) => {
                const days = dailyStats[r.id] || [];
                return (
                  <div key={r.id} className="space-y-1">
                    <p className="text-sm font-semibold">{r.label} — {r.name}</p>
                    {days.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic">Sem entregas neste período.</p>
                    ) : (
                      <div className="border rounded-lg overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-xs h-8">Data</TableHead>
                              <TableHead className="text-xs h-8 text-right">Galões</TableHead>
                              <TableHead className="text-xs h-8 text-right">Pedidos</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {days.map((d) => (
                              <TableRow key={d.dia}>
                                <TableCell className="text-xs py-1.5">{format(new Date(`${d.dia}T12:00:00`), "dd/MM/yyyy")}</TableCell>
                                <TableCell className="text-xs py-1.5 text-right font-medium">{d.total_galoes}</TableCell>
                                <TableCell className="text-xs py-1.5 text-right">{d.total_pedidos}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Total: <strong>{getMonthTotal(r.id)} galões · {getPeriodPedidos(r.id)} pedidos</strong>
                    </p>
                  </div>
                );
              })
            )}
          </div>
        )}

        {activeView === "edit" && (
          <div className="space-y-3">
            {localRiders.map((r, i) => (
              <div key={r.id} className="flex gap-2 items-start border rounded-lg p-3">
                <div className="flex-1 space-y-2">
                  <div className="flex gap-2">
                    <div className="w-16">
                      <label className="text-xs font-medium">Inicial</label>
                      <Input
                        value={r.label}
                        onChange={(e) => {
                          const copy = [...localRiders];
                          copy[i] = { ...copy[i], label: e.target.value.slice(0, 3) };
                          setLocalRiders(copy);
                        }}
                        maxLength={3}
                        className="text-center font-bold"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-xs font-medium">Nome</label>
                      <Input
                        value={r.name}
                        onChange={(e) => {
                          const copy = [...localRiders];
                          copy[i] = { ...copy[i], name: e.target.value };
                          setLocalRiders(copy);
                        }}
                        maxLength={50}
                      />
                    </div>
                  </div>
                </div>
                <div className="flex flex-col gap-1 mt-5">
                  <Button
                    variant={r.active ? "outline" : "destructive"}
                    size="sm"
                    onClick={() => {
                      const copy = [...localRiders];
                      copy[i] = { ...copy[i], active: !copy[i].active };
                      setLocalRiders(copy);
                    }}
                  >
                    {r.active ? "Ativo" : "Inativo"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={async () => {
                      if (!confirm(`Excluir o motoboy "${r.name}"? Esta ação não pode ser desfeita.`)) return;
                      if (r._new) {
                        setLocalRiders((prev) => prev.filter((_, idx) => idx !== i));
                        return;
                      }
                      try {
                        await adminApi.deleteRider(r.id);
                        toast({ title: "Motoboy excluído." });
                        setLocalRiders((prev) => prev.filter((_, idx) => idx !== i));
                        onSave();
                      } catch (err) {
                        toast({ title: "Erro ao excluir", description: err instanceof Error ? err.message : "Erro", variant: "destructive" });
                      }
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
            <Button variant="outline" className="w-full" onClick={addRider}>
              <Plus className="h-4 w-4 mr-1" /> Adicionar motoboy
            </Button>
            <Button className="w-full" onClick={handleSaveAll} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
              Salvar
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ---- Save Customer From Order Modal ----
function SaveCustomerModal({
  open, onOpenChange, order, onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  order: AdminOrderRow | null;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (order) {
      setName(order.customers?.name || "");
      setPhone(order.customers?.phone || "");
    }
  }, [order, open]);

  const handleSave = async () => {
    if (!order || !name.trim()) {
      toast({ title: "Nome é obrigatório", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      // Check duplicate address
      if (order.addresses?.street && order.addresses?.number) {
        const dup = await adminApi.checkDuplicateAddress(order.addresses.street, order.addresses.number);
        if (dup && dup.customers) {
          toast({
            title: "Endereço já cadastrado",
            description: `Cliente existente: ${dup.customers.name} — ${order.addresses.street}, ${order.addresses.number}`,
            variant: "destructive",
          });
          setSaving(false);
          return;
        }
      }

      await adminApi.saveCustomerFromOrder({
        orderId: order.id,
        customer: { name: name.trim(), phone: phone.trim() || undefined },
        address: order.addresses ? {
          street: order.addresses.street,
          number: order.addresses.number,
          neighborhood: order.addresses.neighborhood,
          city: order.addresses.city,
          complement: order.addresses.complement || undefined,
        } : undefined,
      });
      toast({ title: "Cliente cadastrado e vinculado ao pedido." });
      onSaved();
      onOpenChange(false);
    } catch (err) {
      toast({ title: "Erro", description: err instanceof Error ? err.message : "Erro", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Salvar como cliente</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium">Nome *</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} />
          </div>
          <div>
            <label className="text-sm font-medium">Telefone</label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" maxLength={20} />
          </div>
          {order?.addresses && (
            <div className="text-sm text-muted-foreground border rounded p-2">
              <p className="font-medium text-foreground">Endereço do pedido:</p>
              <p>{order.addresses.street}, {order.addresses.number} — {order.addresses.neighborhood}</p>
            </div>
          )}
          <Button className="w-full" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <UserPlus className="h-4 w-4 mr-1" />}
            Cadastrar cliente
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---- Mobile Order Card ----
function PixBadge({ order, onToggle }: { order: AdminOrderRow; onToggle: () => void }) {
  if (order.payment_method !== "pix") return null;
  const paid = !!order.pix_paid;
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onToggle(); }}
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold transition-colors cursor-pointer border ${
        paid
          ? "bg-green-100 text-green-800 border-green-300 hover:bg-green-200"
          : "bg-orange-100 text-orange-800 border-orange-300 hover:bg-orange-200"
      }`}
    >
      {paid ? "PIX Pago ✓" : "PIX Pendente"}
    </button>
  );
}

function OrderCard({
  o, riders, statusLabels, statusColors, paymentLabels,
  onView, onLabel, onWhatsApp, onStatusChange, onRiderToggle, onPixToggle,
}: {
  o: AdminOrderRow;
  riders: DeliveryRider[];
  statusLabels: Record<string, string>;
  statusColors: Record<string, string>;
  paymentLabels: Record<string, string>;
  onView: () => void;
  onLabel: () => void;
  onWhatsApp: () => void;
  onStatusChange: (status: string) => void;
  onRiderToggle: (riderId: string) => void;
  onPixToggle: () => void;
}) {
  return (
    <Card className="mb-3">
      <CardContent className="p-3 space-y-2">
        <div className="flex justify-between items-start">
          <div>
            <p className="font-mono text-xs text-muted-foreground">{o.id.slice(0, 8)}</p>
            <p className="text-sm font-medium">
              {o.addresses
                ? `${o.addresses.street}, ${o.addresses.number}`
                : "Retirada na loja"}
            </p>
            {o.customers?.name && (
              <p className="text-xs text-muted-foreground">{o.customers.name}</p>
            )}
          </div>
          <FulfillmentBadge type={o.fulfillment_type} />
        </div>

        <div className="text-xs text-muted-foreground">
          {o.order_items.map((i) => `${i.products?.name ?? "?"} x${i.qty}`).join(", ")}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Select value={o.status} onValueChange={onStatusChange}>
            <SelectTrigger className="h-7 text-xs w-[110px]">
              <Badge className={`${statusColors[o.status]} text-xs`}>{statusLabels[o.status]}</Badge>
            </SelectTrigger>
            <SelectContent>
              {Constants.public.Enums.order_status.map((s) => (
                <SelectItem key={s} value={s}>{statusLabels[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {o.payment_method && (
            <Badge variant="outline" className="text-xs">{paymentLabels[o.payment_method] || o.payment_method}</Badge>
          )}
          <PixBadge order={o} onToggle={onPixToggle} />
        </div>

        {/* Rider toggles - mobile */}
        {riders.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground font-medium">Motoboy:</span>
            {riders.map((r) => (
              <button
                key={r.id}
                type="button"
                className={`min-h-[44px] min-w-[44px] rounded-lg border-2 text-sm font-bold flex items-center justify-center transition-colors ${
                  o.rider_id === r.id
                    ? "border-[hsl(var(--brand-blue))] bg-[hsl(var(--brand-blue))] text-white"
                    : "border-muted-foreground/30 text-muted-foreground bg-background"
                }`}
                onClick={() => onRiderToggle(r.id)}
                title={r.name}
              >
                {r.label}
              </button>
            ))}
          </div>
        )}

        <div className="flex gap-1 justify-end pt-1 border-t">
          <Button variant="ghost" size="sm" className="h-7" onClick={onView}><Eye className="h-3.5 w-3.5 mr-1" /> Ver</Button>
          <Button variant="ghost" size="sm" className="h-7" onClick={onLabel}><Printer className="h-3.5 w-3.5" /></Button>
          <Button variant="ghost" size="sm" className="h-7" onClick={onWhatsApp}><MessageCircle className="h-3.5 w-3.5" /></Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function OrdersTab() {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [orders, setOrders] = useState<AdminOrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [periodFilter, setPeriodFilter] = useState("all");
  const [selectedOrder, setSelectedOrder] = useState<AdminOrderRow | null>(null);
  const [labelData, setLabelData] = useState<LabelData | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [pixSubFilter, setPixSubFilter] = useState("all");

  // Riders
  const [riders, setRiders] = useState<DeliveryRider[]>([]);
  const [riderModalOpen, setRiderModalOpen] = useState(false);

  // Save customer from order
  const [saveCustomerOrder, setSaveCustomerOrder] = useState<AdminOrderRow | null>(null);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const data = await adminApi.listOrders();
      setOrders(data ?? []);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao carregar pedidos";
      toast({ title: "Erro ao carregar pedidos", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const fetchRiders = useCallback(async () => {
    try {
      const data = await adminApi.listRiders();
      setRiders((data ?? []).filter((r) => r.active));
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    fetchOrders();
    fetchRiders();
  }, []);

  const filtered = useMemo(() => {
    let result = orders;
    if (statusFilter !== "all") result = result.filter((o) => o.status === statusFilter);

    if (periodFilter !== "all") {
      const now = new Date();
      let cutoff: Date;
      if (periodFilter === "today") cutoff = startOfDay(now);
      else if (periodFilter === "week") cutoff = startOfWeek(now, { weekStartsOn: 1 });
      else cutoff = startOfMonth(now);
      result = result.filter((o) => new Date(o.created_at) >= cutoff);
    }

    if (paymentFilter !== "all") {
      result = result.filter((o) => o.payment_method === paymentFilter);
      if (paymentFilter === "pix" && pixSubFilter !== "all") {
        result = result.filter((o) =>
          pixSubFilter === "paid" ? !!o.pix_paid : !o.pix_paid
        );
      }
    }

    if (search) {
      const s = search.toLowerCase();
      result = result.filter(
        (o) =>
          o.customers?.name?.toLowerCase().includes(s) ||
          o.customers?.phone?.toLowerCase().includes(s) ||
          o.addresses?.street?.toLowerCase().includes(s) ||
          o.order_items.some((i) => i.products?.name?.toLowerCase().includes(s)) ||
          o.id.toLowerCase().includes(s),
      );
    }

    return result;
  }, [orders, statusFilter, periodFilter, paymentFilter, pixSubFilter, search]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, periodFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const paginatedOrders = filtered.slice(pageStart, pageStart + PAGE_SIZE);

  const updateStatus = async (orderId: string, newStatus: string) => {
    try {
      await adminApi.updateOrderStatus(orderId, newStatus);
      toast({ title: "Status atualizado" });
      fetchOrders();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao atualizar status";
      toast({ title: "Não foi possível atualizar", description: message, variant: "destructive" });
    }
  };

  const toggleRider = async (orderId: string, riderId: string, currentRiderId: string | null) => {
    const newRiderId = currentRiderId === riderId ? null : riderId;
    // Optimistic update
    setOrders((prev) => prev.map((o) => o.id === orderId ? { ...o, rider_id: newRiderId } : o));
    try {
      await adminApi.setOrderRider(orderId, newRiderId);
    } catch (err) {
      toast({ title: "Erro ao atribuir motoboy", variant: "destructive" });
      fetchOrders();
    }
  };

  const handleLabel = (o: AdminOrderRow) => {
    setLabelData({
      pedidoId: o.id.slice(0, 8).toUpperCase(),
      cliente: o.customers?.name ?? "Retirada / Sem cadastro",
      endereco: o.addresses
        ? `${o.addresses.street}, ${o.addresses.number} - ${o.addresses.neighborhood}, ${o.addresses.city}`
        : (o.fulfillment_type === "pickup" ? "Retirada na loja" : "—"),
      complemento: o.addresses?.complement ?? undefined,
      itens: o.order_items.map((i) => ({ nome: i.products?.name ?? "—", qtd: i.qty })),
      entregaData: o.delivery_date ? format(new Date(`${o.delivery_date}T12:00:00`), "dd/MM/yyyy") : undefined,
      entregaHora: o.delivery_time ?? undefined,
      pagamento: o.payment_method ?? undefined,
      obs: o.notes ?? undefined,
      totalAmount: o.total_amount ?? undefined,
      changeFor: o.change_for ?? undefined,
    });
  };

  const handleWhatsApp = (o: AdminOrderRow) => {
    const payLabel = o.payment_method ? (paymentLabels[o.payment_method]?.replace(/^[^\w]*/, "").trim() || o.payment_method) : undefined;
    const msg = buildOrderMessage({
      tipo: o.customers?.cnpj ? "EMPRESA" : "VAREJO",
      canal: o.channel as any,
      cliente: o.customers?.name ?? "Retirada / Sem cadastro",
      cnpj: o.customers?.cnpj ?? undefined,
      telefone: o.customers?.phone ?? "",
      endereco: o.addresses ? {
        rua: o.addresses.street ?? "",
        numero: o.addresses.number ?? "",
        bairro: o.addresses.neighborhood ?? "",
        cidade: o.addresses.city ?? "",
        uf: "SP",
        complemento: o.addresses.complement ?? undefined,
      } : undefined,
      obs: o.notes ?? undefined,
      itens: o.order_items.map((i) => ({ nome: i.products?.name ?? "—", qtd: i.qty })),
      entregaData: o.delivery_date ? format(new Date(`${o.delivery_date}T12:00:00`), "dd/MM/yyyy") : undefined,
      entregaHora: o.delivery_time ?? undefined,
      status: statusLabels[o.status] ?? o.status,
      pedidoId: o.id.slice(0, 8).toUpperCase(),
      fulfillmentType: (o.fulfillment_type ?? "delivery") as "delivery" | "pickup",
      formaPagamento: payLabel,
      totalAmount: o.total_amount ?? undefined,
      changeFor: o.change_for ?? undefined,
    });
    openWhatsApp(msg);
  };

  const handleCustomerSaved = () => {
    fetchOrders();
    setSelectedOrder(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar cliente, produto ou ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {Constants.public.Enums.order_status.map((s) => (
              <SelectItem key={s} value={s}>{statusLabels[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={periodFilter} onValueChange={setPeriodFilter}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Período" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="today">Hoje</SelectItem>
            <SelectItem value="week">Semana</SelectItem>
            <SelectItem value="month">Mês</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={fetchOrders} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Button variant="outline" size="icon" onClick={() => setRiderModalOpen(true)} title="Gerenciar motoboys">
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* MOBILE: Card layout */}
      {isMobile ? (
        <div>
          {loading ? (
            <p className="text-center py-8 text-muted-foreground">Carregando...</p>
          ) : paginatedOrders.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">Nenhum pedido encontrado.</p>
          ) : (
            paginatedOrders.map((o) => (
              <OrderCard
                key={o.id}
                o={o}
                riders={riders}
                statusLabels={statusLabels}
                statusColors={statusColors}
                paymentLabels={paymentLabels}
                onView={() => setSelectedOrder(o)}
                onLabel={() => handleLabel(o)}
                onWhatsApp={() => handleWhatsApp(o)}
                onStatusChange={(v) => updateStatus(o.id, v)}
                onRiderToggle={(rid) => toggleRider(o.id, rid, o.rider_id)}
              />
            ))
          )}
        </div>
      ) : (
        /* DESKTOP: Table layout */
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Endereço</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Canal</TableHead>
                  <TableHead>Entrega</TableHead>
                  <TableHead>Criado</TableHead>
                  <TableHead>Itens</TableHead>
                  <TableHead>Pgto</TableHead>
                  <TooltipProvider>
                    {riders.map((r) => (
                      <TableHead key={r.id} className="text-center w-10 px-1">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="font-bold cursor-default">{r.label}</span>
                          </TooltipTrigger>
                          <TooltipContent>{r.name}</TooltipContent>
                        </Tooltip>
                      </TableHead>
                    ))}
                  </TooltipProvider>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={10 + riders.length} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
                ) : paginatedOrders.length === 0 ? (
                  <TableRow><TableCell colSpan={10 + riders.length} className="text-center py-8 text-muted-foreground">Nenhum pedido encontrado.</TableCell></TableRow>
                ) : (
                  paginatedOrders.map((o) => (
                    <TableRow key={o.id}>
                      <TableCell className="font-mono text-xs">{o.id.slice(0, 8)}</TableCell>
                      <TableCell className="text-sm">
                        {o.addresses
                          ? `${o.addresses.street}, ${o.addresses.number} — ${o.addresses.neighborhood}`
                          : "Retirada na loja"}
                      </TableCell>
                      <TableCell>
                        <FulfillmentBadge type={o.fulfillment_type} />
                      </TableCell>
                      <TableCell className="text-xs">{o.channel}</TableCell>
                      <TableCell className="text-xs">
                        {o.delivery_date ? format(new Date(`${o.delivery_date}T12:00:00`), "dd/MM") : "—"}
                        {o.delivery_time ? ` ${o.delivery_time}` : ""}
                      </TableCell>
                      <TableCell className="text-xs">
                        {format(new Date(o.created_at), "dd/MM/yyyy 'às' HH:mm")}
                      </TableCell>
                      <TableCell className="text-xs">
                        {o.order_items.map((i) => `${i.products?.name ?? "?"} x${i.qty}`).join(", ")}
                      </TableCell>
                      <TableCell className="text-xs">
                        {o.payment_method ? (
                          <Badge variant="outline" className="text-xs">{paymentLabels[o.payment_method] || o.payment_method}</Badge>
                        ) : "—"}
                      </TableCell>
                      {/* Rider columns */}
                      {riders.map((r) => (
                        <TableCell key={r.id} className="text-center px-1">
                          <button
                            type="button"
                            className={`h-7 w-7 rounded border text-xs font-bold mx-auto flex items-center justify-center transition-colors ${
                              o.rider_id === r.id
                                ? "border-[hsl(var(--brand-blue))] text-[hsl(var(--brand-blue))] bg-[hsl(var(--brand-blue))]/10"
                                : "border-dashed border-muted-foreground/30 text-transparent hover:border-muted-foreground/60"
                            }`}
                            onClick={() => toggleRider(o.id, r.id, o.rider_id)}
                          >
                            {o.rider_id === r.id ? "✕" : "·"}
                          </button>
                        </TableCell>
                      ))}
                      <TableCell>
                        <Select value={o.status} onValueChange={(v) => updateStatus(o.id, v)}>
                          <SelectTrigger className="h-7 text-xs w-[110px]">
                            <Badge className={`${statusColors[o.status]} text-xs`}>{statusLabels[o.status]}</Badge>
                          </SelectTrigger>
                          <SelectContent>
                            {Constants.public.Enums.order_status.map((s) => (
                              <SelectItem key={s} value={s}>{statusLabels[s]}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSelectedOrder(o)} title="Detalhes"><Eye className="h-3.5 w-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleLabel(o)} title="Etiqueta"><Printer className="h-3.5 w-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleWhatsApp(o)} title="WhatsApp"><MessageCircle className="h-3.5 w-3.5" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {filtered.length > PAGE_SIZE && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Página {currentPage} de {totalPages}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1}>
              <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
            </Button>
            <Button variant="outline" size="sm" onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
              Próxima <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* Order Detail Dialog */}
      <Dialog open={!!selectedOrder} onOpenChange={() => setSelectedOrder(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Pedido {selectedOrder?.id.slice(0, 8).toUpperCase()}</DialogTitle></DialogHeader>
          {selectedOrder && (
            <div className="space-y-3 text-sm">
              <p><strong>Cliente:</strong> {selectedOrder.customers?.name ?? "Retirada / Sem cadastro"}</p>
              <p><strong>Telefone:</strong> {selectedOrder.customers?.phone ?? "—"}</p>
              {selectedOrder.customers?.cnpj && <p><strong>CNPJ:</strong> {selectedOrder.customers.cnpj}</p>}
              <p><strong>Atendimento:</strong> <FulfillmentBadge type={selectedOrder.fulfillment_type} /></p>
              {selectedOrder.fulfillment_type !== "pickup" && (
                <p><strong>Endereço:</strong> {selectedOrder.addresses ? `${selectedOrder.addresses.street}, ${selectedOrder.addresses.number} - ${selectedOrder.addresses.neighborhood}` : "—"}</p>
              )}
              {selectedOrder.addresses?.complement && <p><strong>Complemento:</strong> {selectedOrder.addresses.complement}</p>}
              <p><strong>Canal:</strong> {selectedOrder.channel}</p>
              <p><strong>Entrega:</strong> {selectedOrder.delivery_date ?? "—"} {selectedOrder.delivery_time ?? ""}</p>
              <p><strong>Pagamento:</strong> {selectedOrder.payment_method ? (paymentLabels[selectedOrder.payment_method] || selectedOrder.payment_method) : "—"}</p>
              {selectedOrder.total_amount != null && (
                <p><strong>Total:</strong> {formatCurrency(selectedOrder.total_amount)}</p>
              )}
              {selectedOrder.payment_method === "cash" && selectedOrder.change_for != null && (
                <p><strong>Troco para:</strong> {formatCurrency(selectedOrder.change_for)}
                  {selectedOrder.total_amount != null && (
                    <span className="text-muted-foreground"> (Troco: {formatCurrency(selectedOrder.change_for - selectedOrder.total_amount)})</span>
                  )}
                </p>
              )}
              <p><strong>Motoboy:</strong> {(() => {
                const r = riders.find((r) => r.id === selectedOrder.rider_id);
                return r ? `${r.label} — ${r.name}` : "Não atribuído";
              })()}</p>
              <p><strong>Criado em:</strong> {format(new Date(selectedOrder.created_at), "dd/MM/yyyy 'às' HH:mm")}</p>
              <p><strong>Itens:</strong></p>
              <ul className="list-disc list-inside">
                {selectedOrder.order_items.map((i, idx) => (<li key={idx}>{i.products?.name}: {i.qty}</li>))}
              </ul>
              {selectedOrder.notes && <p><strong>Obs:</strong> {selectedOrder.notes}</p>}
              <div className="flex gap-2 pt-2 flex-wrap">
                <Button size="sm" variant="outline" onClick={() => { handleLabel(selectedOrder); setSelectedOrder(null); }}>
                  <Printer className="h-4 w-4 mr-1" /> Etiqueta
                </Button>
                <Button size="sm" className="bg-[hsl(var(--whatsapp))] hover:bg-[hsl(var(--whatsapp))]/90 text-white" onClick={() => handleWhatsApp(selectedOrder)}>
                  <MessageCircle className="h-4 w-4 mr-1" /> WhatsApp
                </Button>
                {!selectedOrder.customers?.id && (
                  <Button size="sm" variant="outline" onClick={() => setSaveCustomerOrder(selectedOrder)}>
                    <UserPlus className="h-4 w-4 mr-1" /> Salvar como cliente
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!labelData} onOpenChange={() => setLabelData(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Etiqueta</DialogTitle></DialogHeader>
          {labelData && <OrderLabel data={labelData} />}
        </DialogContent>
      </Dialog>

      <RiderManagementModal
        open={riderModalOpen}
        onOpenChange={setRiderModalOpen}
        riders={riders}
        onSave={fetchRiders}
      />

      <SaveCustomerModal
        open={!!saveCustomerOrder}
        onOpenChange={(o) => !o && setSaveCustomerOrder(null)}
        order={saveCustomerOrder}
        onSaved={handleCustomerSaved}
      />
    </div>
  );
}
