import { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PaymentIcon, PAYMENT_LABELS } from "@/components/PaymentIcon";
import { Search, RefreshCw, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { format, startOfDay, startOfWeek, startOfMonth } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { useDebounce } from "@/hooks/use-debounce";
import { adminApi, type CashReportResult } from "@/services/admin-api";

const PAGE_SIZE = 50;

type PeriodKey = "today" | "week" | "month" | "custom";

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDateBR(iso: string | null) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function toISO(d: Date) {
  return format(d, "yyyy-MM-dd");
}

function periodRange(period: PeriodKey, customFrom: string, customTo: string) {
  const now = new Date();
  if (period === "today") return { start: toISO(startOfDay(now)), end: toISO(now) };
  if (period === "week") return { start: toISO(startOfWeek(now, { weekStartsOn: 1 })), end: toISO(now) };
  if (period === "month") return { start: toISO(startOfMonth(now)), end: toISO(now) };
  return { start: customFrom, end: customTo };
}

export function CashReport() {
  const { toast } = useToast();
  const isMobile = useIsMobile();

  const [period, setPeriod] = useState<PeriodKey>("month");
  const [customFrom, setCustomFrom] = useState(() => toISO(startOfMonth(new Date())));
  const [customTo, setCustomTo] = useState(() => toISO(new Date()));
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 350);
  const [page, setPage] = useState(0);
  const [data, setData] = useState<CashReportResult | null>(null);
  const [loading, setLoading] = useState(true);

  const { start, end } = useMemo(
    () => periodRange(period, customFrom, customTo),
    [period, customFrom, customTo],
  );

  const fetchData = useCallback(async () => {
    if (!start || !end) return;
    setLoading(true);
    try {
      const result = await adminApi.getCashReport({
        dateStart: start,
        dateEnd: end,
        page,
        pageSize: PAGE_SIZE,
        ...(debouncedSearch.trim() ? { search: debouncedSearch.trim() } : {}),
      });
      setData(result);
    } catch (err) {
      toast({
        title: "Erro ao carregar o caixa",
        description: err instanceof Error ? err.message : "Erro",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [start, end, page, debouncedSearch, toast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const totals = useMemo(() => {
    const byMethod: Record<string, number> = { cash: 0, pix: 0, card: 0 };
    let aVista = 0;
    let aPrazo = 0;
    let grand = 0;

    for (const row of data?.byMethod ?? []) {
      if (row.payment_method && row.payment_method in byMethod) {
        byMethod[row.payment_method] += row.total;
      }
      if (row.a_prazo) aPrazo += row.total;
      else aVista += row.total;
      grand += row.total;
    }

    return { byMethod, aVista, aPrazo, grand };
  }, [data]);

  const entries = data?.entries ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const searching = debouncedSearch.trim().length > 0;

  return (
    <div className="space-y-4">
      <div className="rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
        O dinheiro aparece aqui no dia em que entrou. Pedido à vista conta na data do pedido, pedido a prazo conta
        na data do recebimento, e o que ainda está em aberto na aba Receber não entra neste relatório.
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={period} onValueChange={(v) => { setPeriod(v as PeriodKey); setPage(0); }}>
          <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Hoje</SelectItem>
            <SelectItem value="week">Esta semana</SelectItem>
            <SelectItem value="month">Este mês</SelectItem>
            <SelectItem value="custom">Personalizado</SelectItem>
          </SelectContent>
        </Select>

        {period === "custom" && (
          <div className="flex items-center gap-2">
            <Input
              type="date"
              className="w-[150px]"
              value={customFrom}
              onChange={(e) => { setCustomFrom(e.target.value); setPage(0); }}
            />
            <span className="text-sm text-muted-foreground">até</span>
            <Input
              type="date"
              className="w-[150px]"
              value={customTo}
              onChange={(e) => { setCustomTo(e.target.value); setPage(0); }}
            />
          </div>
        )}

        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Buscar por cliente ou telefone"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          />
        </div>

        <Button variant="outline" size="icon" onClick={fetchData} disabled={loading} title="Atualizar">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Período: {formatDateBR(start)} a {formatDateBR(end)}
      </p>

      {/* Totais */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="border-l-4" style={{ borderLeftColor: "#033D7B" }}>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Entrou no caixa</p>
            <p className="text-xl font-bold">{loading ? "…" : formatCurrency(totals.grand)}</p>
            <p className="text-xs text-muted-foreground">{total} lançamento{total !== 1 ? "s" : ""}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4" style={{ borderLeftColor: "#4CAF50" }}>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <PaymentIcon method="cash" size={14} /> Dinheiro
            </p>
            <p className="text-xl font-bold">{loading ? "…" : formatCurrency(totals.byMethod.cash)}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4" style={{ borderLeftColor: "#2196F3" }}>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <PaymentIcon method="pix" size={14} /> PIX
            </p>
            <p className="text-xl font-bold">{loading ? "…" : formatCurrency(totals.byMethod.pix)}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4" style={{ borderLeftColor: "#9C27B0" }}>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <PaymentIcon method="card" size={14} /> Cartão
            </p>
            <p className="text-xl font-bold">{loading ? "…" : formatCurrency(totals.byMethod.card)}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Veio de pedido à vista</p>
            <p className="text-lg font-semibold">{loading ? "…" : formatCurrency(totals.aVista)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Veio de pedido a prazo</p>
            <p className="text-lg font-semibold">{loading ? "…" : formatCurrency(totals.aPrazo)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Lançamentos */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Lançamentos do caixa</CardTitle>
        </CardHeader>
        <CardContent className={isMobile ? "space-y-2" : "p-0"}>
          {loading ? (
            <div className="py-8 text-center text-muted-foreground">
              <Loader2 className="inline h-4 w-4 animate-spin mr-1" /> Calculando...
            </div>
          ) : entries.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              {searching ? "Nenhum lançamento encontrado para esta busca." : "Nenhuma entrada no período."}
            </div>
          ) : isMobile ? (
            entries.map((e) => (
              <div key={e.order_id} className="rounded-md border p-3 space-y-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{e.customer_name || "Sem cadastro"}</p>
                    <p className="text-xs text-muted-foreground font-mono">{e.order_id.slice(0, 8).toUpperCase()}</p>
                  </div>
                  <p className="font-semibold whitespace-nowrap">{formatCurrency(e.total_amount)}</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-muted-foreground">{formatDateBR(e.cash_date)}</span>
                  <Badge variant={e.a_prazo ? "secondary" : "outline"} className="text-xs">
                    {e.a_prazo ? "A prazo" : "À vista"}
                  </Badge>
                  {e.payment_method && (
                    <Badge variant="outline" className="text-xs gap-1">
                      <PaymentIcon method={e.payment_method} size={12} />
                      {PAYMENT_LABELS[e.payment_method as "cash" | "pix" | "card"] || e.payment_method}
                    </Badge>
                  )}
                </div>
              </div>
            ))
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data do caixa</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Pedido</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead>Pgto</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((e) => (
                  <TableRow key={e.order_id}>
                    <TableCell className="text-sm">{formatDateBR(e.cash_date)}</TableCell>
                    <TableCell>
                      <p className="font-medium">{e.customer_name || "Sem cadastro"}</p>
                      <p className="text-xs text-muted-foreground">{e.customer_phone || "Sem telefone"}</p>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{e.order_id.slice(0, 8).toUpperCase()}</TableCell>
                    <TableCell>
                      <Badge variant={e.a_prazo ? "secondary" : "outline"} className="text-xs">
                        {e.a_prazo ? `A prazo, vencia ${formatDateBR(e.due_date)}` : "À vista"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {e.payment_method && (
                        <Badge variant="outline" className="text-xs gap-1">
                          <PaymentIcon method={e.payment_method} size={12} />
                          {PAYMENT_LABELS[e.payment_method as "cash" | "pix" | "card"] || e.payment_method}
                          {e.is_split && e.payment_method_2 && (
                            <span className="text-muted-foreground">
                              {" + "}{PAYMENT_LABELS[e.payment_method_2 as "cash" | "pix" | "card"] || e.payment_method_2}
                            </span>
                          )}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-semibold">{formatCurrency(e.total_amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="icon" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">Página {page + 1} de {totalPages}</span>
          <Button variant="outline" size="icon" disabled={page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
