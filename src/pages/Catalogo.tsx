import { useState, useMemo, useRef } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { MobileBottomBar } from "@/components/MobileBottomBar";
import { Button } from "@/components/ui/button";
import { MessageCircle } from "lucide-react";
import { useProducts } from "@/hooks/use-products";
import { useCategories, type DbCategory } from "@/hooks/use-categories";
import { business } from "@/config/business";
import { trackEvent } from "@/hooks/use-analytics";
import { useDebounce } from "@/hooks/use-debounce";
import { normalize } from "@/lib/normalize";
import { ScrollReveal } from "@/components/ScrollReveal";
import { ProductSearchBar } from "@/components/ProductSearchBar";
import { ProductCard } from "@/components/ProductCard";
import { Skeleton } from "@/components/ui/skeleton";

export default function Catalogo() {
  const { data: products = [], isLoading } = useProducts();
  const { data: categories = [] } = useCategories();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 250);
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const filtered = useMemo(
    () =>
      products.filter((p) => {
        if (!debouncedSearch) return true;
        const q = normalize(debouncedSearch);
        return normalize(p.name).includes(q) || normalize(p.description ?? "").includes(q);
      }),
    [products, debouncedSearch]
  );

  const grouped = useMemo(() => {
    const groups: { category: DbCategory | null; products: typeof filtered }[] = [];
    const sortedCats = [...categories].sort((a, b) => a.sort_order - b.sort_order);

    for (const cat of sortedCats) {
      const catProducts = filtered.filter((p) => p.category_id === cat.id);
      if (catProducts.length > 0) {
        groups.push({ category: cat, products: catProducts });
      }
    }

    const uncategorized = filtered.filter((p) => !p.category_id || !categories.some((c) => c.id === p.category_id));
    if (uncategorized.length > 0) {
      groups.push({ category: null, products: uncategorized });
    }

    return groups;
  }, [filtered, categories]);

  const activeTabs = grouped.map((g) => ({
    id: g.category?.slug ?? "outros",
    label: g.category?.name ?? "Outros",
  }));

  const scrollTo = (slug: string) => {
    sectionRefs.current[slug]?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 container py-8">
        <h1 className="text-3xl font-bold mb-2">Catálogo de Produtos</h1>
        <p className="text-muted-foreground mb-6">
          Conheça nossos produtos. Valores e disponibilidade sob consulta.
        </p>

        <ProductSearchBar value={search} onChange={setSearch} />

        {activeTabs.length > 1 && !debouncedSearch && (
          <div className="flex gap-2 flex-wrap mb-8">
            {activeTabs.map((tab) => (
              <Button
                key={tab.id}
                variant="outline"
                size="sm"
                onClick={() => scrollTo(tab.id)}
                className="rounded-full"
              >
                {tab.label}
              </Button>
            ))}
          </div>
        )}

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-52 rounded-lg" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">
              {debouncedSearch ? `Nenhum produto encontrado para "${debouncedSearch}".` : "Nenhum produto disponível."}
            </p>
          </div>
        ) : (
          <div className="space-y-10">
            {grouped.map((group) => {
              const slug = group.category?.slug ?? "outros";
              return (
                <div key={slug} ref={(el) => { sectionRefs.current[slug] = el; }}>
                  <ScrollReveal animation="fadeUp">
                    <h2 className="text-2xl font-bold mb-4 scroll-mt-24">
                      {group.category?.name ?? "Outros"}
                    </h2>
                  </ScrollReveal>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {group.products.map((p, i) => (
                      <ScrollReveal key={p.id} animation="scaleUp" delay={Math.min(i, 5) * 80}>
                        <ProductCard
                          product={p}
                          footer={
                            <Button
                              className="w-full bg-whatsapp hover:bg-whatsapp-dark text-white"
                              asChild
                              onClick={() => trackEvent("whatsapp_click", { source: "catalogo", product: p.id })}
                            >
                              <a href={business.waLink(`Olá! Tenho interesse no produto: ${p.name}`)} target="_blank" rel="noopener noreferrer">
                                <MessageCircle className="h-4 w-4 mr-1" /> Pedir no WhatsApp
                              </a>
                            </Button>
                          }
                        />
                      </ScrollReveal>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
      <Footer />
      <MobileBottomBar />
    </div>
  );
}
