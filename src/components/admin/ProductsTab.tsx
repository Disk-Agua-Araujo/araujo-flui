import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Plus, Pencil, Trash2, Save, Package, AlertTriangle, Upload, X, ImageIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { adminApi, type AdminProductRow, type AdminTierRow, type AdminCategoryRow } from "@/services/admin-api";
import { supabase } from "@/integrations/supabase/client";

type Product = AdminProductRow;
type Tier = AdminTierRow;

const QUICK_ORDER_CATEGORY_SLUGS = ["galoes-10l", "galoes-20l"];

async function convertToWebP(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Canvas not supported"));
      ctx.drawImage(img, 0, 0);
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Conversion failed"))),
        "image/webp",
        0.85
      );
    };
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = URL.createObjectURL(file);
  });
}

export function ProductsTab() {
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [categories, setCategories] = useState<AdminCategoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editProduct, setEditProduct] = useState<Partial<Product> | null>(null);
  const [editTiers, setEditTiers] = useState<Partial<Tier>[]>([]);
  const [saving, setSaving] = useState(false);
  const [stockDialog, setStockDialog] = useState<Product | null>(null);
  const [stockAdjust, setStockAdjust] = useState({ qty: 0, type: "in" as "in" | "out" | "adjust", reason: "" });

  // Image upload state
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [removeImage, setRemoveImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const data = await adminApi.listProducts();
      setProducts(data.products ?? []);
      setTiers(data.tiers ?? []);
      setCategories(data.categories ?? []);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao carregar produtos";
      toast({ title: "Erro", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const getCategoryName = (id: string | null) => {
    if (!id) return "—";
    return categories.find((c) => c.id === id)?.name ?? "—";
  };

  const isQuickOrderCategory = (categoryId: string | null) => {
    if (!categoryId) return false;
    const cat = categories.find((c) => c.id === categoryId);
    return cat ? QUICK_ORDER_CATEGORY_SLUGS.includes(cat.slug) : false;
  };

  const openEditor = (product?: Product) => {
    setImageFile(null);
    setImagePreview(null);
    setRemoveImage(false);
    setUploadProgress(0);

    if (product) {
      setEditProduct({ ...product });
      setEditTiers(tiers.filter((t) => t.product_id === product.id).map((t) => ({ ...t })));
      if (product.image_url) setImagePreview(product.image_url);
      return;
    }

    setEditProduct({
      name: "",
      description: "",
      type: "varejo",
      icon: "droplets",
      active: true,
      price_text: "Consulte no WhatsApp",
      track_stock: false,
      stock_qty: 0,
      min_stock_qty: 0,
      category_id: null,
      show_in_quick_order: false,
      image_url: null,
    });
    setEditTiers([]);
  };

  const handleFileSelect = (file: File) => {
    const validTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!validTypes.includes(file.type)) {
      toast({ title: "Formato inválido", description: "Use JPEG, PNG ou WebP.", variant: "destructive" });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "Arquivo muito grande", description: "Máximo 2MB.", variant: "destructive" });
      return;
    }
    setImageFile(file);
    setRemoveImage(false);
    const url = URL.createObjectURL(file);
    setImagePreview(url);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }, []);

  const uploadImage = async (productId: string): Promise<string | null> => {
    if (removeImage) {
      // Delete existing image
      await supabase.storage.from("product-images").remove([`${productId}/cover.webp`]);
      return null;
    }
    if (!imageFile) return editProduct?.image_url ?? null;

    setUploading(true);
    setUploadProgress(20);

    try {
      const webpBlob = await convertToWebP(imageFile);
      setUploadProgress(50);

      const path = `${productId}/cover.webp`;
      const { error } = await supabase.storage
        .from("product-images")
        .upload(path, webpBlob, { contentType: "image/webp", upsert: true });

      if (error) throw error;
      setUploadProgress(90);

      const { data: urlData } = supabase.storage.from("product-images").getPublicUrl(path);
      setUploadProgress(100);
      return `${urlData.publicUrl}?t=${Date.now()}`;
    } catch (err) {
      console.error("upload error", err);
      toast({ title: "Erro no upload", description: "Não foi possível enviar a imagem.", variant: "destructive" });
      return editProduct?.image_url ?? null;
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!editProduct?.name?.trim()) {
      toast({ title: "Nome é obrigatório", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      // First save product to get ID
      await adminApi.saveProduct({
        product: {
          id: editProduct.id,
          name: editProduct.name.trim(),
          description: editProduct.description?.trim() || null,
          type: (editProduct.type || "varejo") as Product["type"],
          icon: editProduct.icon?.trim() || null,
          active: editProduct.active ?? true,
          price_text: editProduct.price_text?.trim() || null,
          track_stock: editProduct.track_stock ?? false,
          min_stock_qty: editProduct.min_stock_qty ?? 0,
          stock_qty: editProduct.stock_qty ?? 0,
          category_id: editProduct.category_id || null,
          show_in_quick_order: editProduct.show_in_quick_order ?? false,
          image_url: editProduct.image_url || null,
        },
        tiers: editTiers
          .filter((t) => Number(t.min_qty) > 0)
          .map((t) => ({ min_qty: Number(t.min_qty), price_text: t.price_text || "Consulte" })),
      });

      // If we need to upload/remove image, we need the product ID
      if (imageFile || removeImage) {
        // Refetch to get the ID if it was a new product
        const refreshed = await adminApi.listProducts();
        const savedProduct = editProduct.id
          ? refreshed.products?.find((p) => p.id === editProduct.id)
          : refreshed.products?.find((p) => p.name === editProduct.name?.trim());

        if (savedProduct) {
          const imageUrl = await uploadImage(savedProduct.id);
          // Update image_url on the product
          await adminApi.saveProduct({
            product: {
              id: savedProduct.id,
              name: savedProduct.name,
              description: savedProduct.description,
              type: savedProduct.type,
              icon: savedProduct.icon,
              active: savedProduct.active,
              price_text: savedProduct.price_text,
              track_stock: savedProduct.track_stock,
              min_stock_qty: savedProduct.min_stock_qty,
              stock_qty: savedProduct.stock_qty,
              category_id: savedProduct.category_id,
              show_in_quick_order: savedProduct.show_in_quick_order,
              image_url: imageUrl,
            },
            tiers: [],
          });
        }
      }

      toast({ title: "Produto salvo!" });
      setEditProduct(null);
      fetchAll();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao salvar produto";
      toast({ title: "Erro", description: message, variant: "destructive" });
      console.error("products-save", err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir este produto?")) return;
    try {
      await adminApi.deleteProduct(id);
      toast({ title: "Produto excluído" });
      fetchAll();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao excluir produto";
      toast({ title: "Erro", description: message, variant: "destructive" });
    }
  };

  const handleStockAdjust = async () => {
    if (!stockDialog || stockAdjust.qty <= 0) return;
    setSaving(true);

    try {
      await adminApi.adjustStock({
        product_id: stockDialog.id,
        qty: stockAdjust.qty,
        type: stockAdjust.type,
        reason: stockAdjust.reason || undefined,
      });
      toast({ title: "Estoque atualizado!" });
      setStockDialog(null);
      setStockAdjust({ qty: 0, type: "in", reason: "" });
      fetchAll();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao ajustar estoque";
      toast({ title: "Erro", description: message, variant: "destructive" });
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
                <TableHead>Imagem</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Preço</TableHead>
                <TableHead>Estoque</TableHead>
                <TableHead>Ativo</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
              ) : products.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Nenhum produto.</TableCell></TableRow>
              ) : (
                products.map((p) => {
                  const lowStock = p.track_stock && p.stock_qty <= p.min_stock_qty;
                  return (
                    <TableRow key={p.id}>
                      <TableCell>
                        {p.image_url ? (
                          <img src={p.image_url} alt={p.name} className="h-8 w-8 rounded object-cover" />
                        ) : (
                          <div className="h-8 w-8 rounded bg-muted flex items-center justify-center">
                            <ImageIcon className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell className="text-sm">{getCategoryName(p.category_id)}</TableCell>
                      <TableCell><Badge variant="outline">{p.type}</Badge></TableCell>
                      <TableCell className="text-sm">{p.price_text}</TableCell>
                      <TableCell>
                        {p.track_stock ? (
                          <div className="flex items-center gap-1">
                            <span className={`font-medium ${lowStock ? "text-destructive" : ""}`}>{p.stock_qty}</span>
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

              {/* Image upload */}
              <div>
                <Label>Imagem do produto</Label>
                {imagePreview && !removeImage ? (
                  <div className="mt-2 relative inline-block">
                    <img src={imagePreview} alt="Preview" className="h-24 w-24 rounded-lg object-cover border" />
                    <div className="mt-2 flex gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>Trocar imagem</Button>
                      <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={() => { setRemoveImage(true); setImageFile(null); setImagePreview(null); }}>
                        <X className="h-3 w-3 mr-1" /> Remover
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div
                    className="mt-2 border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={handleDrop}
                  >
                    <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">Arraste ou clique para selecionar</p>
                    <p className="text-xs text-muted-foreground mt-1">JPEG, PNG ou WebP • Máx. 2MB</p>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); e.target.value = ""; }}
                />
                {uploading && <Progress value={uploadProgress} className="mt-2 h-2" />}
              </div>

              <div>
                <Label>Categoria *</Label>
                <Select value={editProduct.category_id ?? "none"} onValueChange={(v) => setEditProduct({ ...editProduct, category_id: v === "none" ? null : v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione uma categoria" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem categoria</SelectItem>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Tipo</Label>
                  <Select value={editProduct.type ?? "varejo"} onValueChange={(v) => setEditProduct({ ...editProduct, type: v as Product["type"] })}>
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

              {/* Show in Quick Order - only for Galões categories */}
              {isQuickOrderCategory(editProduct.category_id ?? null) && (
                <div className="flex items-center gap-2">
                  <Switch checked={editProduct.show_in_quick_order ?? false} onCheckedChange={(v) => setEditProduct({ ...editProduct, show_in_quick_order: v })} />
                  <Label>Exibir no Pedido Rápido</Label>
                </div>
              )}

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

              <Button onClick={handleSave} className="w-full" disabled={saving || uploading}>
                <Save className="h-4 w-4 mr-1" /> {saving ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Stock adjustment dialog */}
      <Dialog open={!!stockDialog} onOpenChange={() => setStockDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Ajustar estoque: {stockDialog?.name}</DialogTitle></DialogHeader>
          {stockDialog && (
            <div className="space-y-4">
              <p className="text-sm">Estoque atual: <strong>{stockDialog.stock_qty}</strong></p>
              <div>
                <Label>Tipo</Label>
                <Select value={stockAdjust.type} onValueChange={(v) => setStockAdjust({ ...stockAdjust, type: v as "in" | "out" | "adjust" })}>
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
