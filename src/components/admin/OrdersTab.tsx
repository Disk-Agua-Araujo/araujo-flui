import { useState, useEffect, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { OrderLabel, type LabelData } from "@/components/OrderLabel";
import { openWhatsApp, buildOrderMessage } from "@/services/whatsapp";
import { Search, MessageCircle, Printer, Eye, RefreshCw, ChevronLeft, ChevronRight, Truck, Store } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format, startOfDay, startOfWeek, startOfMonth } from "date-fns";
import { Constants } from "@/integrations/supabase/types";
import { adminApi, type AdminOrderRow } from "@/services/admin-api";

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
    <Badge className="text-xs gap-1 bg-[#033D7B] hover:bg-[#033D7B]/90 text-white">
      <Truck className="h-3 w-3" /> Entrega
    </Badge>
  );
}

export function OrdersTab() {
  const { toast } = useToast();
  const [orders, setOrders] = useState<AdminOrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [periodFilter, setPeriodFilter] = useState("all");
  const [selectedOrder, setSelectedOrder] = useState<AdminOrderRow | null>(null);
  const [labelData, setLabelData] = useState<LabelData | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

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

  useEffect(() => {
    fetchOrders();
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
  }, [orders, statusFilter, periodFilter, search]);

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

  const handleLabel = (o: AdminOrderRow) => {
    setLabelData({
      pedidoId: o.id.slice(0, 8).toUpperCase(),
      cliente: o.customers?.name ?? "Retirada / Sem cadastro",
      endereco: o.addresses
        ? `${o.addresses.street}, ${o.addresses.number} - ${o.addresses.neighborhood}, ${o.addresses.city}`
        : ((o as any).fulfillment_type === "pickup" ? "Retirada na loja" : "—"),
      complemento: o.addresses?.complement ?? undefined,
      itens: o.order_items.map((i) => ({ nome: i.products?.name ?? "—", qtd: i.qty })),
      entregaData: o.delivery_date ? format(new Date(`${o.delivery_date}T12:00:00`), "dd/MM/yyyy") : undefined,
      entregaHora: o.delivery_time ?? undefined,
    });
  };

  const handleWhatsApp = (o: AdminOrderRow) => {
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
      fulfillmentType: (o as any).fulfillment_type ?? "delivery",
    });
    openWhatsApp(msg);
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

        <Button variant="outline" size="icon" onClick={fetchOrders} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Endereço</TableHead>
                <TableHead className="hidden md:table-cell">Tipo</TableHead>
                <TableHead className="hidden md:table-cell">Canal</TableHead>
                <TableHead className="hidden md:table-cell">Entrega</TableHead>
                <TableHead className="hidden md:table-cell">Criado</TableHead>
                <TableHead>Itens</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
              ) : paginatedOrders.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Nenhum pedido encontrado.</TableCell></TableRow>
              ) : (
                paginatedOrders.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-mono text-xs">{o.id.slice(0, 8)}</TableCell>
                    <TableCell className="text-sm">
                      {o.addresses
                        ? `${o.addresses.street}, ${o.addresses.number} — ${o.addresses.neighborhood}`
                        : "Retirada na loja"}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <FulfillmentBadge type={(o as any).fulfillment_type} />
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-xs">{o.channel}</TableCell>
                    <TableCell className="hidden md:table-cell text-xs">
                      {o.delivery_date ? format(new Date(`${o.delivery_date}T12:00:00`), "dd/MM") : "—"}
                      {o.delivery_time ? ` ${o.delivery_time}` : ""}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-xs">
                      {format(new Date(o.created_at), "dd/MM/yyyy 'às' HH:mm")}
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

      <Dialog open={!!selectedOrder} onOpenChange={() => setSelectedOrder(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Pedido {selectedOrder?.id.slice(0, 8).toUpperCase()}</DialogTitle></DialogHeader>
          {selectedOrder && (
            <div className="space-y-3 text-sm">
              <p><strong>Cliente:</strong> {selectedOrder.customers?.name ?? "Retirada / Sem cadastro"}</p>
              <p><strong>Telefone:</strong> {selectedOrder.customers?.phone ?? "—"}</p>
              {selectedOrder.customers?.cnpj && <p><strong>CNPJ:</strong> {selectedOrder.customers.cnpj}</p>}
              <p><strong>Atendimento:</strong> <FulfillmentBadge type={(selectedOrder as any).fulfillment_type} /></p>
              {(selectedOrder as any).fulfillment_type !== "pickup" && (
                <p><strong>Endereço:</strong> {selectedOrder.addresses ? `${selectedOrder.addresses.street}, ${selectedOrder.addresses.number} - ${selectedOrder.addresses.neighborhood}` : "—"}</p>
              )}
              {selectedOrder.addresses?.complement && <p><strong>Complemento:</strong> {selectedOrder.addresses.complement}</p>}
              <p><strong>Canal:</strong> {selectedOrder.channel}</p>
              <p><strong>Entrega:</strong> {selectedOrder.delivery_date ?? "—"} {selectedOrder.delivery_time ?? ""}</p>
              <p><strong>Criado em:</strong> {format(new Date(selectedOrder.created_at), "dd/MM/yyyy 'às' HH:mm")}</p>
              <p><strong>Itens:</strong></p>
              <ul className="list-disc list-inside">
                {selectedOrder.order_items.map((i, idx) => (<li key={idx}>{i.products?.name}: {i.qty}</li>))}
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

      <Dialog open={!!labelData} onOpenChange={() => setLabelData(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Etiqueta</DialogTitle></DialogHeader>
          {labelData && <OrderLabel data={labelData} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
