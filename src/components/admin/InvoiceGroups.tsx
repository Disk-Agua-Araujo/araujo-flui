import { useCallback, useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Layers, Loader2, Plus, Search, Undo2 } from "lucide-react";
import { PeriodFilter } from "@/components/admin/PeriodFilter";
import { InvoiceBadge, InvoicePanel } from "@/components/admin/InvoicePanel";
import { makePeriod, periodBounds, periodLabel, periodRange, type PeriodValue } from "@/lib/period";
import { useDebounce } from "@/hooks/use-debounce";
import { useToast } from "@/hooks/use-toast";
import { adminApi, type AdminCustomerRow, type GroupOrderRow, type InvoiceGroupRow } from "@/services/admin-api";

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
/** "2026-10-05" -> "05/10/2026". */
const dayBR = (isoDay: string) => isoDay.split("-").reverse().join("/");
const code = (id: string) => id.slice(0, 8).toUpperCase();

const STATUS: Record<string, string> = {
  novo: "Novo", agendado: "Agendado", em_rota: "Em rota", entregue: "Entregue", cancelado: "Cancelado",
};

type View = { kind: "list" } | { kind: "new" } | { kind: "detail"; id: string };

/**
 * Nota agrupada: vários pedidos de um cliente (ex.: os do mês) numa NF-e só.
 * Os pedidos continuam como estão no relatório e no contas a receber.
 */
