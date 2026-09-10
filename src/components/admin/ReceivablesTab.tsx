import { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PaymentIcon, PAYMENT_LABELS } from "@/components/PaymentIcon";
import { MessageCircle, RefreshCw, Loader2, CheckCircle2, Undo2, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { useDebounce } from "@/hooks/use-debounce";
import { adminApi, type ReceivableRow, type ReceivablesSummary } from "@/services/admin-api";
import { buildReceivableMessage, openCustomerWhatsApp } from "@/services/whatsapp";

const PAGE_SIZE = 50;

/** Datas de vencimento e recebimento são sempre o dia de São Paulo. */
function localToday(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

function firstDayOfMonth(): string {
  return localToday().slice(0, 8) + "01";
}

/** Converte "aaaa-mm-dd" sem passar pelo fuso do navegador. */
function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function formatDateBR(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function diffInDays(fromISO: string, toISO: string): number {
  return Math.round((parseISODate(toISO).getTime() - parseISODate(fromISO).getTime()) / 86400000);
}

function formatCurrency(value: number | null) {
  return (value ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function itemsSummary(items: ReceivableRow["order_items"]) {
  if (!items || items.length === 0) return "Sem itens";
  return items.map((i) => `${i.qty}x ${i.products?.name || "?"}`).join(", ");
}

type Situacao = "vencido" | "hoje" | "a_vencer";

function getSituacao(dueDate: string, today: string): Situacao {
  if (dueDate < today) return "vencido";
  if (dueDate === today) return "hoje";
  return "a_vencer";
}

function DueBadge({ dueDate, today }: { dueDate: string; today: string }) {
  const situacao = getSituacao(dueDate, today);

  if (situacao === "vencido") {
    const dias = diffInDays(dueDate, today);
    return (
      <Badge className="bg-red-100 text-red-800 hover:bg-red-100 text-xs">
        Vencido há {dias} dia{dias !== 1 ? "s" : ""}
      </Badge>
    );
  }

  if (situacao === "hoje") {
    return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100 text-xs">Vence hoje</Badge>;
  }

  const dias = diffInDays(today, dueDate);
  return (
    <Badge variant="outline" className="text-xs">
      Vence em {dias} dia{dias !== 1 ? "s" : ""}
    </Badge>
  );
}

// ---- Diálogo de baixa ----

function ReceivePaymentDialog({
  row, today, onOpenChange, onConfirmed,
}: {
  row: ReceivableRow | null;
  today: string;
  onOpenChange: (open: boolean) => void;
  onConfirmed: () => void;
}) {
  const { toast } = useToast();
  const [paidAt, setPaidAt] = useState(today);
  const [paymentMethod, setPaymentMethod] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!row) return;
    setPaidAt(today);
    setPaymentMethod(row.payment_method || "");
  }, [row, today]);

  const handleConfirm = async () => {
    if (!row) return;
    if (!paidAt) {
      toast({ title: "Informe a data do recebimento", variant: "destructive" });
      return;
    }
    if (!paymentMethod) {
      toast({
        title: "Informe a forma de pagamento",
        description: "Sem ela o recebimento não aparece no relatório de caixa.",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    try {
      await adminApi.markReceivablePaid({
        orderId: row.id,
        paidAt,
        paymentMethod: paymentMethod || undefined,
      });
      toast({
        title: "Recebimento registrado.",
        description: `${formatCurrency(row.total_amount)} entrou no caixa em ${formatDateBR(paidAt)}.`,
      });
      onConfirmed();
      onOpenChange(false);
    } catch (err) {
      toast({
        title: "Erro ao registrar",
        description: err instanceof Error ? err.message : "Erro",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!row} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Registrar recebimento</DialogTitle></DialogHeader>

        {row && (
          <div className="space-y-4">
            <div className="rounded-md border bg-muted/40 p-3 text-sm space-y-1">
              <p className="font-medium">{row.customers?.name || "Sem cadastro"}</p>
              <p className="text-muted-foreground text-xs">
                Pedido {row.id.slice(0, 8).toUpperCase()} · venceu em {formatDateBR(row.payment_due_date)}
              </p>
              <p className="text-lg font-semibold">{formatCurrency(row.total_amount)}</p>
            </div>

            <div>
              <label className="text-xs font-medium">Data do recebimento</label>
              <Input type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
              <p className="text-xs text-muted-foreground mt-1">
                O valor entra no caixa nesta data, não na data do pedido.
              </p>
            </div>

            <div>
              <label className="text-xs font-medium">Forma de pagamento</label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {(["cash", "pix", "card"] as const).map((m) => (
                    <SelectItem key={m} value={m}>
                      <span className="inline-flex items-center gap-2">
                        <PaymentIcon method={m} size={14} /> {PAYMENT_LABELS[m]}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2 pt-1">
              <Button className="flex-1" onClick={handleConfirm} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
                Confirmar recebimento
              </Button>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ---- Aba ----

export function ReceivablesTab() {
  const { toast } = useToast();
  const isMobile = useIsMobile();

  const [view, setView] = useState<"open" | "paid">("open");
  const [rows, setRows] = useState<ReceivableRow[]>([]);
  const [summary, setSummary] = useState<ReceivablesSummary | null>(null);
  const [today, setToday] = useState(localToday);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [dateStart, setDateStart] = useState(firstDayOfMonth);
  const [dateEnd, setDateEnd] = useState(localToday);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 350);
  const [payTarget, setPayTarget] = useState<ReceivableRow | null>(null);
  const [undoTarget, setUndoTarget] = useState<ReceivableRow | null>(null);
  const [undoing, setUndoing] = useState(false);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const result = await adminApi.listReceivables({
        view,
        page,
        pageSize: PAGE_SIZE,
        ...(debouncedSearch.trim() ? { search: debouncedSearch.trim() } : {}),
        ...(view === "paid" ? { dateStart, dateEnd } : {}),
      });
      setRows(result.rows);
      setTotal(result.total);
      setSummary(result.summary);
      if (result.today) setToday(result.today);
    } catch (err) {
      toast({
        title: "Erro ao carregar contas",
        description: err instanceof Error ? err.message : "Erro",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [view, page, dateStart, dateEnd, debouncedSearch, toast]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  const groups = useMemo(() => {
    const vencidos: ReceivableRow[] = [];
    const hoje: ReceivableRow[] = [];
    const aVencer: ReceivableRow[] = [];
    for (const row of rows) {
      const situacao = getSituacao(row.payment_due_date, today);
      if (situacao === "vencido") vencidos.push(row);
      else if (situacao === "hoje") hoje.push(row);
      else aVencer.push(row);
    }
    return [
      { key: "vencidos", label: "Vencidos", rows: vencidos },
      { key: "hoje", label: "Vence hoje", rows: hoje },
      { key: "a_vencer", label: "A vencer", rows: aVencer },
    ].filter((g) => g.rows.length > 0);
  }, [rows, today]);

  const handleCobrar = (row: ReceivableRow) => {
    const situacao = getSituacao(row.payment_due_date, today);
    const message = buildReceivableMessage({
      cliente: row.customers?.name || "",
      pedidoId: row.id.slice(0, 8).toUpperCase(),
      valor: row.total_amount ?? 0,
      vencimento: formatDateBR(row.payment_due_date),
      situacao,
      diasAtraso: situacao === "vencido" ? diffInDays(row.payment_due_date, today) : undefined,
    });

    if (!openCustomerWhatsApp(row.customers?.phone, message)) {
      toast({
        title: "Cliente sem telefone",
        description: "Cadastre o telefone do cliente para enviar a cobrança pelo WhatsApp.",
        variant: "destructive",
      });
    }
  };

  const handleUndo = async () => {
    if (!undoTarget) return;
    setUndoing(true);
    try {
      await adminApi.undoReceivablePaid(undoTarget.id);
      toast({ title: "Recebimento estornado. A conta voltou para em aberto." });
      setUndoTarget(null);
      fetchRows();
    } catch (err) {
      toast({
        title: "Erro ao estornar",
        description: err instanceof Error ? err.message : "Erro",
        variant: "destructive",
      });
    } finally {
      setUndoing(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const switchView = (next: "open" | "paid") => {
    setView(next);
    setPage(0);
  };

  const searching = debouncedSearch.trim().length > 0;

  return (
    <div className="space-y-4">
      {/* Resumo */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total em aberto</p>
            <p className="text-xl font-bold">{formatCurrency(summary?.open_total ?? 0)}</p>
            <p className="text-xs text-muted-foreground">{summary?.open_count ?? 0} conta{(summary?.open_count ?? 0) !== 1 ? "s" : ""}</p>
          </CardContent>
        </Card>
        <Card className="border-yellow-200">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Vence hoje</p>
            <p className="text-xl font-bold text-yellow-700">{formatCurrency(summary?.due_today_total ?? 0)}</p>
            <p className="text-xs text-muted-foreground">{summary?.due_today_count ?? 0} conta{(summary?.due_today_count ?? 0) !== 1 ? "s" : ""}</p>
          </CardContent>
        </Card>
        <Card className="border-red-200">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Vencidos</p>
            <p className="text-xl font-bold text-red-700">{formatCurrency(summary?.late_total ?? 0)}</p>
            <p className="text-xs text-muted-foreground">{summary?.late_count ?? 0} conta{(summary?.late_count ?? 0) !== 1 ? "s" : ""}</p>
          </CardContent>
        </Card>
        <Card className="border-green-200">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Recebido no período</p>
            <p className="text-xl font-bold text-green-700">{formatCurrency(summary?.received_total ?? 0)}</p>
            <p className="text-xs text-muted-foreground">
              {view === "paid"
                ? `${summary?.received_count ?? 0} conta${(summary?.received_count ?? 0) !== 1 ? "s" : ""}`
                : "Veja em Recebidos"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-md border overflow-hidden">
          <button
            type="button"
            className={`px-3 py-1.5 text-sm ${view === "open" ? "bg-[hsl(var(--brand-blue))] text-white" : "bg-background"}`}
            onClick={() => switchView("open")}
          >
            Em aberto
          </button>
          <button
            type="button"
            className={`px-3 py-1.5 text-sm ${view === "paid" ? "bg-[hsl(var(--brand-blue))] text-white" : "bg-background"}`}
            onClick={() => switchView("paid")}
          >
            Recebidos
          </button>
        </div>

        {view === "paid" && (
          <div className="flex items-center gap-2">
            <Input
              type="date"
              className="w-[150px]"
              value={dateStart}
              onChange={(e) => { setDateStart(e.target.value); setPage(0); }}
            />
            <span className="text-sm text-muted-foreground">até</span>
            <Input
              type="date"
              className="w-[150px]"
              value={dateEnd}
              onChange={(e) => { setDateEnd(e.target.value); setPage(0); }}
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

        <Button variant="outline" size="icon" onClick={fetchRows} disabled={loading} title="Atualizar">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">
        {total} conta{total !== 1 ? "s" : ""} {view === "open" ? "em aberto" : "recebida" + (total !== 1 ? "s" : "")}
      </p>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={`sk-${i}`} className="animate-pulse h-16 bg-muted rounded" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            {searching
              ? "Nenhuma conta encontrada para esta busca."
              : view === "open"
                ? "Nenhuma conta a receber em aberto. Pedidos a prazo aparecem aqui assim que a data de vencimento for definida no lançamento."
                : "Nenhum recebimento registrado neste período."}
          </CardContent>
        </Card>
      ) : view === "paid" ? (
        <PaidList
          rows={rows}
          isMobile={isMobile}
          onUndo={setUndoTarget}
        />
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <div key={group.key} className="space-y-2">
              <h3 className="text-sm font-semibold">
                {group.label}
                <span className="ml-2 text-muted-foreground font-normal">
                  {group.rows.length} conta{group.rows.length !== 1 ? "s" : ""}
                </span>
              </h3>
              <OpenList
                rows={group.rows}
                today={today}
                isMobile={isMobile}
                onCobrar={handleCobrar}
                onReceber={setPayTarget}
              />
            </div>
          ))}
        </div>
      )}

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

      <ReceivePaymentDialog
        row={payTarget}
        today={today}
        onOpenChange={(open) => { if (!open) setPayTarget(null); }}
        onConfirmed={fetchRows}
      />

      <AlertDialog open={!!undoTarget} onOpenChange={(open) => { if (!open) setUndoTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Estornar recebimento?</AlertDialogTitle>
            <AlertDialogDescription>
              O pedido {undoTarget?.id.slice(0, 8).toUpperCase()} volta para a lista de contas em aberto e o valor sai
              do caixa da data em que foi registrado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={undoing}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); handleUndo(); }} disabled={undoing}>
              {undoing && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Estornar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ---- Listas ----

function OpenList({
  rows, today, isMobile, onCobrar, onReceber,
}: {
  rows: ReceivableRow[];
  today: string;
  isMobile: boolean;
  onCobrar: (row: ReceivableRow) => void;
  onReceber: (row: ReceivableRow) => void;
}) {
  if (isMobile) {
    return (
      <div className="space-y-2">
        {rows.map((row) => (
          <Card key={row.id}>
            <CardContent className="p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium truncate">{row.customers?.name || "Sem cadastro"}</p>
                  <p className="text-xs text-muted-foreground font-mono">{row.id.slice(0, 8).toUpperCase()}</p>
                </div>
                <p className="font-semibold whitespace-nowrap">{formatCurrency(row.total_amount)}</p>
              </div>

              <p className="text-xs text-muted-foreground">{itemsSummary(row.order_items)}</p>

              <div className="flex items-center gap-2 flex-wrap">
                <DueBadge dueDate={row.payment_due_date} today={today} />
                <span className="text-xs text-muted-foreground">Vencimento {formatDateBR(row.payment_due_date)}</span>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1" onClick={() => onCobrar(row)}>
                  <MessageCircle className="h-4 w-4 mr-1" /> Cobrar
                </Button>
                <Button size="sm" className="flex-1" onClick={() => onReceber(row)}>
                  <CheckCircle2 className="h-4 w-4 mr-1" /> Receber
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead>Pedido</TableHead>
              <TableHead>Itens</TableHead>
              <TableHead>Vencimento</TableHead>
              <TableHead>Situação</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>
                  <p className="font-medium">{row.customers?.name || "Sem cadastro"}</p>
                  <p className="text-xs text-muted-foreground">{row.customers?.phone || "Sem telefone"}</p>
                </TableCell>
                <TableCell className="font-mono text-xs">{row.id.slice(0, 8).toUpperCase()}</TableCell>
                <TableCell className="text-sm max-w-[220px] truncate">{itemsSummary(row.order_items)}</TableCell>
                <TableCell className="text-sm">{formatDateBR(row.payment_due_date)}</TableCell>
                <TableCell><DueBadge dueDate={row.payment_due_date} today={today} /></TableCell>
                <TableCell className="text-right font-semibold">{formatCurrency(row.total_amount)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="outline" size="sm" onClick={() => onCobrar(row)}>
                      <MessageCircle className="h-4 w-4 mr-1" /> Cobrar
                    </Button>
                    <Button size="sm" onClick={() => onReceber(row)}>
                      <CheckCircle2 className="h-4 w-4 mr-1" /> Receber
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function PaidList({
  rows, isMobile, onUndo,
}: {
  rows: ReceivableRow[];
  isMobile: boolean;
  onUndo: (row: ReceivableRow) => void;
}) {
  if (isMobile) {
    return (
      <div className="space-y-2">
        {rows.map((row) => (
          <Card key={row.id}>
            <CardContent className="p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium truncate">{row.customers?.name || "Sem cadastro"}</p>
                  <p className="text-xs text-muted-foreground font-mono">{row.id.slice(0, 8).toUpperCase()}</p>
                </div>
                <p className="font-semibold text-green-700 whitespace-nowrap">{formatCurrency(row.total_amount)}</p>
              </div>

              <p className="text-xs text-muted-foreground">
                Recebido em {formatDateBR(row.paid_at)}
                {row.paid_by ? ` por ${row.paid_by}` : ""} · vencia em {formatDateBR(row.payment_due_date)}
              </p>

              <Button variant="outline" size="sm" className="w-full" onClick={() => onUndo(row)}>
                <Undo2 className="h-4 w-4 mr-1" /> Estornar
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead>Pedido</TableHead>
              <TableHead>Vencimento</TableHead>
              <TableHead>Recebido em</TableHead>
              <TableHead>Pgto</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>
                  <p className="font-medium">{row.customers?.name || "Sem cadastro"}</p>
                  <p className="text-xs text-muted-foreground">{row.customers?.phone || "Sem telefone"}</p>
                </TableCell>
                <TableCell className="font-mono text-xs">{row.id.slice(0, 8).toUpperCase()}</TableCell>
                <TableCell className="text-sm">{formatDateBR(row.payment_due_date)}</TableCell>
                <TableCell className="text-sm">
                  {formatDateBR(row.paid_at)}
                  {row.paid_by && <span className="block text-xs text-muted-foreground">por {row.paid_by}</span>}
                </TableCell>
                <TableCell>
                  {row.payment_method && (
                    <Badge variant="outline" className="text-xs gap-1">
                      <PaymentIcon method={row.payment_method} size={12} />
                      {PAYMENT_LABELS[row.payment_method as "cash" | "pix" | "card"] || row.payment_method}
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-right font-semibold text-green-700">{formatCurrency(row.total_amount)}</TableCell>
                <TableCell className="text-right">
                  <Button variant="outline" size="sm" onClick={() => onUndo(row)}>
                    <Undo2 className="h-4 w-4 mr-1" /> Estornar
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
