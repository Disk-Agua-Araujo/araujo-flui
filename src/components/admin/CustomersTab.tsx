import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Eye, Users, Plus, Loader2, ClipboardList, Pencil, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { isValidCnpj, maskCnpj } from "@/lib/cnpj";
import { adminApi, type AdminCustomerRow, type CustomerOrderRow } from "@/services/admin-api";
import { normalize } from "@/lib/normalize";

const PREFILL_KEY = "admin-new-order-customer";

const normalizePhone = (value: string) => value.replace(/\D/g, "");

const maskCep = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
};

export function CustomersTab() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<AdminCustomerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<AdminCustomerRow | null>(null);
  const [orders, setOrders] = useState<CustomerOrderRow[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AdminCustomerRow | null>(null);
  const [formName, setFormName] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formType, setFormType] = useState<"PF" | "PJ">("PF");
  const [formCnpj, setFormCnpj] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formSaving, setFormSaving] = useState(false);

  // Address fields
  const [formStreet, setFormStreet] = useState("");
  const [formNumber, setFormNumber] = useState("");
  const [formNeighborhood, setFormNeighborhood] = useState("");
  const [formCity, setFormCity] = useState("Santo André");
  const [formState, setFormState] = useState("SP");
  const [formZip, setFormZip] = useState("");
  const [formComplement, setFormComplement] = useState("");
  const [formReference, setFormReference] = useState("");

  // Duplicate address warning
  const [duplicateWarning, setDuplicateWarning] = useState<{ name: string; street: string; number: string; complement?: string; customerId: string } | null>(null);
  const [forceCreate, setForceCreate] = useState(false);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<AdminCustomerRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const data = await adminApi.listCustomers();
      setCustomers(data ?? []);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao carregar clientes";
      toast({ title: "Erro", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCustomers(); }, []);

  const filtered = useMemo(() => {
    if (!search) return customers;
    const s = normalize(search);
    return customers.filter((c) => {
      if (normalize(c.name).includes(s)) return true;
      if (normalize(c.phone || "").includes(s)) return true;
      if ((c.cnpj || "").includes(s)) return true;
      if (normalize(c.email || "").includes(s)) return true;
      if (c.addresses?.some((a) => normalize(a.street).includes(s) || normalize(a.neighborhood).includes(s))) return true;
      return false;
    });
  }, [customers, search]);

  const getPrimaryAddress = (c: AdminCustomerRow) =>
    c.addresses?.find((a) => a.is_primary) ?? c.addresses?.[0] ?? null;

  const openDetail = async (c: AdminCustomerRow) => {
    setSelected(c);
    setOrdersLoading(true);
    try {
      const data = await adminApi.getCustomerOrders(c.id);
      setOrders(data ?? []);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao carregar histórico";
      toast({ title: "Erro", description: message, variant: "destructive" });
      setOrders([]);
    } finally {
      setOrdersLoading(false);
    }
  };

  const clearAddressFields = () => {
    setFormStreet(""); setFormNumber(""); setFormNeighborhood("");
    setFormCity("Santo André"); setFormState("SP");
    setFormZip(""); setFormComplement(""); setFormReference("");
  };

  const openCreate = () => {
    setEditing(null); setFormName(""); setFormPhone("");
    setFormType("PF"); setFormCnpj(""); setFormEmail("");
    clearAddressFields();
    setDuplicateWarning(null); setForceCreate(false);
    setFormOpen(true);
  };

  const openEdit = (c: AdminCustomerRow) => {
    setEditing(c);
    setFormName(c.name); setFormPhone(c.phone ?? "");
    setFormType(c.type); setFormCnpj(c.cnpj ?? ""); setFormEmail(c.email ?? "");
    const addr = getPrimaryAddress(c);
    if (addr) {
      setFormStreet(addr.street); setFormNumber(addr.number);
      setFormNeighborhood(addr.neighborhood); setFormCity(addr.city || "Santo André");
      setFormState(addr.state || "SP"); setFormZip(addr.zip ?? "");
      setFormComplement(addr.complement ?? ""); setFormReference(addr.reference ?? "");
    } else { clearAddressFields(); }
    setDuplicateWarning(null); setForceCreate(false);
    setFormOpen(true);
    setSelected(null);
  };

  const handleSave = async () => {
    if (!formStreet.trim() || !formNumber.trim() || !formNeighborhood.trim()) {
      toast({ title: "Dados obrigatórios", description: "Preencha o endereço completo (rua, número e bairro).", variant: "destructive" });
      return;
    }
    if (formType === "PJ") {
      if (!formCnpj.trim()) { toast({ title: "CNPJ obrigatório", variant: "destructive" }); return; }
      if (!isValidCnpj(formCnpj)) { toast({ title: "CNPJ inválido", variant: "destructive" }); return; }
    }

    // Duplicate address check (skip if forceCreate or editing same address)
    if (!forceCreate) {
      try {
        const dup = await adminApi.checkDuplicateAddress(
          formStreet.trim(), formNumber.trim(), editing?.id
        );
        if (dup && dup.customers) {
          setDuplicateWarning({
            name: dup.customers.name,
            street: formStreet.trim(),
            number: formNumber.trim(),
            customerId: dup.customer_id,
          });
          return;
        }
      } catch { /* proceed if check fails */ }
    }

    setFormSaving(true);
    try {
      await adminApi.saveCustomer({
        id: editing?.id,
        name: formName.trim() || "Sem nome",
        phone: normalizePhone(formPhone) || "",
        type: formType,
        cnpj: formType === "PJ" ? formCnpj : null,
        email: formEmail.trim() || null,
        address: {
          street: formStreet.trim(), number: formNumber.trim(),
          neighborhood: formNeighborhood.trim(),
          city: formCity.trim() || "Santo André", state: formState.trim() || "SP",
          complement: formComplement.trim() || null,
          zip: formZip.replace(/\D/g, "").trim() || null,
          reference: formReference.trim() || null,
        },
      });
      toast({ title: editing ? "Cliente atualizado com sucesso." : "Cliente cadastrado!" });
      setFormOpen(false);
      setDuplicateWarning(null); setForceCreate(false);
      fetchCustomers();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao salvar cliente";
      toast({ title: "Erro", description: message, variant: "destructive" });
    } finally {
      setFormSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await adminApi.deleteCustomer(deleteTarget.id);
      toast({ title: "Cliente excluído com sucesso." });
      setDeleteTarget(null);
      fetchCustomers();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao excluir cliente";
      toast({ title: "Erro", description: message, variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  const handleViewDuplicate = () => {
    if (!duplicateWarning) return;
    const c = customers.find((x) => x.id === duplicateWarning.customerId);
    if (c) { setFormOpen(false); setDuplicateWarning(null); openDetail(c); }
  };

  const handleForceCreate = () => {
    setForceCreate(true);
    setDuplicateWarning(null);
    // Re-trigger save
    setTimeout(() => handleSave(), 50);
  };

  const handleCreateOrderShortcut = (customer: AdminCustomerRow) => {
    localStorage.setItem(PREFILL_KEY, JSON.stringify(customer));
    navigate("/admin?tab=new-order");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome, telefone, CNPJ, email ou rua..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
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
              ) : filtered.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <span className="font-medium">{c.name}</span>
                    {(() => {
                      const addr = getPrimaryAddress(c);
                      return addr ? (
                        <p className="text-xs text-muted-foreground mt-0.5">{addr.street}, {addr.number} — {addr.neighborhood}</p>
                      ) : null;
                    })()}
                  </TableCell>
                  <TableCell className="text-sm">{c.phone ?? "—"}</TableCell>
                  <TableCell className="hidden md:table-cell"><Badge variant="outline">{c.type}</Badge></TableCell>
                  <TableCell className="hidden md:table-cell text-xs">{c.cnpj ?? "—"}</TableCell>
                  <TableCell className="hidden md:table-cell text-xs">{c.email ?? "—"}</TableCell>
                  <TableCell className="hidden md:table-cell text-xs">{format(new Date(c.created_at), "dd/MM/yy")}</TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openDetail(c)} title="Ver detalhes">
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(c)} title="Editar">
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => setDeleteTarget(c)} title="Excluir">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
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
              {(() => {
                const addr = getPrimaryAddress(selected);
                if (!addr) return null;
                return (
                  <div className="border-t pt-3">
                    <h4 className="font-semibold mb-1">Endereço principal</h4>
                    <p>{addr.street}, {addr.number} - {addr.neighborhood}</p>
                    <p>{addr.city}/{addr.state}{addr.zip ? ` - CEP: ${addr.zip}` : ""}</p>
                    {addr.complement && <p>Complemento: {addr.complement}</p>}
                    {addr.reference && <p>Referência: {addr.reference}</p>}
                  </div>
                );
              })()}
              <div className="flex gap-2 flex-wrap">
                <Button size="sm" variant="outline" onClick={() => openEdit(selected)}>Editar cliente</Button>
                <Button size="sm" onClick={() => handleCreateOrderShortcut(selected)}>
                  <ClipboardList className="h-4 w-4 mr-1" /> Criar pedido para este cliente
                </Button>
              </div>
              <div className="border-t pt-3">
                <h4 className="font-semibold mb-2">Histórico de pedidos</h4>
                {ordersLoading ? (
                  <p className="text-muted-foreground">Carregando...</p>
                ) : orders.length === 0 ? (
                  <p className="text-muted-foreground">Nenhum pedido.</p>
                ) : (
                  <div className="space-y-2">
                    {orders.map((o) => (
                      <div key={o.id} className="border rounded p-2">
                        <div className="flex justify-between text-xs">
                          <span className="font-mono">{o.id.slice(0, 8)}</span>
                          <Badge variant="outline" className="text-xs">{o.status}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{o.order_items.map((i) => `${i.products?.name} x${i.qty}`).join(", ")}</p>
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

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir cliente</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o cliente <strong>{deleteTarget?.name}</strong>?
              <br />Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create/Edit dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Editar cliente" : "Novo cliente"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Nome</label>
              <Input value={formName} onChange={(e) => setFormName(e.target.value)} maxLength={100} />
            </div>
            <div>
              <label className="text-sm font-medium">Telefone</label>
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
                <label className="text-sm font-medium">CNPJ *</label>
                <Input value={formCnpj} onChange={(e) => setFormCnpj(maskCnpj(e.target.value))} maxLength={18} />
              </div>
            )}
            <div>
              <label className="text-sm font-medium">Email</label>
              <Input value={formEmail} onChange={(e) => setFormEmail(e.target.value)} type="email" maxLength={100} />
            </div>

            {/* Address fields */}
            <div className="border-t pt-3 mt-3">
              <p className="text-sm font-semibold mb-2">Endereço *</p>
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <label className="text-sm font-medium">Rua *</label>
                    <Input value={formStreet} onChange={(e) => { setFormStreet(e.target.value); setDuplicateWarning(null); setForceCreate(false); }} maxLength={200} />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Nº *</label>
                    <Input value={formNumber} onChange={(e) => { setFormNumber(e.target.value); setDuplicateWarning(null); setForceCreate(false); }} maxLength={20} />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">Bairro *</label>
                  <Input value={formNeighborhood} onChange={(e) => setFormNeighborhood(e.target.value)} maxLength={100} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-sm font-medium">Cidade</label>
                    <Input value={formCity} onChange={(e) => setFormCity(e.target.value)} maxLength={100} />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Estado</label>
                    <Input value={formState} onChange={(e) => setFormState(e.target.value)} maxLength={2} />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">CEP</label>
                  <Input value={formZip} onChange={(e) => setFormZip(maskCep(e.target.value))} maxLength={9} placeholder="00000-000" />
                </div>
                <div>
                  <label className="text-sm font-medium">Complemento</label>
                  <Input value={formComplement} onChange={(e) => setFormComplement(e.target.value)} maxLength={200} />
                </div>
                <div>
                  <label className="text-sm font-medium">Ponto de referência</label>
                  <Input value={formReference} onChange={(e) => setFormReference(e.target.value)} maxLength={200} />
                </div>
              </div>
            </div>

            {/* Duplicate address warning */}
            {duplicateWarning && (
              <div className="rounded-md border border-red-300 bg-red-50 p-3 space-y-2">
                <p className="text-sm text-red-700 font-medium">
                  Já existe um cliente cadastrado neste endereço:
                </p>
                <p className="text-sm text-red-600">
                  {duplicateWarning.name} — {duplicateWarning.street}, {duplicateWarning.number}
                </p>
                <p className="text-xs text-red-500">Verifique se é o mesmo cliente antes de continuar.</p>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={handleViewDuplicate}>Ver cliente existente</Button>
                  <Button size="sm" variant="destructive" onClick={handleForceCreate}>Cadastrar mesmo assim</Button>
                </div>
              </div>
            )}

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
