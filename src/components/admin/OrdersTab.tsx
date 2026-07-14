import { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Switch } from "@/components/ui/switch";
import { OrderLabel, type LabelData } from "@/components/OrderLabel";
import { openWhatsApp, buildOrderMessage } from "@/services/whatsapp";
import { Search, MessageCircle, Printer, Eye, RefreshCw, ChevronLeft, ChevronRight, Truck, Store, Settings, Plus, UserPlus, Loader2, Trash2, Pencil, CalendarClock, Bell, X } from "lucide-react";
import { PaymentIcon, PAYMENT_LABELS } from "@/components/PaymentIcon";
import { Textarea } from "@/components/ui/textarea";
import { QuantityInput } from "@/components/ui/quantity-input";
import { useToast } from "@/hooks/use-toast";
import { format, startOfDay, startOfWeek, startOfMonth } from "date-fns";
import { Constants } from "@/integrations/supabase/types";
import { adminApi, type AdminOrderRow, type DeliveryRider, type AdminProductRow } from "@/services/admin-api";
import { useIsMobile } from "@/hooks/use-mobile";
import { useDebounce } from "@/hooks/use-debounce";
import {
  isScheduledToday, isScheduledFuture, isScheduledLate,
  getScheduleLabel, getScheduleBadgeType, formatTimeValue,
} from "@/lib/schedulingRules";

const statusColors: Record<string, string> = {
  novo: "bg-blue-100 text-blue-800",
  agendado: "bg-yellow-100 text-yellow-800",
  em_rota: "bg-orange-100 text-orange-800",
  entregue: "bg-green-100 text-green-800",
  cancelado: "bg-red-100 text-red-800",
};

const paymentLabels: Record<string, string> = {
  cash: "Dinheiro",
  pix: "PIX",
  card: "Cartão",
};

