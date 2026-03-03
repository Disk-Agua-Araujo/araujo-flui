import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { OrderLabel, type LabelData } from "@/components/OrderLabel";
import { openWhatsApp, buildOrderMessage } from "@/services/whatsapp";
import { Search, MessageCircle, Printer, Eye, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format, startOfDay, startOfWeek, startOfMonth } from "date-fns";
import { Constants } from "@/integrations/supabase/types";

const statusColors: Record<string, string> = {
  novo: "bg-blue-100 text-blue-800",
  agendado: "bg-yellow-100 text-yellow-800",
  em_rota: "bg-orange-100 text-orange-800",
  entregue: "bg-green-100 text-green-800",
  cancelado: "bg-red-100 text-red-800",
};

const statusLabels: Record<string, string> = {
  novo: "Novo",
  agendado: "Agendado",
  em_rota: "Em rota",
  entregue: "Entregue",
  cancelado: "Cancelado",
};

type OrderRow = {
  id: string;
  channel: string;
  delivery_date: string | null;
  delivery_time: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  customers: { id: string; name: string; phone: string | null; cnpj: string | null } | null;
  addresses: { street: string; number: string; neighborhood: string; city: string; complement: string | null } | null;
  order_items: { qty: number; products: { name: string } | null }[];
};

