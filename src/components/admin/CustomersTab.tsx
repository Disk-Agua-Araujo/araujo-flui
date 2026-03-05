import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Eye, Users, Plus, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

type CustomerRow = {
  id: string; name: string; phone: string | null; cnpj: string | null; email: string | null; type: string; created_at: string;
};

type OrderRow = {
  id: string; status: string; created_at: string; channel: string;
  order_items: { qty: number; products: { name: string } | null }[];
};

export function CustomersTab() {
  const { toast } = useToast();
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<CustomerRow | null>(null);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);

  // Create/Edit form
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CustomerRow | null>(null);
  const [formName, setFormName] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formType, setFormType] = useState<"PF" | "PJ">("PF");
  const [formCnpj, setFormCnpj] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formSaving, setFormSaving] = useState(false);

  const fetchCustomers = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("customers").select("*").order("created_at", { ascending: false }).limit(500);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else setCustomers((data as CustomerRow[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchCustomers(); }, []);

  const filtered = useMemo(() => {
    if (!search) return customers;
    const s = search.toLowerCase();
    return customers.filter(c => c.name.toLowerCase().includes(s) || c.phone?.includes(s) || c.cnpj?.includes(s) || c.email?.toLowerCase().includes(s));
  }, [customers, search]);

  const openDetail = async (c: CustomerRow) => {
    setSelected(c);
    setOrdersLoading(true);
    const { data } = await supabase.from("orders").select("id, status, created_at, channel, order_items(qty, products(name))").eq("customer_id", c.id).order("created_at", { ascending: false }).limit(50);
    setOrders((data as unknown as OrderRow[]) ?? []);
    setOrdersLoading(false);
  };

  const openCreate = () => {
    setEditing(null);
    setFormName(""); setFormPhone(""); setFormType("PF"); setFormCnpj(""); setFormEmail("");
    setFormOpen(true);
  };

  const openEdit = (c: CustomerRow) => {
    setEditing(c);
    setFormName(c.name); setFormPhone(c.phone ?? ""); setFormType(c.type as "PF" | "PJ"); setFormCnpj(c.cnpj ?? ""); setFormEmail(c.email ?? "");
    setFormOpen(true);
    setSelected(null);
  };

  const handleSave = async () => {
    if (!formName.trim() || !formPhone.trim()) {
      toast({ title: "Preencha nome e telefone", variant: "destructive" });
      return;
    }
    setFormSaving(true);
    try {
      const payload = {
        name: formName.trim(),
        phone: formPhone.trim(),
        type: formType as any,
        cnpj: formType === "PJ" && formCnpj.trim() ? formCnpj.trim() : null,
        email: formEmail.trim() || null,
      };

      if (editing) {
        const { error } = await supabase.from("customers").update(payload).eq("id", editing.id);
        if (error) throw error;
        toast({ title: "Cliente atualizado!" });
      } else {
        const { error } = await supabase.from("customers").insert(payload);
        if (error) throw error;
        toast({ title: "Cliente cadastrado!" });
      }
      setFormOpen(false);
      fetchCustomers();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setFormSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome, telefone, CNPJ ou email..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Badge variant="secondary"><Users className="h-3 w-3 mr-1" />{filtered.length}</Badge>
        <Button size="sm" onClick={openCreate}><Plus className="h-4 w-4 mr-1" /> Novo cliente</Button>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead className="hidden md:table-cell">Tipo</TableHead>
                <TableHead className="hidden md:table-cell">CNPJ</TableHead>
                <TableHead className="hidden md:table-cell">Email</TableHead>
                <TableHead className="hidden md:table-cell">Cadastro</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhum cliente encontrado.</TableCell></TableRow>
              ) : filtered.map(c => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="text-sm">{c.phone ?? "—"}</TableCell>
                  <TableCell className="hidden md:table-cell"><Badge variant="outline">{c.type}</Badge></TableCell>
                  <TableCell className="hidden md:table-cell text-xs">{c.cnpj ?? "—"}</TableCell>
                  <TableCell className="hidden md:table-cell text-xs">{c.email ?? "—"}</TableCell>
                  <TableCell className="hidden md:table-cell text-xs">{format(new Date(c.created_at), "dd/MM/yy")}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openDetail(c)}><Eye className="h-3.5 w-3.5" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Detail dialog */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{selected?.name}</DialogTitle></DialogHeader>
          {selected && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <p><strong>Telefone:</strong> {selected.phone ?? "—"}</p>
                <p><strong>Tipo:</strong> {selected.type}</p>
                {selected.cnpj && <p><strong>CNPJ:</strong> {selected.cnpj}</p>}
                {selected.email && <p><strong>Email:</strong> {selected.email}</p>}
                <p><strong>Cadastro:</strong> {format(new Date(selected.created_at), "dd/MM/yyyy HH:mm")}</p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => openEdit(selected)}>Editar cliente</Button>
              </div>
              <div className="border-t pt-3">
                <h4 className="font-semibold mb-2">Histórico de pedidos</h4>
                {ordersLoading ? <p className="text-muted-foreground">Carregando...</p> : orders.length === 0 ? <p className="text-muted-foreground">Nenhum pedido.</p> : (
                  <div className="space-y-2">
                    {orders.map(o => (
                      <div key={o.id} className="border rounded p-2">
                        <div className="flex justify-between text-xs">
                          <span className="font-mono">{o.id.slice(0,8)}</span>
                          <Badge variant="outline" className="text-xs">{o.status}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {o.order_items.map(i => `${i.products?.name} x${i.qty}`).join(", ")}
                        </p>
                        <p className="text-xs text-muted-foreground">{format(new Date(o.created_at), "dd/MM/yy HH:mm")} • {o.channel}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Create/Edit dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar cliente" : "Novo cliente"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Nome *</label>
              <Input value={formName} onChange={(e) => setFormName(e.target.value)} maxLength={100} />
            </div>
            <div>
              <label className="text-sm font-medium">Telefone *</label>
              <Input value={formPhone} onChange={(e) => setFormPhone(e.target.value)} type="tel" maxLength={20} />
            </div>
            <div>
              <label className="text-sm font-medium">Tipo</label>
              <Select value={formType} onValueChange={(v) => setFormType(v as "PF" | "PJ")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PF">Pessoa Física</SelectItem>
                  <SelectItem value="PJ">Pessoa Jurídica</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {formType === "PJ" && (
              <div>
                <label className="text-sm font-medium">CNPJ</label>
                <Input value={formCnpj} onChange={(e) => setFormCnpj(e.target.value)} maxLength={18} />
              </div>
            )}
            <div>
              <label className="text-sm font-medium">Email</label>
              <Input value={formEmail} onChange={(e) => setFormEmail(e.target.value)} type="email" maxLength={100} />
            </div>
            <Button className="w-full" onClick={handleSave} disabled={formSaving}>
              {formSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              {editing ? "Salvar alterações" : "Cadastrar cliente"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
