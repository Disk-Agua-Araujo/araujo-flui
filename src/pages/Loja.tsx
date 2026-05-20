import { useState, useMemo, useRef } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ShoppingCart, MessageCircle, Check, Copy } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { useRetailProducts } from "@/hooks/use-products";
import { useCategories, type DbCategory } from "@/hooks/use-categories";
import { useToast } from "@/hooks/use-toast";
import { useDebounce } from "@/hooks/use-debounce";
import { useIsMobile } from "@/hooks/use-mobile";
import { normalize } from "@/lib/normalize";
import { ProductSearchBar } from "@/components/ProductSearchBar";
import { Skeleton } from "@/components/ui/skeleton";
import { StoreProductCard } from "@/components/loja/StoreProductCard";
import { CartSummary } from "@/components/loja/CartSummary";
import { CheckoutForm } from "@/components/loja/CheckoutForm";

type View = "shop" | "checkout";

export default function Loja() {
  const { items, addItem, updateQty, totalItems } = useCart();
  const { toast } = useToast();
  const { data: retailProducts = [], isLoading } = useRetailProducts();
  const { data: categories = [] } = useCategories();
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const isMobile = useIsMobile();

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 250);
  const [view, setView] = useState<View>("shop");
  const [mobileCartOpen, setMobileCartOpen] = useState(false);
  const [orderSummary, setOrderSummary] = useState<{
    pedidoId: string;
    items: { name: string; qty: number }[];
    address: string;
    waMessage: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const qtyMap = useMemo(() => {
    const m: Record<string, number> = {};
    items.forEach((i) => { m[i.product.id] = i.qty; });
    return m;
  }, [items]);

  const filtered = useMemo(() => {
    if (!debouncedSearch) return retailProducts;
    const q = normalize(debouncedSearch);
    return retailProducts.filter((p) => normalize(p.name).includes(q) || normalize(p.description ?? "").includes(q));
  }, [retailProducts, debouncedSearch]);

  const grouped = useMemo(() => {
    const groups: { category: DbCategory | null; products: typeof filtered }[] = [];
    const sortedCats = [...categories].sort((a, b) => a.sort_order - b.sort_order);
    for (const cat of sortedCats) {
      const catProducts = filtered.filter((p) => p.category_id === cat.id);
      if (catProducts.length > 0) groups.push({ category: cat, products: catProducts });
    }
    const uncategorized = filtered.filter((p) => !p.category_id || !categories.some((c) => c.id === p.category_id));
    if (uncategorized.length > 0) groups.push({ category: null, products: uncategorized });
    return groups;
  }, [filtered, categories]);

  const activeTabs = grouped.map((g) => ({
    id: g.category?.slug ?? "outros",
    label: g.category?.name ?? "Outros",
  }));

  const scrollTo = (slug: string) => {
    sectionRefs.current[slug]?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleAdd = (p: typeof filtered[number]) => {
    addItem({
      id: p.id, name: p.name, description: p.description ?? "", type: p.type,
      icon: p.icon ?? "droplets", active: p.active, priceText: p.price_text ?? "",
    });
  };

  const handleCheckout = () => {
    setMobileCartOpen(false);
    setView("checkout");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleCopy = () => {
    if (orderSummary?.waMessage) {
      navigator.clipboard.writeText(orderSummary.waMessage);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Success screen
  if (orderSummary) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-1 container py-8 max-w-lg">
          <Card>
            <CardHeader>
              <CardTitle className="text-center">
                <Badge className="bg-whatsapp text-white mb-2">Pedido registrado!</Badge>
                <br />Pedido enviado ao WhatsApp
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-muted rounded-lg p-4 space-y-2 text-sm">
                <p className="font-mono text-xs text-muted-foreground">Pedido #{orderSummary.pedidoId}</p>
                <ul className="space-y-1">
                  {orderSummary.items.map((i, idx) => (<li key={idx}>{i.qty}x {i.name}</li>))}
                </ul>
                <p className="text-muted-foreground">{orderSummary.address}</p>
              </div>
              <div className="space-y-2">
                <Button variant="outline" className="w-full" onClick={handleCopy}>
                  {copied ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
                  {copied ? "Copiado!" : "Copiar mensagem"}
                </Button>
                <Button className="w-full bg-whatsapp hover:bg-whatsapp-dark text-white" asChild>
                  <a href={`https://wa.me/5511940060056?text=${encodeURIComponent(orderSummary.waMessage)}`} target="_blank" rel="noopener noreferrer">
                    <MessageCircle className="h-4 w-4 mr-1" /> Abrir WhatsApp novamente
                  </a>
                </Button>
              </div>
              <Button className="w-full" variant="ghost" onClick={() => { setOrderSummary(null); setView("shop"); }}>
                Fazer outro pedido
              </Button>
            </CardContent>
          </Card>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />

      {/* Sticky cart bar (top, when items exist & not on checkout) */}
      {totalItems > 0 && view === "shop" && (
        <div className="sticky top-0 z-30 bg-primary text-primary-foreground shadow-md">
          <div className="container py-2.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <ShoppingCart className="h-4 w-4" />
              <span>{totalItems} {totalItems === 1 ? "item" : "itens"} no carrinho</span>
            </div>
            <Button
              size="sm"
              variant="secondary"
              className="bg-white text-primary hover:bg-white/90 font-semibold"
              onClick={() => isMobile ? setMobileCartOpen(true) : handleCheckout()}
            >
              {isMobile ? "Ver carrinho" : "Finalizar pedido →"}
            </Button>
          </div>
        </div>
      )}

      <main className="flex-1 container py-6 md:py-8">
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold">Loja</h1>
          <p className="text-muted-foreground text-sm md:text-base">Adicione os produtos e finalize seu pedido</p>
        </div>

        {view === "checkout" ? (
          <div className="max-w-2xl mx-auto">
            <Card>
              <CardHeader><CardTitle>Finalizar pedido</CardTitle></CardHeader>
              <CardContent>
                <CheckoutForm
                  onBack={() => setView("shop")}
                  onSuccess={(s) => setOrderSummary(s)}
                />
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="lg:grid lg:grid-cols-[1fr_320px] lg:gap-6">
            {/* Products column */}
            <div>
              <ProductSearchBar value={search} onChange={setSearch} />
              {activeTabs.length > 1 && !debouncedSearch && (
                <div className="flex gap-2 flex-wrap mb-6 overflow-x-auto pb-1">
                  {activeTabs.map((tab) => (
                    <Button key={tab.id} variant="outline" size="sm" onClick={() => scrollTo(tab.id)} className="rounded-full whitespace-nowrap">
                      {tab.label}
                    </Button>
                  ))}
                </div>
              )}

              {isLoading ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
                  {Array.from({ length: 6 }).map((_, i) => (<Skeleton key={i} className="h-64 rounded-lg" />))}
                </div>
              ) : filtered.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">
                    {debouncedSearch ? `Nenhum produto encontrado para "${debouncedSearch}".` : "Nenhum produto disponível."}
                  </p>
                </div>
              ) : (
                <div className="space-y-8">
                  {grouped.map((group) => {
                    const slug = group.category?.slug ?? "outros";
                    return (
                      <div key={slug} ref={(el) => { sectionRefs.current[slug] = el; }}>
                        <h2 className="text-lg md:text-xl font-bold mb-3 scroll-mt-24">
                          {group.category?.name ?? "Outros"}
                        </h2>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
                          {group.products.map((p) => {
                            const qty = qtyMap[p.id] ?? 0;
                            return (
                              <StoreProductCard
                                key={p.id}
                                product={p}
                                qty={qty}
                                onAdd={() => { handleAdd(p); toast({ title: `${p.name} adicionado` }); }}
                                onIncrease={() => updateQty(p.id, qty + 1)}
                                onDecrease={() => updateQty(p.id, qty - 1)}
                              />
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Desktop sidebar cart */}
            <aside className="hidden lg:block">
              <div className="sticky top-20">
                <Card className="overflow-hidden">
                  <div className="max-h-[calc(100vh-7rem)] flex flex-col">
                    <CartSummary onCheckout={handleCheckout} />
                  </div>
                </Card>
              </div>
            </aside>
          </div>
        )}
      </main>

      {/* Mobile cart drawer */}
      <Sheet open={mobileCartOpen} onOpenChange={setMobileCartOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
          <SheetHeader className="px-4 py-3 border-b shrink-0">
            <SheetTitle>Carrinho</SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-hidden">
            <CartSummary onCheckout={handleCheckout} />
          </div>
        </SheetContent>
      </Sheet>

      {/* Mobile floating cart button */}
      {totalItems > 0 && view === "shop" && (
        <button
          type="button"
          onClick={() => setMobileCartOpen(true)}
          className="lg:hidden fixed bottom-4 right-4 z-40 bg-primary text-primary-foreground h-14 w-14 rounded-full shadow-lg flex items-center justify-center"
          aria-label="Abrir carrinho"
        >
          <ShoppingCart className="h-6 w-6" />
          <span className="absolute -top-1 -right-1 bg-accent text-accent-foreground text-xs font-bold h-5 min-w-5 px-1 rounded-full flex items-center justify-center">
            {totalItems}
          </span>
        </button>
      )}

      <Footer />
    </div>
  );
}
