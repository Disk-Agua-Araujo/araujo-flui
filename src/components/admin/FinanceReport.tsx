import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Pencil, RefreshCw, Save, Trash2, X } from "lucide-react";
import { PeriodFilter } from "@/components/admin/PeriodFilter";
import { isoDay, makePeriod, periodBounds, periodLabel, periodRange, type PeriodValue } from "@/lib/period";
import { FINANCE_CATEGORIES, categoryLabel, parseMoney, summarizeFinance } from "@/lib/finance";
import { useDebounce } from "@/hooks/use-debounce";
import { useToast } from "@/hooks/use-toast";
import { adminApi, type FinanceEntry, type FinanceKind } from "@/services/admin-api";

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dayBR = (iso: string) => iso.split("-").reverse().join("/");

type Form = { id?: string; kind: FinanceKind; category: string; description: string; amount: string; entry_date: string };
const emptyForm = (kind: FinanceKind = "saida"): Form => ({ kind, category: "", description: "", amount: "", entry_date: isoDay(new Date()) });

/**
 * Entradas e saídas: o que entrou pelas vendas (regime de caixa) e pelos
 * lançamentos avulsos, contra os gastos lançados à mão.
 */
export function FinanceReport() {
  const { toast } = useToast();
  const [periodValue, setPeriodValue] = useState<PeriodValue>(() => makePeriod("month"));
  const period = useDebounce(periodValue, 300);
  const { from, to } = useMemo(() => periodBounds(periodRange(period)), [period]);
  const [data, setData] = useState<{ sales: number; entries: FinanceEntry[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<Form>(() => emptyForm());
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await adminApi.getFinance(from, to));
    } catch (err) {
      toast({ title: "Erro ao carregar", description: err instanceof Error ? err.message : "Erro", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [from, to, toast]);

  useEffect(() => { load(); }, [load]);

  const summary = useMemo(() => (data ? summarizeFinance(data.sales, data.entries) : null), [data]);

  const amount = parseMoney(form.amount);
  const canSave = !!form.category && amount > 0 && !!form.entry_date;

  const save = async () => {
    setSaving(true);
    try {
      await adminApi.saveFinanceEntry({
        id: form.id,
        kind: form.kind,
        category: form.category,
        description: form.description.trim() || null,
        amount,
        entry_date: form.entry_date,
      });
      toast({ title: form.id ? "Lançamento atualizado" : form.kind === "saida" ? "Saída lançada" : "Entrada lançada" });
      setForm(emptyForm(form.kind));
      await load();
    } catch (err) {
      toast({ title: "Não deu certo", description: err instanceof Error ? err.message : "Erro", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await adminApi.deleteFinanceEntry(id);
      toast({ title: "Lançamento excluído" });
      if (form.id === id) setForm(emptyForm());
      await load();
    } catch (err) {
      toast({ title: "Não deu certo", description: err instanceof Error ? err.message : "Erro", variant: "destructive" });
    } finally {
      setConfirmDelete(null);
    }
  };

  const edit = (e: FinanceEntry) => setForm({
    id: e.id,
    kind: e.kind,
    category: e.category,
    description: e.description ?? "",
    amount: e.amount.toFixed(2).replace(".", ","),
    entry_date: e.entry_date,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="text-xl font-bold">Entradas e saídas</h2>
        <Button variant="outline" size="icon" onClick={load} disabled={loading} title="Atualizar">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>
      <PeriodFilter value={periodValue} onChange={setPeriodValue} />

      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Entradas</p>
            <p className="text-2xl font-bold text-green-700">{summary ? brl(summary.totalIn) : "..."}</p>
            {summary && (
              <p className="text-xs text-muted-foreground">
                Vendas {brl(summary.sales)}{summary.otherIn > 0 ? ` + avulsas ${brl(summary.otherIn)}` : ""}
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Saídas</p>
            <p className="text-2xl font-bold text-destructive">{summary ? brl(summary.totalOut) : "..."}</p>
            <p className="text-xs text-muted-foreground">Gastos lançados no período</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Resultado</p>
            <p className={`text-2xl font-bold ${summary && summary.result < 0 ? "text-destructive" : ""}`}>
              {summary ? brl(summary.result) : "..."}
            </p>
            <p className="text-xs text-muted-foreground">{periodLabel(periodRange(period))}</p>
          </CardContent>
        </Card>
      </div>
      <p className="text-xs text-muted-foreground">
        As vendas entram sozinhas, pelo dia em que o dinheiro entrou (o mesmo do relatório Caixa): venda a prazo só
        conta quando é recebida. Gastos e entradas fora dos pedidos são lançados abaixo.
      </p>

      <Card>
        <CardHeader><CardTitle className="text-lg">{form.id ? "Editar lançamento" : "Lançar"}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            {(["saida", "entrada"] as const).map((k) => (
              <Button
                key={k}
                size="sm"
                variant={form.kind === k ? "default" : "outline"}
                onClick={() => setForm({ ...form, kind: k, category: "" })}
              >
                {k === "saida" ? "Saída (gasto)" : "Entrada"}
              </Button>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Categoria</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger><SelectValue placeholder="Escolha" /></SelectTrigger>
                <SelectContent>
                  {FINANCE_CATEGORIES[form.kind].map((c) => <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Valor (R$)</Label>
              <Input inputMode="decimal" placeholder="0,00" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
              {form.amount && !(amount > 0) && <p className="text-xs text-destructive">Use o formato 1.234,56</p>}
            </div>
            <div className="space-y-1">
              <Label>Data</Label>
              <Input type="date" value={form.entry_date} onChange={(e) => setForm({ ...form, entry_date: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Descrição (opcional)</Label>
              <Input maxLength={200} placeholder="Ex.: 200 galões Crystal" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={save} disabled={!canSave || saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
              {form.id ? "Salvar alteração" : "Lançar"}
            </Button>
            {form.id && (
              <Button variant="ghost" onClick={() => setForm(emptyForm())}><X className="h-4 w-4 mr-1" /> Cancelar edição</Button>
            )}
          </div>
        </CardContent>
      </Card>

      {summary && summary.outByCategory.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-lg">Saídas por categoria</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Categoria</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Das saídas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.outByCategory.map((c) => (
                  <TableRow key={c.key}>
                    <TableCell>{c.label}</TableCell>
                    <TableCell className="text-right">{brl(c.total)}</TableCell>
                    <TableCell className="text-right">{Math.round(c.share * 100)}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-lg">Lançamentos do período</CardTitle></CardHeader>
        <CardContent>
          {!data ? (
            <p className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Carregando...</p>
          ) : data.entries.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum lançamento no período.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.entries.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="whitespace-nowrap">{dayBR(e.entry_date)}</TableCell>
                    <TableCell>{categoryLabel(e.kind, e.category)}</TableCell>
                    <TableCell className="text-muted-foreground">{e.description}</TableCell>
                    <TableCell className={`text-right whitespace-nowrap font-medium ${e.kind === "saida" ? "text-destructive" : "text-green-700"}`}>
                      {e.kind === "saida" ? "- " : "+ "}{brl(e.amount)}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      {confirmDelete === e.id ? (
                        <>
                          <Button size="sm" variant="destructive" onClick={() => remove(e.id)}>Excluir</Button>
                          <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(null)}>Voltar</Button>
                        </>
                      ) : (
                        <>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => edit(e)} title="Editar">
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setConfirmDelete(e.id)} title="Excluir">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
