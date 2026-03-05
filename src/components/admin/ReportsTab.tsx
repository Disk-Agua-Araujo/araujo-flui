import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Package, ClipboardList, TrendingUp } from "lucide-react";
import { format, startOfMonth, startOfWeek, startOfDay, subDays } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { adminApi, type AdminOrderRow } from "@/services/admin-api";

export function ReportsTab() {
  const { toast } = useToast();
  const [orders, setOrders] = useState<AdminOrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("month");

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
    const header = "ID,Cliente,Canal,Status,Data Entrega,Itens,Criado em\n";
    const rows = filteredOrders
      .map((o) =>
        [
          o.id.slice(0, 8),
          `"${o.customers?.name ?? ""}"`,
          o.channel,
          o.status,
          o.delivery_date ?? "",
          `"${o.order_items.map((i) => `${i.products?.name}x${i.qty}`).join("; ")}"`,
          format(new Date(o.created_at), "dd/MM/yyyy HH:mm"),
        ].join(","),
      )
      .join("\n");

    const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio-pedidos-${format(new Date(), "yyyy-MM-dd")}.csv`;
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
