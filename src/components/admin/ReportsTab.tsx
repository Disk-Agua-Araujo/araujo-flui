import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Download, Package, ClipboardList, TrendingUp, CalendarIcon } from "lucide-react";
import { format, startOfMonth, startOfWeek, startOfDay, subDays } from "date-fns";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { adminApi, type AdminOrderRow } from "@/services/admin-api";
import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, Cell } from "recharts";

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const paymentLabels: Record<string, string> = {
  cash: "Dinheiro",
  pix: "PIX",
  card: "Cartão",
};

export function ReportsTab() {
  const { toast } = useToast();
  const [orders, setOrders] = useState<AdminOrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("month");

  // Revenue section independent filter
  const [revPeriod, setRevPeriod] = useState("month");
  const [revDateFrom, setRevDateFrom] = useState<Date | undefined>();
  const [revDateTo, setRevDateTo] = useState<Date | undefined>();
  const [customApplied, setCustomApplied] = useState(false);

  useEffect(() => {
    const fetchOrders = async () => {
      setLoading(true);
      try {
        const data = await adminApi.listReportsOrders();
        setOrders(data ?? []);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Erro ao carregar relatórios";
        toast({ title: "Erro", description: message, variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };
    fetchOrders();
  }, []);

  const filteredOrders = useMemo(() => {
    const now = new Date();
    let cutoff: Date;
    if (period === "today") cutoff = startOfDay(now);
    else if (period === "week") cutoff = startOfWeek(now, { weekStartsOn: 1 });
    else if (period === "month") cutoff = startOfMonth(now);
    else cutoff = subDays(now, 365);
    return orders.filter((o) => new Date(o.created_at) >= cutoff);
  }, [orders, period]);

  // Revenue filtered orders (independent filter)
  const revenueOrders = useMemo(() => {
    const now = new Date();
    if (revPeriod === "custom" && customApplied && revDateFrom) {
      const from = startOfDay(revDateFrom);
      const to = revDateTo ? new Date(startOfDay(revDateTo).getTime() + 86400000 - 1) : new Date();
      return orders.filter((o) => {
        const d = new Date(o.created_at);
        return d >= from && d <= to;
      });
    }
    let cutoff: Date;
    if (revPeriod === "today") cutoff = startOfDay(now);
    else if (revPeriod === "week") cutoff = startOfWeek(now, { weekStartsOn: 1 });
    else cutoff = startOfMonth(now);
    return orders.filter((o) => new Date(o.created_at) >= cutoff);
  }, [orders, revPeriod, revDateFrom, revDateTo, customApplied]);

  const revenuePeriodLabel = useMemo(() => {
    if (revPeriod === "custom" && customApplied && revDateFrom) {
      const from = format(revDateFrom, "dd/MM/yyyy");
      const to = revDateTo ? format(revDateTo, "dd/MM/yyyy") : format(new Date(), "dd/MM/yyyy");
      return `Exibindo: ${from} a ${to}`;
    }
    if (revPeriod === "today") return `Exibindo: ${format(new Date(), "dd/MM/yyyy")}`;
    if (revPeriod === "week") return `Exibindo: ${format(startOfWeek(new Date(), { weekStartsOn: 1 }), "dd/MM/yyyy")} a ${format(new Date(), "dd/MM/yyyy")}`;
    return `Exibindo: ${format(startOfMonth(new Date()), "dd/MM/yyyy")} a ${format(new Date(), "dd/MM/yyyy")}`;
  }, [revPeriod, revDateFrom, revDateTo, customApplied]);

  const revenueStats = useMemo(() => {
    const methods = ["cash", "pix", "card"] as const;
    const result: Record<string, { total: number; count: number }> = {};
    methods.forEach((m) => { result[m] = { total: 0, count: 0 }; });

    revenueOrders.forEach((o) => {
      const method = o.payment_method;
      if (method && result[method]) {
        result[method].count++;
        result[method].total += o.total_amount ?? 0;
      }
    });

    const grandTotal = methods.reduce((s, m) => s + result[m].total, 0);
    return { byMethod: result, grandTotal };
  }, [revenueOrders]);

  const chartData = useMemo(() => [
    { name: "💵 Dinheiro", value: revenueStats.byMethod.cash.total, color: "#4CAF50" },
    { name: "📱 PIX", value: revenueStats.byMethod.pix.total, color: "#2196F3" },
    { name: "💳 Cartão", value: revenueStats.byMethod.card.total, color: "#9C27B0" },
  ], [revenueStats]);

  const stats = useMemo(() => {
    const total = filteredOrders.length;
    const entregues = filteredOrders.filter((o) => o.status === "entregue").length;
    const cancelados = filteredOrders.filter((o) => o.status === "cancelado").length;
    const totalItems = filteredOrders.reduce(
      (sum, o) => sum + o.order_items.reduce((s, i) => s + i.qty, 0),
      0,
    );

    const productMap: Record<string, number> = {};
    filteredOrders.forEach((o) =>
      o.order_items.forEach((i) => {
        const name = i.products?.name ?? "Desconhecido";
        productMap[name] = (productMap[name] || 0) + i.qty;
      }),
    );

    const productBreakdown = Object.entries(productMap).sort(([, a], [, b]) => b - a);
    return { total, entregues, cancelados, totalItems, productBreakdown };
  }, [filteredOrders]);

  const exportCSV = () => {
    const BOM = "\uFEFF";
    const header = [
      "ID do Pedido", "Data do Pedido", "Hora do Pedido", "Nome do Cliente", "Telefone",
      "Tipo (PF/PJ)", "CNPJ", "Endereço", "Bairro", "Cidade", "Complemento", "Referência",
      "Itens", "Qtd Total de Galões", "Canal", "Tipo de Atendimento", "Data de Entrega",
      "Hora de Entrega", "Status", "Forma de Pagamento", "Valor Total", "Troco Para",
      "PIX Pago", "Motoboy", "Observações", "Última Edição"
    ].join(";");

    const rows = filteredOrders.map((o) => {
      const createdAt = new Date(o.created_at);
      const totalGaloes = o.order_items.reduce((s, i) => s + i.qty, 0);
      const payLabel = o.payment_method ? (paymentLabels[o.payment_method] || o.payment_method) : "—";
      const pixPago = o.payment_method === "pix" ? (o.pix_paid ? "Sim" : "Não") : "N/A";
      const riderName = (o as any).rider_name || "—";
      const updatedAt = (o as any).updated_at
        ? format(new Date((o as any).updated_at), "dd/MM/yyyy HH:mm")
        : "—";

      return [
        o.id.slice(0, 8),
        format(createdAt, "dd/MM/yyyy"),
        format(createdAt, "HH:mm"),
        `"${o.customers?.name ?? "Sem cadastro"}"`,
        o.customers?.phone || "—",
        o.customers?.type || "—",
        o.customers?.cnpj || "—",
        o.addresses ? `"${o.addresses.street}, ${o.addresses.number}"` : "—",
        o.addresses?.neighborhood || "—",
        o.addresses?.city || "—",
        o.addresses?.complement || "—",
        (o.addresses as any)?.reference || "—",
        `"${o.order_items.map((i) => `${i.products?.name ?? "?"} x${i.qty}`).join("; ")}"`,
        totalGaloes,
        o.channel,
        o.fulfillment_type === "pickup" ? "Retirada" : "Entrega",
        o.delivery_date ?? "—",
        o.delivery_time ?? "—",
        o.status,
        payLabel,
        o.total_amount != null ? formatCurrency(o.total_amount) : "—",
        o.change_for != null ? formatCurrency(o.change_for) : "—",
        pixPago,
        riderName,
        o.notes ? `"${o.notes.replace(/"/g, '""')}"` : "—",
        updatedAt,
      ].join(";");
    }).join("\n");

    const blob = new Blob([BOM + header + "\n" + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio-disk-agua-${format(new Date(), "dd-MM-yyyy")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "CSV exportado!" });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold">Relatórios</h2>
        <div className="flex gap-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Hoje</SelectItem>
              <SelectItem value="week">Semana</SelectItem>
              <SelectItem value="month">Mês</SelectItem>
              <SelectItem value="all">Tudo</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={exportCSV}>
            <Download className="h-4 w-4 mr-1" /> CSV
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6 text-center">
            <ClipboardList className="h-6 w-6 mx-auto text-primary mb-1" />
            <p className="text-2xl font-bold">{stats.total}</p>
            <p className="text-xs text-muted-foreground">Total pedidos</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <TrendingUp className="h-6 w-6 mx-auto text-primary mb-1" />
            <p className="text-2xl font-bold">{stats.entregues}</p>
            <p className="text-xs text-muted-foreground">Entregues</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <Package className="h-6 w-6 mx-auto text-primary mb-1" />
            <p className="text-2xl font-bold">{stats.totalItems}</p>
            <p className="text-xs text-muted-foreground">Itens vendidos</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-2xl font-bold text-destructive">{stats.cancelados}</p>
            <p className="text-xs text-muted-foreground">Cancelados</p>
          </CardContent>
        </Card>
      </div>

      {/* Revenue by Payment Method */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <CardTitle className="text-lg">Faturamento por Pagamento</CardTitle>
            <div className="flex gap-2 flex-wrap">
              <Select value={revPeriod} onValueChange={(v) => { setRevPeriod(v); if (v !== "custom") setCustomApplied(false); }}>
                <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Hoje</SelectItem>
                  <SelectItem value="week">Esta semana</SelectItem>
                  <SelectItem value="month">Este mês</SelectItem>
                  <SelectItem value="custom">Personalizado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {revPeriod === "custom" && (
            <div className="flex gap-2 items-end flex-wrap mt-2">
              <div>
                <p className="text-xs text-muted-foreground mb-1">De:</p>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-[140px] justify-start text-left text-sm", !revDateFrom && "text-muted-foreground")}>
                      <CalendarIcon className="h-4 w-4 mr-1" />
                      {revDateFrom ? format(revDateFrom, "dd/MM/yyyy") : "Início"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={revDateFrom} onSelect={setRevDateFrom} initialFocus className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Até:</p>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-[140px] justify-start text-left text-sm", !revDateTo && "text-muted-foreground")}>
                      <CalendarIcon className="h-4 w-4 mr-1" />
                      {revDateTo ? format(revDateTo, "dd/MM/yyyy") : "Fim"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={revDateTo} onSelect={setRevDateTo} initialFocus className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
              <Button size="sm" onClick={() => setCustomApplied(true)} disabled={!revDateFrom}>Aplicar</Button>
            </div>
          )}

          <p className="text-xs text-muted-foreground mt-2">{revenuePeriodLabel}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-l-4" style={{ borderLeftColor: "#4CAF50" }}>
              <CardContent className="pt-4 text-center">
                <p className="text-lg">💵</p>
                <p className="text-sm font-medium">Dinheiro</p>
                <p className="text-xl font-bold">{formatCurrency(revenueStats.byMethod.cash.total)}</p>
                <p className="text-xs text-muted-foreground">{revenueStats.byMethod.cash.count} pedido{revenueStats.byMethod.cash.count !== 1 ? "s" : ""}</p>
              </CardContent>
            </Card>
            <Card className="border-l-4" style={{ borderLeftColor: "#2196F3" }}>
              <CardContent className="pt-4 text-center">
                <p className="text-lg">📱</p>
                <p className="text-sm font-medium">PIX</p>
                <p className="text-xl font-bold">{formatCurrency(revenueStats.byMethod.pix.total)}</p>
                <p className="text-xs text-muted-foreground">{revenueStats.byMethod.pix.count} pedido{revenueStats.byMethod.pix.count !== 1 ? "s" : ""}</p>
              </CardContent>
            </Card>
            <Card className="border-l-4" style={{ borderLeftColor: "#9C27B0" }}>
              <CardContent className="pt-4 text-center">
                <p className="text-lg">💳</p>
                <p className="text-sm font-medium">Cartão</p>
                <p className="text-xl font-bold">{formatCurrency(revenueStats.byMethod.card.total)}</p>
                <p className="text-xs text-muted-foreground">{revenueStats.byMethod.card.count} pedido{revenueStats.byMethod.card.count !== 1 ? "s" : ""}</p>
              </CardContent>
            </Card>
          </div>

          <p className="text-center text-sm font-semibold">
            Total geral: {formatCurrency(revenueStats.grandTotal)}
          </p>

          {/* Bar chart */}
          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                <RechartsTooltip formatter={(value: number) => formatCurrency(value)} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Vendas por produto</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produto</TableHead>
                <TableHead className="text-right">Quantidade</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={2} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
              ) : stats.productBreakdown.length === 0 ? (
                <TableRow><TableCell colSpan={2} className="text-center py-8 text-muted-foreground">Sem dados</TableCell></TableRow>
              ) : (
                stats.productBreakdown.map(([name, qty]) => (
                  <TableRow key={name}>
                    <TableCell>{name}</TableCell>
                    <TableCell className="text-right font-medium">{qty}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
