import { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download, Package, ClipboardList, TrendingUp, Wallet, Loader2 } from "lucide-react";
import { PaymentIcon } from "@/components/PaymentIcon";
import { format } from "date-fns";
import { useDebounce } from "@/hooks/use-debounce";
import { PeriodFilter } from "@/components/admin/PeriodFilter";
import { makePeriod, periodBounds, periodLabel, periodRange, type PeriodValue } from "@/lib/period";
import { useToast } from "@/hooks/use-toast";
import { adminApi, type AdminOrderRow, type ReportsSummary } from "@/services/admin-api";
import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, Cell } from "recharts";
import { CashReport } from "@/components/admin/CashReport";

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const paymentLabels: Record<string, string> = {
  cash: "Dinheiro",
  pix: "PIX",
  card: "Cartão",
};

function SalesReport() {
  const { toast } = useToast();
  const [periodValue, setPeriodValue] = useState<PeriodValue>(() => makePeriod("month"));
  const period = useDebounce(periodValue, 300);

  // Revenue section independent filter
  const [revPeriodValue, setRevPeriodValue] = useState<PeriodValue>(() => makePeriod("month"));
  const revPeriod = useDebounce(revPeriodValue, 300);

  // Aggregated data from RPC (no row limit)
  const [statsData, setStatsData] = useState<ReportsSummary | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  const [revenueData, setRevenueData] = useState<ReportsSummary | null>(null);
  const [revenueLoading, setRevenueLoading] = useState(true);

  // CSV export state
  const [exporting, setExporting] = useState(false);

  // Load main stats whenever the top-level period changes
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setStatsLoading(true);
      try {
        const { from, to } = periodBounds(periodRange(period));
        const data = await adminApi.getReportsSummary(from, to);
        if (!cancelled) setStatsData(data);
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : "Erro ao carregar relatórios";
          toast({ title: "Erro", description: message, variant: "destructive" });
        }
      } finally {
        if (!cancelled) setStatsLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [period, toast]);

  // Load revenue stats whenever revenue filter changes
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setRevenueLoading(true);
      try {
        const { from, to } = periodBounds(periodRange(revPeriod));
        const data = await adminApi.getReportsSummary(from, to);
        if (!cancelled) setRevenueData(data);
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : "Erro ao carregar faturamento";
          toast({ title: "Erro", description: message, variant: "destructive" });
        }
      } finally {
        if (!cancelled) setRevenueLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [revPeriod, toast]);

  const revenueByMethod = useMemo(() => {
    const map: Record<string, { total: number; count: number }> = {
      cash: { total: 0, count: 0 },
      pix: { total: 0, count: 0 },
      card: { total: 0, count: 0 },
    };
    (revenueData?.revenue ?? []).forEach((r) => {
      if (r.payment_method && map[r.payment_method]) {
        map[r.payment_method] = { total: r.total, count: r.order_count };
      }
    });
    const grandTotal = map.cash.total + map.pix.total + map.card.total;
    return { byMethod: map, grandTotal };
  }, [revenueData]);

  const chartData = useMemo(() => [
    { name: "Dinheiro", value: revenueByMethod.byMethod.cash.total, color: "#4CAF50" },
    { name: "PIX", value: revenueByMethod.byMethod.pix.total, color: "#2196F3" },
    { name: "Cartão", value: revenueByMethod.byMethod.card.total, color: "#9C27B0" },
  ], [revenueByMethod]);

  const stats = useMemo(() => {
    return {
      total: statsData?.summary.total_orders ?? 0,
      entregues: statsData?.summary.delivered ?? 0,
      cancelados: statsData?.summary.cancelled ?? 0,
      totalItems: statsData?.summary.total_items ?? 0,
      productBreakdown: (statsData?.products ?? []).map((p) => [p.product_name, p.qty] as [string, number]),
    };
  }, [statsData]);

  const exportCSV = useCallback(async () => {
    setExporting(true);
    try {
      const { from, to } = periodBounds(periodRange(period));
      const orders: AdminOrderRow[] = await adminApi.listReportsOrders({
        dateStart: from,
        dateEnd: to,
      });

      const BOM = "\uFEFF";
      const header = [
        "ID do Pedido", "Data do Pedido", "Hora do Pedido", "Nome do Cliente", "Telefone",
        "Tipo (PF/PJ)", "CNPJ", "Endereço", "Bairro", "Cidade", "Complemento", "Referência",
        "Itens", "Qtd Total de Galões", "Canal", "Tipo de Atendimento", "Data de Entrega",
        "Hora de Entrega", "Status", "Forma de Pagamento", "Valor Total", "Troco Para",
        "PIX Pago", "Motoboy", "Observações", "Última Edição"
      ].join(";");

      const rows = orders.map((o) => {
        const createdAt = new Date(o.created_at);
        const totalGaloes = o.order_items.reduce((s, i) => s + i.qty, 0);
        const payLabel = o.payment_method ? (paymentLabels[o.payment_method] || o.payment_method) : "—";
        const pixPago = o.payment_method === "pix" ? (o.pix_paid ? "Sim" : "Não") : "N/A";
        const riderName = (o as { rider_name?: string }).rider_name || "—";
        const updatedAt = o.updated_at
          ? format(new Date(o.updated_at), "dd/MM/yyyy HH:mm")
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
          o.addresses?.reference || "—",
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
      toast({ title: `CSV exportado! (${orders.length} pedidos)` });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao exportar";
      toast({ title: "Erro", description: message, variant: "destructive" });
    } finally {
      setExporting(false);
    }
  }, [period, toast]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start gap-3 flex-wrap">
        <h2 className="text-xl font-bold">Vendas por pedido</h2>
        <div className="flex gap-2 flex-wrap items-center">
          <PeriodFilter value={periodValue} onChange={setPeriodValue} />
          <Button variant="outline" onClick={exportCSV} disabled={exporting}>
            {exporting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Download className="h-4 w-4 mr-1" />}
            CSV
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6 text-center">
            <ClipboardList className="h-6 w-6 mx-auto text-primary mb-1" />
            <p className="text-2xl font-bold">{statsLoading ? "…" : stats.total}</p>
            <p className="text-xs text-muted-foreground">Total pedidos</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <TrendingUp className="h-6 w-6 mx-auto text-primary mb-1" />
            <p className="text-2xl font-bold">{statsLoading ? "…" : stats.entregues}</p>
            <p className="text-xs text-muted-foreground">Entregues</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <Package className="h-6 w-6 mx-auto text-primary mb-1" />
            <p className="text-2xl font-bold">{statsLoading ? "…" : stats.totalItems}</p>
            <p className="text-xs text-muted-foreground">Itens vendidos</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-2xl font-bold text-destructive">{statsLoading ? "…" : stats.cancelados}</p>
            <p className="text-xs text-muted-foreground">Cancelados</p>
          </CardContent>
        </Card>
      </div>

      {/* Revenue by Payment Method */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <CardTitle className="text-lg">Faturamento por Pagamento</CardTitle>
            <PeriodFilter value={revPeriodValue} onChange={setRevPeriodValue} />
          </div>

          <p className="text-xs text-muted-foreground mt-2">Exibindo: {periodLabel(periodRange(revPeriod))}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {revenueLoading && (
            <p className="text-center text-sm text-muted-foreground">
              <Loader2 className="inline h-4 w-4 animate-spin mr-1" />Calculando faturamento...
            </p>
          )}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-l-4" style={{ borderLeftColor: "#4CAF50" }}>
              <CardContent className="pt-4 text-center">
                <PaymentIcon method="cash" size={24} className="mx-auto text-[#4CAF50]" />
                <p className="text-sm font-medium mt-1">Dinheiro</p>
                <p className="text-xl font-bold">{formatCurrency(revenueByMethod.byMethod.cash.total)}</p>
                <p className="text-xs text-muted-foreground">{revenueByMethod.byMethod.cash.count} pedido{revenueByMethod.byMethod.cash.count !== 1 ? "s" : ""}</p>
              </CardContent>
            </Card>
            <Card className="border-l-4" style={{ borderLeftColor: "#2196F3" }}>
              <CardContent className="pt-4 text-center">
                <PaymentIcon method="pix" size={24} className="mx-auto text-[#2196F3]" />
                <p className="text-sm font-medium mt-1">PIX</p>
                <p className="text-xl font-bold">{formatCurrency(revenueByMethod.byMethod.pix.total)}</p>
                <p className="text-xs text-muted-foreground">{revenueByMethod.byMethod.pix.count} pedido{revenueByMethod.byMethod.pix.count !== 1 ? "s" : ""}</p>
              </CardContent>
            </Card>
            <Card className="border-l-4" style={{ borderLeftColor: "#9C27B0" }}>
              <CardContent className="pt-4 text-center">
                <PaymentIcon method="card" size={24} className="mx-auto text-[#9C27B0]" />
                <p className="text-sm font-medium mt-1">Cartão</p>
                <p className="text-xl font-bold">{formatCurrency(revenueByMethod.byMethod.card.total)}</p>
                <p className="text-xs text-muted-foreground">{revenueByMethod.byMethod.card.count} pedido{revenueByMethod.byMethod.card.count !== 1 ? "s" : ""}</p>
              </CardContent>
            </Card>
          </div>

          <p className="text-center text-sm font-semibold">
            Total geral: {formatCurrency(revenueByMethod.grandTotal)}
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
              {statsLoading ? (
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

/**
 * Relatórios em duas visões: por pedido (competência, conta na data do
 * pedido) e caixa (conta na data em que o dinheiro entrou).
 */
export function ReportsTab() {
  return (
    <Tabs defaultValue="por-pedido" className="space-y-4">
      <TabsList className="grid w-full max-w-md grid-cols-2">
        <TabsTrigger value="por-pedido" className="gap-1">
          <ClipboardList className="h-4 w-4" /> Por pedido
        </TabsTrigger>
        <TabsTrigger value="caixa" className="gap-1">
          <Wallet className="h-4 w-4" /> Caixa
        </TabsTrigger>
      </TabsList>

      <TabsContent value="por-pedido"><SalesReport /></TabsContent>
      <TabsContent value="caixa"><CashReport /></TabsContent>
    </Tabs>
  );
}