export function OrdersTab() {
  const { toast } = useToast();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [periodFilter, setPeriodFilter] = useState("all");
  const [selectedOrder, setSelectedOrder] = useState<OrderRow | null>(null);
  const [labelData, setLabelData] = useState<LabelData | null>(null);

  const fetchOrders = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("orders")
      .select(`
        id, channel, delivery_date, delivery_time, status, notes, created_at,
        customers(id, name, phone, cnpj),
        addresses(street, number, neighborhood, city, complement),
        order_items(qty, products(name))
      `)
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      toast({ title: "Erro ao carregar pedidos", description: error.message, variant: "destructive" });
    } else {
      setOrders((data as unknown as OrderRow[]) ?? []);
    }
    setLoading(false);
  };

  useEffect(() => { fetchOrders(); }, []);

  const filtered = useMemo(() => {
    let result = orders;
    if (statusFilter !== "all") {
      result = result.filter((o) => o.status === statusFilter);
    }
    if (periodFilter !== "all") {
      const now = new Date();
      let cutoff: Date;
      if (periodFilter === "today") cutoff = startOfDay(now);
      else if (periodFilter === "week") cutoff = startOfWeek(now, { weekStartsOn: 1 });
      else cutoff = startOfMonth(now);
      result = result.filter((o) => new Date(o.created_at) >= cutoff);
    }
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(
        (o) =>
          o.customers?.name?.toLowerCase().includes(s) ||
          o.order_items.some((i) => i.products?.name?.toLowerCase().includes(s)) ||
          o.id.toLowerCase().includes(s)
      );
    }
    return result;
  }, [orders, statusFilter, periodFilter, search]);

  const updateStatus = async (orderId: string, newStatus: string) => {
    const { error } = await supabase
      .from("orders")
      .update({ status: newStatus as any })
      .eq("id", orderId);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Status atualizado" });
      fetchOrders();
    }
  };

  const handleLabel = (o: OrderRow) => {
    setLabelData({
      pedidoId: o.id.slice(0, 8).toUpperCase(),
      cliente: o.customers?.name ?? "—",
      endereco: o.addresses
        ? `${o.addresses.street}, ${o.addresses.number} - ${o.addresses.neighborhood}, ${o.addresses.city}`
        : "—",
      complemento: o.addresses?.complement ?? undefined,
      itens: o.order_items.map((i) => ({ nome: i.products?.name ?? "—", qtd: i.qty })),
      entregaData: o.delivery_date ? format(new Date(o.delivery_date + "T12:00:00"), "dd/MM/yyyy") : undefined,
      entregaHora: o.delivery_time ?? undefined,
    });
  };

  const handleWhatsApp = (o: OrderRow) => {
    const msg = buildOrderMessage({
      tipo: o.customers?.cnpj ? "EMPRESA" : "VAREJO",
      canal: o.channel as any,
      cliente: o.customers?.name ?? "—",
      cnpj: o.customers?.cnpj ?? undefined,
      telefone: o.customers?.phone ?? "",
      endereco: {
        rua: o.addresses?.street ?? "",
        numero: o.addresses?.number ?? "",
        bairro: o.addresses?.neighborhood ?? "",
        cidade: o.addresses?.city ?? "",
        uf: "SP",
        complemento: o.addresses?.complement ?? undefined,
      },
      obs: o.notes ?? undefined,
      itens: o.order_items.map((i) => ({ nome: i.products?.name ?? "—", qtd: i.qty })),
      entregaData: o.delivery_date ? format(new Date(o.delivery_date + "T12:00:00"), "dd/MM/yyyy") : undefined,
      entregaHora: o.delivery_time ?? undefined,
      status: statusLabels[o.status] ?? o.status,
      pedidoId: o.id.slice(0, 8).toUpperCase(),
    });
    openWhatsApp(msg);
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar cliente ou produto..."
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
        <Button variant="outline" size="icon" onClick={fetchOrders} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead className="hidden md:table-cell">Canal</TableHead>
                <TableHead className="hidden md:table-cell">Entrega</TableHead>
                <TableHead>Itens</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhum pedido encontrado.</TableCell></TableRow>
              ) : (
                filtered.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-mono text-xs">{o.id.slice(0, 8)}</TableCell>
                    <TableCell className="font-medium">{o.customers?.name ?? "—"}</TableCell>
                    <TableCell className="hidden md:table-cell text-xs">{o.channel}</TableCell>
                    <TableCell className="hidden md:table-cell text-xs">
                      {o.delivery_date ? format(new Date(o.delivery_date + "T12:00:00"), "dd/MM") : "—"}
                      {o.delivery_time ? ` ${o.delivery_time}` : ""}
                    </TableCell>
                    <TableCell className="text-xs">
                      {o.order_items.map((i) => `${i.products?.name ?? "?"} x${i.qty}`).join(", ")}
                    </TableCell>
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
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSelectedOrder(o)} title="Detalhes">
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleLabel(o)} title="Etiqueta">
                          <Printer className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleWhatsApp(o)} title="WhatsApp">
                          <MessageCircle className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Order detail dialog */}
      <Dialog open={!!selectedOrder} onOpenChange={() => setSelectedOrder(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Pedido {selectedOrder?.id.slice(0, 8).toUpperCase()}</DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-3 text-sm">
              <p><strong>Cliente:</strong> {selectedOrder.customers?.name}</p>
              <p><strong>Telefone:</strong> {selectedOrder.customers?.phone ?? "—"}</p>
              {selectedOrder.customers?.cnpj && <p><strong>CNPJ:</strong> {selectedOrder.customers.cnpj}</p>}
              <p><strong>Endereço:</strong> {selectedOrder.addresses ? `${selectedOrder.addresses.street}, ${selectedOrder.addresses.number} - ${selectedOrder.addresses.neighborhood}` : "—"}</p>
              {selectedOrder.addresses?.complement && <p><strong>Complemento:</strong> {selectedOrder.addresses.complement}</p>}
              <p><strong>Canal:</strong> {selectedOrder.channel}</p>
              <p><strong>Entrega:</strong> {selectedOrder.delivery_date ?? "—"} {selectedOrder.delivery_time ?? ""}</p>
              <p><strong>Itens:</strong></p>
              <ul className="list-disc list-inside">
                {selectedOrder.order_items.map((i, idx) => (
                  <li key={idx}>{i.products?.name}: {i.qty}</li>
                ))}
              </ul>
              {selectedOrder.notes && <p><strong>Obs:</strong> {selectedOrder.notes}</p>}
              <div className="flex gap-2 pt-2">
                <Button size="sm" variant="outline" onClick={() => { handleLabel(selectedOrder); setSelectedOrder(null); }}>
                  <Printer className="h-4 w-4 mr-1" /> Etiqueta
                </Button>
                <Button size="sm" className="bg-whatsapp hover:bg-whatsapp-dark text-white" onClick={() => handleWhatsApp(selectedOrder)}>
                  <MessageCircle className="h-4 w-4 mr-1" /> WhatsApp
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Label dialog */}
      <Dialog open={!!labelData} onOpenChange={() => setLabelData(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Etiqueta</DialogTitle></DialogHeader>
          {labelData && <OrderLabel data={labelData} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