export function InvoiceGroupsDialog({
  open, onOpenChange, onChanged,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Agrupamento criado ou desfeito: a lista de pedidos precisa recarregar. */
  onChanged: () => void;
}) {
  const [view, setView] = useState<View>({ kind: "list" });

  useEffect(() => {
    if (open) setView({ kind: "list" });
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Layers className="h-5 w-5" /> Nota agrupada</DialogTitle>
        </DialogHeader>
        {view.kind === "list" && (
          <GroupList onNew={() => setView({ kind: "new" })} onOpen={(id) => setView({ kind: "detail", id })} />
        )}
        {view.kind === "new" && (
          <NewGroup
            onCancel={() => setView({ kind: "list" })}
            onCreated={(id) => { onChanged(); setView({ kind: "detail", id }); }}
          />
        )}
        {view.kind === "detail" && (
          <GroupDetail
            id={view.id}
            onBack={() => setView({ kind: "list" })}
            onUndone={() => { onChanged(); setView({ kind: "list" }); }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function GroupList({ onNew, onOpen }: { onNew: () => void; onOpen: (id: string) => void }) {
  const { toast } = useToast();
  const [groups, setGroups] = useState<InvoiceGroupRow[] | null>(null);

  useEffect(() => {
    adminApi.listGroups()
      .then(setGroups)
      .catch((err) => {
        setGroups([]);
        toast({ title: "Erro ao carregar", description: err instanceof Error ? err.message : "Erro", variant: "destructive" });
      });
  }, [toast]);

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Junte vários pedidos de um cliente numa nota fiscal só, por exemplo os pedidos do mês. Os pedidos continuam
        no relatório e no contas a receber como estão; só a nota é uma.
      </p>
      <Button size="sm" onClick={onNew}><Plus className="h-4 w-4 mr-1" /> Novo agrupamento</Button>

      {!groups ? (
        <p className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Carregando...</p>
      ) : groups.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma nota agrupada ainda.</p>
      ) : (
        <ul className="divide-y border rounded-md">
          {groups.map((g) => (
            <li key={g.id}>
              <button type="button" className="w-full text-left p-3 hover:bg-muted/50 space-y-1" onClick={() => onOpen(g.id)}>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{g.customer?.name ?? "Cliente"}</span>
                  <span className="font-medium">{brl(g.total)}</span>
                </div>
                <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
                  <span>
                    {g.orders.length} pedido{g.orders.length !== 1 ? "s" : ""}
                    {g.orders.length > 0 && `, entregas de ${dayBR(g.orders[0].delivered_on)} a ${dayBR(g.orders[g.orders.length - 1].delivered_on)}`}
                  </span>
                  {g.invoices.length ? <InvoiceBadge invoices={g.invoices} /> : <Badge variant="outline" className="text-xs">Sem nota</Badge>}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function NewGroup({ onCancel, onCreated }: { onCancel: () => void; onCreated: (id: string) => void }) {
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 350);
  const [results, setResults] = useState<AdminCustomerRow[]>([]);
  const [customer, setCustomer] = useState<AdminCustomerRow | null>(null);
  const [addressId, setAddressId] = useState<string | null>(null);
  // No começo do mês o normal é agrupar o mês que fechou.
  const [period, setPeriod] = useState<PeriodValue>(() => makePeriod(new Date().getDate() <= 10 ? "last_month" : "month"));
  const debouncedPeriod = useDebounce(period, 300);
  const [candidates, setCandidates] = useState<GroupOrderRow[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (customer || debouncedQuery.trim().length < 2) {
      setResults([]);
      return;
    }
    let cancelled = false;
    adminApi.searchCustomers(debouncedQuery.trim())
      .then((r) => { if (!cancelled) setResults(r); })
      .catch(() => { if (!cancelled) setResults([]); });
    return () => { cancelled = true; };
  }, [debouncedQuery, customer]);

  const range = useMemo(() => periodBounds(periodRange(debouncedPeriod)), [debouncedPeriod]);

  const loadCandidates = useCallback(async () => {
    if (!customer) return;
    setCandidates(null);
    try {
      const rows = await adminApi.groupCandidates(customer.id, range.from, range.to);
      setCandidates(rows);
      // Só os pedidos do cliente vêm marcados; os sem cliente ele confere um a um.
      setSelected(new Set(rows.filter((r) => r.linked).map((r) => r.id)));
    } catch (err) {
      setCandidates([]);
      toast({ title: "Erro ao buscar pedidos", description: err instanceof Error ? err.message : "Erro", variant: "destructive" });
    }
  }, [customer, range.from, range.to, toast]);

  useEffect(() => { loadCandidates(); }, [loadCandidates]);

  const pick = (c: AdminCustomerRow) => {
    setCustomer(c);
    const addresses = c.addresses ?? [];
    setAddressId((addresses.find((a) => a.is_primary) ?? addresses[0])?.id ?? null);
    setQuery("");
  };

  const chosen = (candidates ?? []).filter((o) => selected.has(o.id));
  const total = Math.round(chosen.reduce((s, o) => s + o.total * 100, 0)) / 100;

  const own = (candidates ?? []).filter((o) => o.linked);
  const loose = (candidates ?? []).filter((o) => !o.linked);

  const toggle = (id: string) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const create = async () => {
    if (!customer) return;
    setSaving(true);
    try {
      const { id } = await adminApi.createGroup({ customerId: customer.id, addressId, orderIds: chosen.map((o) => o.id) });
      toast({ title: `${chosen.length} pedidos agrupados` });
      onCreated(id);
    } catch (err) {
      toast({ title: "Não deu certo", description: err instanceof Error ? err.message : "Erro", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <Button size="sm" variant="ghost" onClick={onCancel}><ArrowLeft className="h-4 w-4 mr-1" /> Voltar</Button>

      <div className="space-y-2">
        <p className="text-sm font-medium">1. Cliente que recebe a nota</p>
        {customer ? (
          <div className="flex items-center justify-between gap-2 border rounded-md p-2">
            <div className="text-sm">
              <p className="font-medium">{customer.name}</p>
              <p className="text-xs text-muted-foreground">{customer.type === "PJ" ? customer.cnpj || "Sem CNPJ" : customer.cpf || "Sem CPF"}</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => { setCustomer(null); setCandidates(null); }}>Trocar</Button>
          </div>
        ) : (
          <div className="space-y-1">
            <div className="relative">
              <Search className="h-4 w-4 absolute left-2 top-2.5 text-muted-foreground" />
              <Input className="pl-8" placeholder="Nome, telefone ou rua" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
            {results.length > 0 && (
              <ul className="border rounded-md divide-y max-h-56 overflow-y-auto">
                {results.map((c) => (
                  <li key={c.id}>
                    <button type="button" className="w-full text-left p-2 hover:bg-muted/50 text-sm" onClick={() => pick(c)}>
                      <span className="font-medium">{c.name}</span>
                      {c.addresses?.[0] && (
                        <span className="text-xs text-muted-foreground"> · {c.addresses[0].street}, {c.addresses[0].number}</span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {customer && (customer.addresses?.length ?? 0) > 1 && (
        <label className="block space-y-1">
          <span className="text-sm font-medium">Endereço que sai na nota</span>
          <Select value={addressId ?? ""} onValueChange={setAddressId}>
            <SelectTrigger><SelectValue placeholder="Escolha o endereço" /></SelectTrigger>
            <SelectContent>
              {customer.addresses!.map((a) => (
                <SelectItem key={a.id} value={a.id}>{a.street}, {a.number}{a.complement ? ` (${a.complement})` : ""}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
      )}

      {customer && (
        <div className="space-y-2">
          <p className="text-sm font-medium">2. Pedidos do período</p>
          <PeriodFilter value={period} onChange={setPeriod} allowAll={false} />
          <p className="text-xs text-muted-foreground">
            Pedidos lançados de {periodLabel(range)}, na ordem da entrega. Pedido cancelado, já agrupado ou com nota
            própria fica de fora.
          </p>

          {!candidates ? (
            <p className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Buscando pedidos...</p>
          ) : candidates.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum pedido livre desse cliente no período.</p>
          ) : (
            <>
              <OrderChecklist
                title={`Pedidos do cliente (${own.length})`}
                orders={own}
                selected={selected}
                onToggle={toggle}
                empty="Nenhum pedido ligado a este cliente no período."
              />
              {loose.length > 0 && (
                <OrderChecklist
                  title={`Sem cliente, no mesmo endereço (${loose.length})`}
                  hint="Pedidos lançados só com o endereço. Marque os que são deste cliente."
                  orders={loose}
                  selected={selected}
                  onToggle={toggle}
                />
              )}
            </>
          )}

          {candidates && candidates.length > 0 && (
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className="text-sm">{chosen.length} pedido{chosen.length !== 1 ? "s" : ""} · <strong>{brl(total)}</strong></p>
              <Button onClick={create} disabled={saving || chosen.length < 2}>
                {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                Agrupar {chosen.length} pedidos
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function OrderChecklist({
  title, hint, orders, selected, onToggle, empty,
}: {
  title: string;
  hint?: string;
  orders: GroupOrderRow[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  empty?: string;
}) {
  return (
    <div className="space-y-1">
      <p className="text-sm font-medium">{title}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      {orders.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="border rounded-md divide-y max-h-72 overflow-y-auto">
          {orders.map((o) => (
            <li key={o.id} className="flex items-start gap-2 p-2 text-sm">
              <Checkbox checked={selected.has(o.id)} onCheckedChange={() => onToggle(o.id)} aria-label={`Pedido ${code(o.id)}`} className="mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="flex justify-between gap-2">
                  <span>Entregue {dayBR(o.delivered_on)} · {code(o.id)}</span>
                  <span className="font-medium">{brl(o.total)}</span>
                </div>
                <p className="text-xs text-muted-foreground truncate">{o.items}</p>
                <p className="text-xs text-muted-foreground">
                  {STATUS[o.status] ?? o.status}{o.address ? ` · ${o.address}` : ""}{o.a_prazo ? " · a prazo" : ""}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function GroupDetail({ id, onBack, onUndone }: { id: string; onBack: () => void; onUndone: () => void }) {
  const { toast } = useToast();
  const [group, setGroup] = useState<InvoiceGroupRow | null>(null);
  const [confirmUndo, setConfirmUndo] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    adminApi.getGroup(id)
      .then(setGroup)
      .catch((err) => toast({ title: "Erro ao carregar", description: err instanceof Error ? err.message : "Erro", variant: "destructive" }));
  }, [id, toast]);

  useEffect(load, [load]);

  const undo = async () => {
    setBusy(true);
    try {
      await adminApi.undoGroup(id);
      toast({ title: "Agrupamento desfeito", description: "Os pedidos voltaram a poder ter nota própria." });
      onUndone();
    } catch (err) {
      toast({ title: "Não deu certo", description: err instanceof Error ? err.message : "Erro", variant: "destructive" });
    } finally {
      setBusy(false);
      setConfirmUndo(false);
    }
  };

  if (!group) {
    return <p className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Carregando...</p>;
  }

  const addresses = group.customer?.addresses ?? [];
  const address = addresses.find((a) => a.id === group.address_id) ?? addresses.find((a) => a.is_primary) ?? addresses[0];

  return (
    <div className="space-y-4">
      <Button size="sm" variant="ghost" onClick={onBack}><ArrowLeft className="h-4 w-4 mr-1" /> Todas as notas agrupadas</Button>

      <div className="text-sm space-y-0.5">
        <p className="font-semibold text-base">{group.customer?.legal_name || group.customer?.name}</p>
        {address && <p className="text-muted-foreground">Endereço da nota: {address.street}, {address.number}, {address.neighborhood}</p>}
        <p>{group.orders.length} pedidos · <strong>{brl(group.total)}</strong></p>
      </div>

      <ul className="border rounded-md divide-y max-h-64 overflow-y-auto">
        {group.orders.map((o) => (
          <li key={o.id} className="p-2 text-sm">
            <div className="flex justify-between gap-2">
              <span>Entregue {dayBR(o.delivered_on)} · {code(o.id)}</span>
              <span className="font-medium">{brl(o.total)}</span>
            </div>
            <p className="text-xs text-muted-foreground truncate">{o.items}</p>
          </li>
        ))}
      </ul>

      <InvoicePanel groupId={group.id} invoices={group.invoices} onChange={load} />

      <div className="border-t pt-3">
        {confirmUndo ? (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm">Desfazer o agrupamento? Os pedidos voltam a poder ter nota própria.</span>
            <Button size="sm" variant="destructive" onClick={undo} disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Desfazer
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirmUndo(false)} disabled={busy}>Voltar</Button>
          </div>
        ) : (
          <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setConfirmUndo(true)}>
            <Undo2 className="h-4 w-4 mr-1" /> Desfazer agrupamento
          </Button>
        )}
      </div>
    </div>
  );
}
