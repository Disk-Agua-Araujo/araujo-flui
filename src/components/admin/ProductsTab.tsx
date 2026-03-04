import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Save, Package, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import type { Tables } from "@/integrations/supabase/types";

type Product = Tables<"products"> & { stock_qty?: number; min_stock_qty?: number; track_stock?: boolean };
type Tier = Tables<"wholesale_price_tiers">;

export function ProductsTab() {
  const { toast } = useToast();
  const { username } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [loading, setLoading] = useState(true);
  const [editProduct, setEditProduct] = useState<Partial<Product> | null>(null);
  const [editTiers, setEditTiers] = useState<Partial<Tier>[]>([]);
  const [saving, setSaving] = useState(false);
  const [stockDialog, setStockDialog] = useState<Product | null>(null);
  const [stockAdjust, setStockAdjust] = useState({ qty: 0, type: "in" as "in" | "out" | "adjust", reason: "" });

  const fetchAll = async () => {
    setLoading(true);
    const [{ data: prods }, { data: ts }] = await Promise.all([
      supabase.from("products").select("*").order("created_at"),
      supabase.from("wholesale_price_tiers").select("*").order("min_qty"),
    ]);
    setProducts((prods as Product[]) ?? []);
    setTiers(ts ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const openEditor = (product?: Product) => {
    if (product) {
      setEditProduct({ ...product });
      setEditTiers(tiers.filter((t) => t.product_id === product.id).map((t) => ({ ...t })));
    } else {
      setEditProduct({ name: "", description: "", type: "varejo", icon: "droplets", active: true, price_text: "Consulte no WhatsApp", track_stock: false, stock_qty: 0, min_stock_qty: 0 });
      setEditTiers([]);
    }
  };

  const handleSave = async () => {
    if (!editProduct?.name) {
      toast({ title: "Nome é obrigatório", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      let productId = editProduct.id;
      const productData = {
        name: editProduct.name,
        description: editProduct.description,
        type: editProduct.type as any,
        icon: editProduct.icon,
        active: editProduct.active,
        price_text: editProduct.price_text,
        track_stock: editProduct.track_stock ?? false,
        min_stock_qty: editProduct.min_stock_qty ?? 0,
      };

      if (productId) {
        const { error } = await supabase.from("products").update(productData).eq("id", productId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("products").insert({ ...productData, stock_qty: editProduct.stock_qty ?? 0 } as any).select().single();
        if (error) throw error;
        productId = data.id;
      }

      // Manage tiers
      if (editProduct.type === "atacado" || editProduct.type === "ambos") {
        await supabase.from("wholesale_price_tiers").delete().eq("product_id", productId!);
        const validTiers = editTiers.filter((t) => t.min_qty && t.min_qty > 0);
        if (validTiers.length > 0) {
          const { error } = await supabase.from("wholesale_price_tiers").insert(
            validTiers.map((t) => ({ product_id: productId!, min_qty: t.min_qty!, price_text: t.price_text || "Consulte" }))
          );
          if (error) throw error;
        }
      }

      toast({ title: "Produto salvo!" });
      setEditProduct(null);
      fetchAll();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir este produto?")) return;
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else { toast({ title: "Produto excluído" }); fetchAll(); }
  };

  const handleStockAdjust = async () => {
    if (!stockDialog || stockAdjust.qty <= 0) return;
    setSaving(true);
    try {
      const { error } = await (supabase.rpc as any)("adjust_stock", {
        p_product_id: stockDialog.id,
        p_qty: stockAdjust.qty,
        p_type: stockAdjust.type,
        p_reason: stockAdjust.reason || null,
        p_created_by: username,
      });
      if (error) throw error;
      toast({ title: "Estoque atualizado!" });
      setStockDialog(null);
      setStockAdjust({ qty: 0, type: "in", reason: "" });
      fetchAll();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold">Produtos</h2>
        <Button onClick={() => openEditor()}><Plus className="h-4 w-4 mr-1" /> Novo produto</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Preço</TableHead>
                <TableHead>Estoque</TableHead>
                <TableHead>Ativo</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
              ) : products.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum produto.</TableCell></TableRow>
              ) : (
                products.map((p) => {
                  const lowStock = p.track_stock && (p.stock_qty ?? 0) <= (p.min_stock_qty ?? 0);
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell><Badge variant="outline">{p.type}</Badge></TableCell>
                      <TableCell className="text-sm">{p.price_text}</TableCell>
                      <TableCell>
                        {p.track_stock ? (
                          <div className="flex items-center gap-1">
                            <span className={`font-medium ${lowStock ? "text-destructive" : ""}`}>{p.stock_qty ?? 0}</span>
                            {lowStock && <AlertTriangle className="h-3.5 w-3.5 text-destructive" />}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>{p.active ? <Badge className="bg-green-100 text-green-800">Sim</Badge> : <Badge variant="secondary">Não</Badge>}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end">
                          {p.track_stock && (
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setStockDialog(p); setStockAdjust({ qty: 0, type: "in", reason: "" }); }} title="Ajustar estoque">
                              <Package className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditor(p)}><Pencil className="h-3.5 w-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(p.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Product editor dialog */}
      <Dialog open={!!editProduct} onOpenChange={() => setEditProduct(null)}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editProduct?.id ? "Editar produto" : "Novo produto"}</DialogTitle></DialogHeader>
          {editProduct && (
            <div className="space-y-4">
              <div><Label>Nome *</Label><Input value={editProduct.name ?? ""} onChange={(e) => setEditProduct({ ...editProduct, name: e.target.value })} /></div>
              <div><Label>Descrição</Label><Textarea value={editProduct.description ?? ""} onChange={(e) => setEditProduct({ ...editProduct, description: e.target.value })} rows={2} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Tipo</Label>
                  <Select value={editProduct.type ?? "varejo"} onValueChange={(v) => setEditProduct({ ...editProduct, type: v as any })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="varejo">Varejo</SelectItem>
                      <SelectItem value="atacado">Atacado</SelectItem>
                      <SelectItem value="ambos">Ambos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Ícone</Label><Input value={editProduct.icon ?? ""} onChange={(e) => setEditProduct({ ...editProduct, icon: e.target.value })} placeholder="droplets" /></div>
              </div>
              <div><Label>Preço (texto)</Label><Input value={editProduct.price_text ?? ""} onChange={(e) => setEditProduct({ ...editProduct, price_text: e.target.value })} /></div>
              <div className="flex items-center gap-2">
                <Switch checked={editProduct.active ?? true} onCheckedChange={(v) => setEditProduct({ ...editProduct, active: v })} />
                <Label>Ativo</Label>
              </div>

              {/* Stock settings */}
              <div className="border-t pt-4">
                <div className="flex items-center gap-2 mb-3">
                  <Switch checked={editProduct.track_stock ?? false} onCheckedChange={(v) => setEditProduct({ ...editProduct, track_stock: v })} />
                  <Label>Controlar estoque</Label>
                </div>
                {editProduct.track_stock && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Estoque atual</Label>
                      <Input type="number" value={editProduct.stock_qty ?? 0} onChange={(e) => setEditProduct({ ...editProduct, stock_qty: parseInt(e.target.value) || 0 })} disabled={!!editProduct.id} />
                      {editProduct.id && <p className="text-xs text-muted-foreground mt-1">Use "Ajustar estoque" para alterar</p>}
                    </div>
                    <div>
                      <Label>Estoque mínimo</Label>
                      <Input type="number" value={editProduct.min_stock_qty ?? 0} onChange={(e) => setEditProduct({ ...editProduct, min_stock_qty: parseInt(e.target.value) || 0 })} />
                    </div>
                  </div>
                )}
              </div>

              {/* Wholesale tiers */}
              {(editProduct.type === "atacado" || editProduct.type === "ambos") && (
                <div className="border-t pt-4">
                  <div className="flex justify-between items-center mb-2">
                    <Label className="text-base font-semibold">Faixas de preço (atacado)</Label>
                    <Button type="button" variant="outline" size="sm" onClick={() => setEditTiers([...editTiers, { min_qty: 0, price_text: "Consulte" }])}>
                      <Plus className="h-3 w-3 mr-1" /> Faixa
                    </Button>
                  </div>
                  {editTiers.map((tier, i) => (
                    <div key={i} className="grid grid-cols-5 gap-2 mb-2">
                      <div className="col-span-2">
                        <Input type="number" placeholder="Qtd mín" value={tier.min_qty ?? ""} onChange={(e) => {
                          const updated = [...editTiers];
                          updated[i] = { ...updated[i], min_qty: parseInt(e.target.value) || 0 };
                          setEditTiers(updated);
                        }} />
                      </div>
                      <div className="col-span-2">
                        <Input placeholder="Preço" value={tier.price_text ?? ""} onChange={(e) => {
                          const updated = [...editTiers];
                          updated[i] = { ...updated[i], price_text: e.target.value };
                          setEditTiers(updated);
                        }} />
                      </div>
                      <Button type="button" variant="ghost" size="icon" className="text-destructive" onClick={() => setEditTiers(editTiers.filter((_, j) => j !== i))}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <Button onClick={handleSave} className="w-full" disabled={saving}>
                <Save className="h-4 w-4 mr-1" /> {saving ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Stock adjust dialog */}
      <Dialog open={!!stockDialog} onOpenChange={() => setStockDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Ajustar estoque: {stockDialog?.name}</DialogTitle></DialogHeader>
          {stockDialog && (
            <div className="space-y-4">
              <p className="text-sm">Estoque atual: <strong>{(stockDialog as any).stock_qty ?? 0}</strong></p>
              <div>
                <Label>Tipo</Label>
                <Select value={stockAdjust.type} onValueChange={(v) => setStockAdjust({ ...stockAdjust, type: v as any })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="in">Entrada</SelectItem>
                    <SelectItem value="out">Saída</SelectItem>
                    <SelectItem value="adjust">Ajuste (define valor)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Quantidade</Label><Input type="number" min={1} value={stockAdjust.qty || ""} onChange={(e) => setStockAdjust({ ...stockAdjust, qty: parseInt(e.target.value) || 0 })} /></div>
              <div><Label>Motivo</Label><Input value={stockAdjust.reason} onChange={(e) => setStockAdjust({ ...stockAdjust, reason: e.target.value })} placeholder="Ex: Reposição, Inventário..." /></div>
              <Button onClick={handleStockAdjust} className="w-full" disabled={saving || stockAdjust.qty <= 0}>
                <Save className="h-4 w-4 mr-1" /> {saving ? "Salvando..." : "Confirmar ajuste"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