function PaymentBadge({ method, className }: { method: string | null | undefined; className?: string }) {
  if (!method) return null;
  const label = paymentLabels[method] || method;
  return (
    <Badge variant="outline" className={`text-xs gap-1 ${className ?? ""}`}>
      <PaymentIcon method={method} size={12} />
      {label}
    </Badge>
  );
}

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
      // Check duplicate address (including complement)
      if (order.addresses?.street && order.addresses?.number) {
        const dup = await adminApi.checkDuplicateAddress(
          order.addresses.street,
          order.addresses.number,
          order.addresses.complement || ""
        );
        if (dup && dup.customers) {
          const complementInfo = order.addresses.complement ? `, ${order.addresses.complement}` : "";
          toast({
            title: "Endereço já cadastrado",
            description: `Cliente existente: ${dup.customers.name} — ${order.addresses.street}, ${order.addresses.number}${complementInfo}`,
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

function ScheduledBadge({ order, now }: { order: AdminOrderRow; now?: Date }) {
  if (!order.scheduled_date) return null;
  const currentNow = now ?? new Date();
  const badgeType = getScheduleBadgeType(order, currentNow);
  if (!badgeType) return null;
  const label = getScheduleLabel(order.scheduled_date, order.scheduled_time, currentNow);

  const styles = {
    late: "bg-red-100 text-red-800 border-red-300",
    today: "bg-amber-100 text-amber-800 border-amber-300",
    future: "bg-[#033D7B]/10 text-[#033D7B] border-[#033D7B]/30",
  };
  const icons = { late: "🔴", today: "🟡", future: "📅" };

  return (
    <Badge className={`text-xs gap-1 ${styles[badgeType]}`} variant="outline">
      <CalendarClock className="h-3 w-3" />
      {icons[badgeType]} {badgeType === "late" ? `Em atraso · ${label}` : label}
    </Badge>
  );
}

function ReminderModal({
  open, onOpenChange, orders, onViewOrders, onDismiss,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  orders: AdminOrderRow[];
  onViewOrders: () => void;
  onDismiss: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-[#033D7B]" /> Pedidos para hoje
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Você tem <strong>{orders.length}</strong> pedido{orders.length !== 1 ? "s" : ""} agendado{orders.length !== 1 ? "s" : ""} para hoje ou em atraso:
          </p>
          <div className="max-h-[300px] overflow-y-auto space-y-2">
            {orders.map((o) => (
              <div key={o.id} className="border rounded-lg p-2 text-sm">
                <p className="font-medium">
                  {o.addresses ? `${o.addresses.street}, ${o.addresses.number}` : "Retirada na loja"}
                  {o.scheduled_time ? ` — ${o.scheduled_time}` : ""}
                </p>
                <p className="text-xs text-muted-foreground">
                  {o.order_items.map((i) => `${i.qty}x ${i.products?.name ?? "?"}`).join(", ")}
                </p>
              </div>
            ))}
          </div>
          <div className="flex gap-2 pt-2">
            <Button className="flex-1" onClick={onViewOrders}>Ver pedidos</Button>
            <Button variant="outline" className="flex-1" onClick={onDismiss}>Dispensar por hoje</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function OrderCard({
  o, riders, statusLabels, statusColors, paymentLabels,
  onView, onEdit, onLabel, onWhatsApp, onStatusChange, onRiderToggle, onPixToggle,
}: {
  o: AdminOrderRow;
  riders: DeliveryRider[];
  statusLabels: Record<string, string>;
  statusColors: Record<string, string>;
  paymentLabels: Record<string, string>;
  onView: () => void;
  onEdit: () => void;
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
          <div className="flex flex-col gap-1 items-end">
            <FulfillmentBadge type={o.fulfillment_type} />
            <ScheduledBadge order={o} />
          </div>
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

          {o.payment_method && <PaymentBadge method={o.payment_method} />}
          <PixBadge order={o} onToggle={onPixToggle} />
          {o.status === "em_rota" && o.em_rota_at && (
            <span className="text-[10px] text-muted-foreground">
              saiu às {format(new Date(o.em_rota_at), "HH:mm")}
            </span>
          )}
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
          <Button variant="ghost" size="sm" className="h-7" onClick={onEdit}><Pencil className="h-3.5 w-3.5" /></Button>
          <Button variant="ghost" size="sm" className="h-7" onClick={onLabel}><Printer className="h-3.5 w-3.5" /></Button>
          <Button variant="ghost" size="sm" className="h-7" onClick={onWhatsApp}><MessageCircle className="h-3.5 w-3.5" /></Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ---- Edit Order Modal ----
function EditOrderModal({
  open, onOpenChange, order, riders, onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  order: AdminOrderRow | null;
  riders: DeliveryRider[];
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [products, setProducts] = useState<AdminProductRow[]>([]);

  // Form state
  const [status, setStatus] = useState("");
  const [notes, setNotes] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [deliveryTime, setDeliveryTime] = useState("");
  const [fulfillmentType, setFulfillmentType] = useState("delivery");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [changeFor, setChangeFor] = useState("");
  const [riderId, setRiderId] = useState<string | null>(null);
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [scheduleEnabled, setScheduleEnabled] = useState(false);

  // Address
  const [street, setStreet] = useState("");
  const [number, setNumber] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [city, setCity] = useState("");
  const [complement, setComplement] = useState("");

  // Items
  const [items, setItems] = useState<{ product_id: string; qty: number; name: string }[]>([]);

  useEffect(() => {
    if (!open || !order) return;
    setStatus(order.status);
    setNotes(order.notes || "");
    setDeliveryDate(order.delivery_date || "");
    setDeliveryTime(formatTimeValue(order.delivery_time || ""));
    setFulfillmentType(order.fulfillment_type || "delivery");
    setPaymentMethod(order.payment_method || "");
    setTotalAmount(order.total_amount != null ? String(order.total_amount) : "");
    setChangeFor(order.change_for != null ? String(order.change_for) : "");
    setRiderId(order.rider_id);
    setScheduledDate(order.scheduled_date || "");
    setScheduledTime(formatTimeValue(order.scheduled_time || ""));
    setScheduleEnabled(!!order.scheduled_date);
    setStreet(order.addresses?.street || "");
    setNumber(order.addresses?.number || "");
    setNeighborhood(order.addresses?.neighborhood || "");
    setCity(order.addresses?.city || "Santo André");
    setComplement(order.addresses?.complement || "");
    setItems(order.order_items.map((i) => ({
      product_id: i.product_id || "",
      qty: i.qty,
      name: i.products?.name || "?",
    })));

    // Load products for dropdown
    adminApi.listProducts().then(({ products: prods }) => setProducts(prods.filter((p) => p.active))).catch(() => {});
  }, [open, order]);

  const handleSave = async () => {
    if (!order) return;
    if (fulfillmentType === "delivery") {
      if (!street.trim() || !number.trim() || !neighborhood.trim() || !city.trim()) {
        toast({
          title: "Endereço incompleto",
          description: "Preencha Rua, Número, Bairro e Cidade para entrega.",
          variant: "destructive",
        });
        return;
      }
    }
    setSaving(true);
    try {
      await adminApi.updateOrder({
        orderId: order.id,
        order: {
          status,
          notes: notes || null,
          delivery_date: deliveryDate || null,
          delivery_time: deliveryTime || null,
          fulfillment_type: fulfillmentType,
          payment_method: paymentMethod || null,
          total_amount: totalAmount ? parseFloat(totalAmount) : null,
          change_for: changeFor ? parseFloat(changeFor) : null,
          rider_id: riderId,
          scheduled_date: scheduleEnabled ? (scheduledDate || deliveryDate || null) : null,
          scheduled_time: scheduleEnabled ? (scheduledTime || deliveryTime || null) : null,
        },
        items: items.filter((i) => i.product_id && i.qty > 0).map((i) => ({ product_id: i.product_id, qty: i.qty })),
        address: fulfillmentType === "delivery" ? { street, number, neighborhood, city, complement } : null,
      });
      toast({ title: "Pedido atualizado com sucesso." });
      onSaved();
      onOpenChange(false);
    } catch (err) {
      toast({ title: "Erro ao salvar", description: err instanceof Error ? err.message : "Erro", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const addItem = () => setItems((prev) => [...prev, { product_id: "", qty: 1, name: "" }]);
  const removeItem = (idx: number) => setItems((prev) => prev.filter((_, i) => i !== idx));

  if (!order) return null;

  const isFinalized = order.status === "entregue" || order.status === "cancelado";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Editar Pedido {order.id.slice(0, 8).toUpperCase()}</DialogTitle></DialogHeader>

        {isFinalized && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-2 text-xs text-yellow-800">
            ⚠️ Este pedido já foi finalizado ({statusLabels[order.status]}). Edite com cuidado.
          </div>
        )}

        <div className="space-y-4 text-sm">
          {/* Status */}
          <div>
            <label className="text-xs font-medium">Status</label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Constants.public.Enums.order_status.map((s) => (
                  <SelectItem key={s} value={s}>{statusLabels[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Items */}
          <div>
            <label className="text-xs font-medium">Itens</label>
            <div className="space-y-2 mt-1">
              {items.map((item, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <Select value={item.product_id} onValueChange={(v) => {
                    const prod = products.find((p) => p.id === v);
                    setItems((prev) => prev.map((it, i) => i === idx ? { ...it, product_id: v, name: prod?.name || "" } : it));
                  }}>
                    <SelectTrigger className="flex-1"><SelectValue placeholder="Produto" /></SelectTrigger>
                    <SelectContent>
                      {products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <QuantityInput
                    value={item.qty}
                    min={1}
                    onChange={(n) => setItems((prev) => prev.map((it, i) => i === idx ? { ...it, qty: Math.max(1, n) } : it))}
                  />
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeItem(idx)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addItem}><Plus className="h-3.5 w-3.5 mr-1" /> Adicionar item</Button>
            </div>
          </div>

          {/* Fulfillment */}
          <div>
            <label className="text-xs font-medium">Tipo de Atendimento</label>
            <Select value={fulfillmentType} onValueChange={setFulfillmentType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="delivery">Entrega</SelectItem>
                <SelectItem value="pickup">Retirada</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Address */}
          {fulfillmentType === "delivery" && (
            <div className="space-y-2 border rounded-md p-3">
              <p className="text-xs font-medium">Endereço</p>
              <div className="grid grid-cols-3 gap-2">
                <Input placeholder="Rua" value={street} onChange={(e) => setStreet(e.target.value)} className="col-span-2" />
                <Input placeholder="Nº" value={number} onChange={(e) => setNumber(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="Bairro" value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} />
                <Input placeholder="Cidade" value={city} onChange={(e) => setCity(e.target.value)} />
              </div>
              <Input placeholder="Complemento" value={complement} onChange={(e) => setComplement(e.target.value)} />
            </div>
          )}

          {/* Delivery date/time */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-medium">Data entrega</label>
              <Input type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium">Hora entrega</label>
              <Input type="time" value={deliveryTime} onChange={(e) => setDeliveryTime(e.target.value)} />
            </div>
          </div>

          {/* Schedule toggle */}
          <div className={`space-y-2 rounded-md p-3 ${scheduleEnabled ? "border-2 border-[#033D7B]/40 bg-[#033D7B]/5" : "border"}`}>
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium flex items-center gap-1">
                <CalendarClock className="h-3.5 w-3.5" /> Agendar para outro dia
              </label>
              <Switch checked={scheduleEnabled} onCheckedChange={(v) => {
                setScheduleEnabled(v);
                if (v && !scheduledDate) setScheduledDate(deliveryDate);
                if (v && !scheduledTime) setScheduledTime(deliveryTime);
              }} />
            </div>
            {scheduleEnabled && (
              <>
                <p className="text-xs text-muted-foreground">
                  Este pedido será listado e contabilizado na data agendada.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-medium">Data agendada</label>
                    <Input type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs font-medium">Hora agendada</label>
                    <Input type="time" value={scheduledTime} onChange={(e) => setScheduledTime(e.target.value)} />
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Payment */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-medium">Forma de pagamento</label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash"><span className="inline-flex items-center gap-2"><PaymentIcon method="cash" size={14} /> Dinheiro</span></SelectItem>
                  <SelectItem value="pix"><span className="inline-flex items-center gap-2"><PaymentIcon method="pix" size={14} /> PIX</span></SelectItem>
                  <SelectItem value="card"><span className="inline-flex items-center gap-2"><PaymentIcon method="card" size={14} /> Cartão</span></SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium">Valor total</label>
              <Input type="number" step="0.01" value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)} placeholder="0,00" />
            </div>
          </div>

          {paymentMethod === "cash" && (
            <div>
              <label className="text-xs font-medium">Troco para</label>
              <Input type="number" step="0.01" value={changeFor} onChange={(e) => setChangeFor(e.target.value)} placeholder="0,00" />
            </div>
          )}

          {/* Rider */}
          <div>
            <label className="text-xs font-medium">Motoboy</label>
            <Select value={riderId || "none"} onValueChange={(v) => setRiderId(v === "none" ? null : v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Não atribuído</SelectItem>
                {riders.map((r) => <SelectItem key={r.id} value={r.id}>{r.label} — {r.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs font-medium">Observações</label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>

          <div className="flex gap-2 pt-2">
            <Button className="flex-1" onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Salvar alterações
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function OrdersTab({ onScheduledCount }: { onScheduledCount?: (count: number) => void }) {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [orders, setOrders] = useState<AdminOrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [statusFilter, setStatusFilter] = useState("all");
  const [periodFilter, setPeriodFilter] = useState("all");
  const [selectedOrder, setSelectedOrder] = useState<AdminOrderRow | null>(null);
  const [labelData, setLabelData] = useState<LabelData | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [pixSubFilter, setPixSubFilter] = useState("all");
  const [scheduleFilter, setScheduleFilter] = useState("all");

  // Riders
  const [riders, setRiders] = useState<DeliveryRider[]>([]);
  const [riderModalOpen, setRiderModalOpen] = useState(false);

  // Save customer from order
  const [saveCustomerOrder, setSaveCustomerOrder] = useState<AdminOrderRow | null>(null);

  // Edit order
  const [editOrder, setEditOrder] = useState<AdminOrderRow | null>(null);

  // Reminder
  const [reminderOpen, setReminderOpen] = useState(false);
  const [reminderChecked, setReminderChecked] = useState(false);

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [updatingStatusIds, setUpdatingStatusIds] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [confirmAction, setConfirmAction] = useState<
    | { type: "status"; value: string }
    | { type: "rider"; value: string | null; label: string }
    | { type: "payment"; value: string }
    | { type: "delete" }
    | null
  >(null);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && selectedIds.size > 0) clearSelection();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedIds.size, clearSelection]);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      // Paginate internally to bypass the per-request row limit and fetch ALL orders
      const PAGE = 200;
      const HARD_CAP = 50000;
      const all: AdminOrderRow[] = [];
      let page = 0;
      while (page * PAGE < HARD_CAP) {
        const res = await adminApi.listOrders({ page, pageSize: PAGE });
        const rows = res?.rows ?? [];
        all.push(...rows);
        const total = res?.total ?? 0;
        if (rows.length === 0 || all.length >= total) break;
        page++;
      }
      setOrders(all);
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

  const [tickNow, setTickNow] = useState(() => new Date());

  // Auto-refresh badges every 60 seconds
  useEffect(() => {
    const interval = setInterval(() => setTickNow(new Date()), 60_000);
    return () => clearInterval(interval);
  }, []);

  

  // Scheduled orders for today / overdue (for reminder and badge)
  const scheduledTodayOrOverdue = useMemo(() => {
    return orders.filter((o) =>
      o.scheduled_date &&
      !o.reminder_dismissed &&
      !["entregue", "cancelado"].includes(o.status) &&
      !isScheduledFuture(o.scheduled_date, o.scheduled_time, tickNow)
    );
  }, [orders, tickNow]);

  // Notify parent about pending scheduled count
  useEffect(() => {
    const pendingCount = orders.filter((o) =>
      o.scheduled_date &&
      !["entregue", "cancelado"].includes(o.status) &&
      !isScheduledFuture(o.scheduled_date, o.scheduled_time, tickNow)
    ).length;
    onScheduledCount?.(pendingCount);
  }, [orders, tickNow, onScheduledCount]);

  // Show reminder on first load
  useEffect(() => {
    if (!loading && !reminderChecked && scheduledTodayOrOverdue.length > 0) {
      setReminderOpen(true);
      setReminderChecked(true);
    }
  }, [loading, reminderChecked, scheduledTodayOrOverdue.length]);

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

    // Schedule filter — timezone-aware using schedulingRules
    if (scheduleFilter === "today") {
      result = result.filter((o) => o.scheduled_date && isScheduledToday(o.scheduled_date, tickNow));
    } else if (scheduleFilter === "scheduled") {
      result = result.filter((o) =>
        o.scheduled_date &&
        isScheduledFuture(o.scheduled_date, o.scheduled_time, tickNow) &&
        o.status !== "cancelado"
      );
    } else if (scheduleFilter === "overdue") {
      result = result.filter((o) =>
        o.scheduled_date &&
        isScheduledLate(o.scheduled_date, o.scheduled_time, o.status, tickNow)
      );
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

    // Sort by scheduled_date ASC when schedule filter is active
    if (scheduleFilter !== "all") {
      result = [...result].sort((a, b) => {
        const dateA = a.scheduled_date || "9999-12-31";
        const dateB = b.scheduled_date || "9999-12-31";
        return dateA.localeCompare(dateB);
      });
    }

    return result;
  }, [orders, statusFilter, periodFilter, paymentFilter, pixSubFilter, scheduleFilter, search, tickNow]);

  useEffect(() => {
    setCurrentPage(1);
    setSelectedIds(new Set());
  }, [search, statusFilter, periodFilter, paymentFilter, pixSubFilter, scheduleFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const paginatedOrders = filtered.slice(pageStart, pageStart + PAGE_SIZE);

  const updateStatus = async (orderId: string, newStatus: string) => {
    if (updatingStatusIds.has(orderId)) return;
    const previous = orders.find((o) => o.id === orderId)?.status;
    if (previous === newStatus) return;

    // Optimistic update
    setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o)));
    setUpdatingStatusIds((prev) => {
      const next = new Set(prev);
      next.add(orderId);
      return next;
    });

    const maxRetries = 3;
    let lastError: unknown;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await adminApi.updateOrderStatus(orderId, newStatus);
        toast({ title: "Status atualizado" });
        setOrders((prev) => prev.map((o) =>
          o.id === orderId && newStatus === "em_rota" ? { ...o, em_rota_at: new Date().toISOString() } : o
        ));
        setUpdatingStatusIds((prev) => {
          const next = new Set(prev);
          next.delete(orderId);
          return next;
        });
        return;
      } catch (err) {
        lastError = err;
        console.warn(`[updateStatus] tentativa ${attempt} falhou`, err);
        const message = err instanceof Error ? err.message : "";
        const retriable = /network|fetch|timeout|conexão|failed to fetch/i.test(message);
        // Erro de negócio (ex.: estoque insuficiente): repetir não resolve
        if (!retriable) break;
        if (attempt < maxRetries) {
          await new Promise((r) => setTimeout(r, attempt * 500));
        }
      }
    }

    // Failed — revert
    console.error("[updateStatus] falha", lastError);
    setOrders((prev) => prev.map((o) => (o.id === orderId && previous !== undefined ? { ...o, status: previous } : o)));
    setUpdatingStatusIds((prev) => {
      const next = new Set(prev);
      next.delete(orderId);
      return next;
    });
    const technical = lastError instanceof Error ? lastError.message : "";
    const isNetwork = /network|fetch|timeout|conexão|failed to fetch/i.test(technical);
    toast({
      title: "Não foi possível atualizar o status",
      description: isNetwork
        ? "Falha de conexão. Verifique sua internet e tente novamente."
        : technical || "Tente novamente em instantes. Se persistir, recarregue a página.",
      variant: "destructive",
    });
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

  const togglePixPaid = async (orderId: string) => {
    // Optimistic update
    setOrders((prev) => prev.map((o) => {
      if (o.id !== orderId) return o;
      const newPaid = !o.pix_paid;
      return { ...o, pix_paid: newPaid, pix_paid_at: newPaid ? new Date().toISOString() : null };
    }));
    try {
      await adminApi.togglePixPaid(orderId);
    } catch {
      toast({ title: "Erro ao atualizar pagamento PIX", variant: "destructive" });
      fetchOrders();
    }
  };

  const runBulkAction = async () => {
    if (!confirmAction) return;
    const ids = Array.from(selectedIds ?? []);
    if (ids.length === 0) { setConfirmAction(null); return; }
    setBulkBusy(true);
    try {
      if (confirmAction.type === "status") {
        const res = await adminApi.bulkUpdateOrders(ids, { status: confirmAction.value });
        const failed = res?.failed ?? [];
        const failedIds = new Set(failed.map((f) => f.id));
        const nowIso = new Date().toISOString();
        const idSet = new Set(ids);
        setOrders((prev) => prev.map((o) =>
          idSet.has(o.id) && !failedIds.has(o.id)
            ? { ...o, status: confirmAction.value, em_rota_at: confirmAction.value === "em_rota" ? nowIso : o.em_rota_at }
            : o
        ));
        const okCount = ids.length - failed.length;
        if (failed.length > 0) {
          toast({
            title: `${okCount} pedido${okCount !== 1 ? "s" : ""} atualizado${okCount !== 1 ? "s" : ""}, ${failed.length} com erro`,
            description: failed[0].error + (failed.length > 1 ? ` (e mais ${failed.length - 1})` : ""),
            variant: "destructive",
          });
        } else {
          toast({ title: `${ids.length} pedido${ids.length !== 1 ? "s" : ""} atualizado${ids.length !== 1 ? "s" : ""} para "${statusLabels[confirmAction.value] ?? confirmAction.value}".` });
        }
      } else if (confirmAction.type === "rider") {
        await adminApi.bulkUpdateOrders(ids, { rider_id: confirmAction.value });
        const idSet = new Set(ids);
        setOrders((prev) => prev.map((o) => idSet.has(o.id) ? { ...o, rider_id: confirmAction.value } : o));
        toast({ title: `${ids.length} pedido${ids.length !== 1 ? "s" : ""} atribuído${ids.length !== 1 ? "s" : ""} a ${confirmAction.label}.` });
      } else if (confirmAction.type === "payment") {
        await adminApi.bulkUpdateOrders(ids, { payment_method: confirmAction.value });
        const idSet = new Set(ids);
        setOrders((prev) => prev.map((o) => idSet.has(o.id) ? { ...o, payment_method: confirmAction.value } : o));
        toast({ title: `Forma de pagamento atualizada em ${ids.length} pedido${ids.length !== 1 ? "s" : ""}.` });
      } else if (confirmAction.type === "delete") {
        const res = (await adminApi.bulkDeleteOrders(ids)) ?? { deleted: 0, skipped: 0 };
        const deleted = res.deleted ?? 0;
        const skipped = res.skipped ?? 0;
        // Local state update: remove non-delivered orders that were selected
        const idSet = new Set(ids);
        setOrders((prev) => prev.filter((o) => !(idSet.has(o.id) && o.status !== "entregue")));
        const msg = skipped > 0
          ? `${deleted} excluído${deleted !== 1 ? "s" : ""}. ${skipped} pedido${skipped !== 1 ? "s" : ""} entregue${skipped !== 1 ? "s" : ""} ignorado${skipped !== 1 ? "s" : ""}.`
          : `${deleted} pedido${deleted !== 1 ? "s" : ""} excluído${deleted !== 1 ? "s" : ""}.`;
        toast({ title: msg });
      }
      clearSelection();
      setConfirmAction(null);
    } catch (err) {
      toast({ title: "Erro na ação em massa", description: err instanceof Error ? err.message : "Erro", variant: "destructive" });
    } finally {
      setBulkBusy(false);
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

        <Select value={paymentFilter} onValueChange={(v) => { setPaymentFilter(v); if (v !== "pix") setPixSubFilter("all"); }}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Pagamento" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Pgto: Todos</SelectItem>
            <SelectItem value="cash"><span className="inline-flex items-center gap-2"><PaymentIcon method="cash" size={14} /> Dinheiro</span></SelectItem>
            <SelectItem value="pix"><span className="inline-flex items-center gap-2"><PaymentIcon method="pix" size={14} /> PIX</span></SelectItem>
            <SelectItem value="card"><span className="inline-flex items-center gap-2"><PaymentIcon method="card" size={14} /> Cartão</span></SelectItem>
          </SelectContent>
        </Select>

        {paymentFilter === "pix" && (
          <Select value={pixSubFilter} onValueChange={setPixSubFilter}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos PIX</SelectItem>
              <SelectItem value="pending">PIX Pendente</SelectItem>
              <SelectItem value="paid">PIX Pago</SelectItem>
            </SelectContent>
          </Select>
        )}

        <Select value={scheduleFilter} onValueChange={setScheduleFilter}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Agenda" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Agenda: Todos</SelectItem>
            <SelectItem value="today">📅 Hoje</SelectItem>
            <SelectItem value="scheduled">📅 Agendados</SelectItem>
            <SelectItem value="overdue">🔴 Em atraso</SelectItem>
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

      <div className="flex items-center gap-2">
        <p className="text-sm text-muted-foreground">{filtered.length} pedido{filtered.length !== 1 ? "s" : ""} encontrado{filtered.length !== 1 ? "s" : ""}</p>
      </div>

      {selectedIds.size > 0 && (() => {
        const selectedOrders = orders.filter((o) => selectedIds.has(o.id));
        const deliveredCount = selectedOrders.filter((o) => o.status === "entregue").length;
        const pageAllSelected = paginatedOrders.length > 0 && paginatedOrders.every((o) => selectedIds.has(o.id));
        const canSelectAllFiltered = pageAllSelected && filtered.length > paginatedOrders.length && selectedIds.size < filtered.length;
        return (
          <div className={`sticky top-14 z-30 rounded-lg border-2 border-[#033D7B] bg-[#033D7B] text-white shadow-lg p-3 ${isMobile ? "fixed bottom-16 left-2 right-2 top-auto" : ""}`}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-sm">
                ✓ {selectedIds.size} pedido{selectedIds.size !== 1 ? "s" : ""} selecionado{selectedIds.size !== 1 ? "s" : ""}
              </span>
              {canSelectAllFiltered && (
                <Button size="sm" variant="secondary" className="h-7 text-xs"
                  onClick={() => setSelectedIds(new Set(filtered.map((o) => o.id)))}>
                  Selecionar todos os {filtered.length} filtrados
                </Button>
              )}
              <div className="flex-1" />
              <Select value="" onValueChange={(v) => setConfirmAction({ type: "status", value: v })}>
                <SelectTrigger className="h-8 w-[150px] bg-white text-foreground"><SelectValue placeholder="Alterar status" /></SelectTrigger>
                <SelectContent>
                  {Constants.public.Enums.order_status.map((s) => (
                    <SelectItem key={s} value={s}>{statusLabels[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value="" onValueChange={(v) => {
                if (v === "__none__") { setConfirmAction({ type: "rider", value: null, label: "Sem motoboy" }); return; }
                const r = riders.find((x) => x.id === v);
                setConfirmAction({ type: "rider", value: v, label: r ? `${r.label} — ${r.name}` : "Motoboy" });
              }}>
                <SelectTrigger className="h-8 w-[160px] bg-white text-foreground"><SelectValue placeholder="Atribuir motoboy" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Remover motoboy</SelectItem>
                  {riders.map((r) => (
                    <SelectItem key={r.id} value={r.id}>{r.label} — {r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value="" onValueChange={(v) => setConfirmAction({ type: "payment", value: v })}>
                <SelectTrigger className="h-8 w-[150px] bg-white text-foreground"><SelectValue placeholder="Pagamento" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Dinheiro</SelectItem>
                  <SelectItem value="pix">PIX</SelectItem>
                  <SelectItem value="card">Cartão</SelectItem>
                </SelectContent>
              </Select>
              <Button size="sm" variant="destructive" className="h-8" onClick={() => setConfirmAction({ type: "delete" })}>
                <Trash2 className="h-3.5 w-3.5 mr-1" /> Excluir
              </Button>
              <Button size="sm" variant="ghost" className="h-8 text-white hover:bg-white/20 hover:text-white" onClick={clearSelection}>
                <X className="h-4 w-4 mr-1" /> Limpar
              </Button>
            </div>
            {deliveredCount > 0 && (
              <p className="text-xs mt-1 opacity-90">
                ⚠️ {deliveredCount} pedido{deliveredCount !== 1 ? "s" : ""} entregue{deliveredCount !== 1 ? "s" : ""} não pode{deliveredCount !== 1 ? "m" : ""} ser excluído{deliveredCount !== 1 ? "s" : ""} em lote.
              </p>
            )}
          </div>
        );
      })()}


      {/* MOBILE: Card layout */}
      {isMobile ? (
        <div>
          {loading ? (
            <div className="space-y-2 px-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="animate-pulse h-24 bg-muted rounded-lg" />
              ))}
            </div>
          ) : paginatedOrders.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">Nenhum pedido encontrado.</p>
          ) : (
            paginatedOrders.map((o) => (
              <div key={o.id} className={`relative ${selectedIds.has(o.id) ? "ring-2 ring-[#033D7B] rounded-lg" : ""}`}>
                <div className="absolute top-2 left-2 z-10 bg-white rounded p-0.5 shadow-sm border">
                  <Checkbox
                    className="data-[state=checked]:bg-[#033D7B] data-[state=checked]:border-[#033D7B]"
                    checked={selectedIds.has(o.id)}
                    onCheckedChange={() => toggleSelect(o.id)}
                  />
                </div>
                <div className={selectedIds.has(o.id) ? "[&_.p-3]:pl-10" : "[&_.p-3]:pl-10"}>
                  <OrderCard
                    o={o}
                    riders={riders}
                    statusLabels={statusLabels}
                    statusColors={statusColors}
                    paymentLabels={paymentLabels}
                    onView={() => setSelectedOrder(o)}
                    onEdit={() => setEditOrder(o)}
                    onLabel={() => handleLabel(o)}
                    onWhatsApp={() => handleWhatsApp(o)}
                    onStatusChange={(v) => updateStatus(o.id, v)}
                    onRiderToggle={(rid) => toggleRider(o.id, rid, o.rider_id)}
                    onPixToggle={() => togglePixPaid(o.id)}
                  />
                </div>
              </div>
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
                  <TableHead className="w-10">
                    <Checkbox
                      className="data-[state=checked]:bg-[#033D7B] data-[state=checked]:border-[#033D7B]"
                      checked={paginatedOrders.length > 0 && paginatedOrders.every((o) => selectedIds.has(o.id))}
                      onCheckedChange={(v) => {
                        setSelectedIds((prev) => {
                          const next = new Set(prev);
                          if (v) paginatedOrders.forEach((o) => next.add(o.id));
                          else paginatedOrders.forEach((o) => next.delete(o.id));
                          return next;
                        });
                      }}
                    />
                  </TableHead>
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
                  Array.from({ length: 8 }).map((_, i) => (
                    <TableRow key={`sk-${i}`}>
                      <TableCell colSpan={11 + riders.length} className="py-2">
                        <div className="animate-pulse h-8 bg-muted rounded" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : paginatedOrders.length === 0 ? (
                  <TableRow><TableCell colSpan={11 + riders.length} className="text-center py-8 text-muted-foreground">Nenhum pedido encontrado.</TableCell></TableRow>
                ) : (
                  paginatedOrders.map((o) => (
                    <TableRow key={o.id} className={selectedIds.has(o.id) ? "bg-blue-50" : ""}>
                      <TableCell>
                        <Checkbox
                          className="data-[state=checked]:bg-[#033D7B] data-[state=checked]:border-[#033D7B]"
                          checked={selectedIds.has(o.id)}
                          onCheckedChange={() => toggleSelect(o.id)}
                        />
                      </TableCell>

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
                        <div className="flex flex-col gap-0.5">
                          <span>
                            {o.delivery_date ? format(new Date(`${o.delivery_date}T12:00:00`), "dd/MM") : "—"}
                            {o.delivery_time ? ` ${o.delivery_time}` : ""}
                          </span>
                          <ScheduledBadge order={o} />
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">
                        {format(new Date(o.created_at), "dd/MM/yyyy 'às' HH:mm")}
                      </TableCell>
                      <TableCell className="text-xs">
                        {o.order_items.map((i) => `${i.products?.name ?? "?"} x${i.qty}`).join(", ")}
                      </TableCell>
                      <TableCell className="text-xs">
                        <div className="flex flex-col gap-1">
                          {o.payment_method ? (
                            <PaymentBadge method={o.payment_method} />
                          ) : "—"}
                          <PixBadge order={o} onToggle={() => togglePixPaid(o.id)} />
                        </div>
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
                        <Select value={o.status} onValueChange={(v) => updateStatus(o.id, v)} disabled={updatingStatusIds.has(o.id)}>
                          <SelectTrigger className="h-7 text-xs w-[110px]" disabled={updatingStatusIds.has(o.id)}>
                            <Badge className={`${statusColors[o.status]} text-xs`}>{statusLabels[o.status]}</Badge>
                          </SelectTrigger>
                          <SelectContent>
                            {Constants.public.Enums.order_status.map((s) => (
                              <SelectItem key={s} value={s}>{statusLabels[s]}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {o.status === "em_rota" && o.em_rota_at && (
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            saiu às {format(new Date(o.em_rota_at), "HH:mm")}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSelectedOrder(o)} title="Detalhes"><Eye className="h-3.5 w-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditOrder(o)} title="Editar"><Pencil className="h-3.5 w-3.5" /></Button>
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
              {selectedOrder.scheduled_date && (
                <div className="flex items-center gap-2">
                  <strong>Agendado:</strong>
                  <ScheduledBadge order={selectedOrder} />
                </div>
              )}
              <div className="flex items-center gap-2"><strong>Pagamento:</strong> {selectedOrder.payment_method ? <PaymentBadge method={selectedOrder.payment_method} /> : "—"}</div>
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
              {selectedOrder.payment_method === "pix" && (
                <div className="flex items-center gap-2">
                  <strong>PIX:</strong>
                  <PixBadge order={selectedOrder} onToggle={() => {
                    togglePixPaid(selectedOrder.id);
                    setSelectedOrder((prev) => prev ? { ...prev, pix_paid: !prev.pix_paid, pix_paid_at: !prev.pix_paid ? new Date().toISOString() : null } : prev);
                  }} />
                  {selectedOrder.pix_paid && selectedOrder.pix_paid_at && (
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(selectedOrder.pix_paid_at), "dd/MM/yyyy 'às' HH:mm")}
                    </span>
                  )}
                </div>
              )}
              <p><strong>Motoboy:</strong> {(() => {
                const r = riders.find((r) => r.id === selectedOrder.rider_id);
                return r ? `${r.label} — ${r.name}` : "Não atribuído";
              })()}</p>
              <p><strong>Criado em:</strong> {format(new Date(selectedOrder.created_at), "dd/MM/yyyy 'às' HH:mm")}</p>
              {selectedOrder.em_rota_at && (
                <p><strong>Saiu para rota:</strong> {format(new Date(selectedOrder.em_rota_at), "dd/MM/yyyy 'às' HH:mm")}</p>
              )}
              {selectedOrder.updated_at && (
                <p className="text-xs text-muted-foreground">
                  Última edição: {format(new Date(selectedOrder.updated_at), "dd/MM/yyyy 'às' HH:mm")}
                  {selectedOrder.updated_by ? ` por ${selectedOrder.updated_by}` : ""}
                </p>
              )}
              <p><strong>Itens:</strong></p>
              <ul className="list-disc list-inside">
                {selectedOrder.order_items.map((i, idx) => (<li key={idx}>{i.products?.name}: {i.qty}</li>))}
              </ul>
              {selectedOrder.notes && <p><strong>Obs:</strong> {selectedOrder.notes}</p>}
              <div className="flex gap-2 pt-2 flex-wrap">
                <Button size="sm" variant="outline" onClick={() => { setEditOrder(selectedOrder); setSelectedOrder(null); }}>
                  <Pencil className="h-4 w-4 mr-1" /> Editar pedido
                </Button>
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

      <EditOrderModal
        open={!!editOrder}
        onOpenChange={(o) => { if (!o) setEditOrder(null); }}
        order={editOrder}
        riders={riders}
        onSaved={() => { fetchOrders(); setEditOrder(null); }}
      />

      <ReminderModal
        open={reminderOpen}
        onOpenChange={setReminderOpen}
        orders={scheduledTodayOrOverdue}
        onViewOrders={() => {
          setReminderOpen(false);
          setScheduleFilter("today");
        }}
        onDismiss={async () => {
          setReminderOpen(false);
          const ids = scheduledTodayOrOverdue.map((o) => o.id);
          if (ids.length > 0) {
            try {
              await adminApi.dismissReminders(ids);
              fetchOrders();
            } catch { /* silent */ }
          }
        }}
      />

      <AlertDialog open={!!confirmAction} onOpenChange={(o) => { if (!o && !bulkBusy) setConfirmAction(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction?.type === "status" && `Alterar status de ${selectedIds.size} pedido${selectedIds.size !== 1 ? "s" : ""}?`}
              {confirmAction?.type === "rider" && `Atribuir ${confirmAction.label} a ${selectedIds.size} pedido${selectedIds.size !== 1 ? "s" : ""}?`}
              {confirmAction?.type === "payment" && `Alterar forma de pagamento de ${selectedIds.size} pedido${selectedIds.size !== 1 ? "s" : ""}?`}
              {confirmAction?.type === "delete" && `Excluir ${selectedIds.size} pedido${selectedIds.size !== 1 ? "s" : ""} permanentemente?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction?.type === "status" && `Novo status: "${statusLabels[(confirmAction as { value: string }).value] ?? ""}". Esta ação não pode ser desfeita em lote.`}
              {confirmAction?.type === "payment" && `Nova forma: "${paymentLabels[(confirmAction as { value: string }).value] ?? ""}". Esta ação não pode ser desfeita em lote.`}
              {confirmAction?.type === "rider" && "Esta ação substituirá o motoboy atualmente atribuído."}
              {confirmAction?.type === "delete" && (() => {
                const delivered = orders.filter((o) => selectedIds.has(o.id) && o.status === "entregue").length;
                return delivered > 0
                  ? `⚠️ Esta ação não pode ser desfeita. ${delivered} pedido${delivered !== 1 ? "s" : ""} entregue${delivered !== 1 ? "s" : ""} será ignorado${delivered !== 1 ? "s" : ""}.`
                  : "⚠️ Esta ação não pode ser desfeita.";
              })()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkBusy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={bulkBusy}
              onClick={(e) => { e.preventDefault(); runBulkAction(); }}
              className={confirmAction?.type === "delete" ? "bg-destructive hover:bg-destructive/90" : ""}
            >
              {bulkBusy && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {confirmAction?.type === "delete" ? "Excluir" : "Confirmar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
