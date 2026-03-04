import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Search, Eye, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

type CustomerRow = {
  id: string; name: string; phone: string | null; cnpj: string | null; type: string; created_at: string;
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

  const fetchCustomers = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("customers").select("*").order("created_at", { ascending: false }).limit(500);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else setCustomers(data ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchCustomers(); }, []);

  const filtered = useMemo(() => {
    if (!search) return customers;
    const s = search.toLowerCase();
    return customers.filter(c => c.name.toLowerCase().includes(s) || c.phone?.includes(s) || c.cnpj?.includes(s));
  }, [customers, search]);

  const openDetail = async (c: CustomerRow) => {
    setSelected(c);
    setOrdersLoading(true);
    const { data } = await supabase.from("orders").select("id, status, created_at, channel, order_items(qty, products(name))").eq("customer_id", c.id).order("created_at", { ascending: false }).limit(50);
    setOrders((data as unknown as OrderRow[]) ?? []);
    setOrdersLoading(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome, telefone ou CNPJ..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Badge variant="secondary"><Users className="h-3 w-3 mr-1" />{filtered.length}</Badge>
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
                <TableHead className="hidden md:table-cell">Cadastro</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum cliente encontrado.</TableCell></TableRow>
              ) : filtered.map(c => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="text-sm">{c.phone ?? "—"}</TableCell>
                  <TableCell className="hidden md:table-cell"><Badge variant="outline">{c.type}</Badge></TableCell>
                  <TableCell className="hidden md:table-cell text-xs">{c.cnpj ?? "—"}</TableCell>
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

      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{selected?.name}</DialogTitle></DialogHeader>
          {selected && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <p><strong>Telefone:</strong> {selected.phone ?? "—"}</p>
                <p><strong>Tipo:</strong> {selected.type}</p>
                {selected.cnpj && <p><strong>CNPJ:</strong> {selected.cnpj}</p>}
                <p><strong>Cadastro:</strong> {format(new Date(selected.created_at), "dd/MM/yyyy HH:mm")}</p>
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
    </div>
  );
}
