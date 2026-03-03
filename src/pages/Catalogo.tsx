import { useState } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { MobileBottomBar } from "@/components/MobileBottomBar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, Search, Droplets, Sparkles, Archive, Zap } from "lucide-react";
import { useProducts } from "@/hooks/use-products";
import { business } from "@/config/business";
import { trackEvent } from "@/hooks/use-analytics";

const iconMap: Record<string, React.ReactNode> = {
  droplets: <Droplets className="h-8 w-8 text-primary" />,
  sparkles: <Sparkles className="h-8 w-8 text-primary" />,
  archive: <Archive className="h-8 w-8 text-primary" />,
  zap: <Zap className="h-8 w-8 text-primary" />,
};

export default function Catalogo() {
  const { data: products = [], isLoading } = useProducts();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"todos" | "varejo" | "atacado">("todos");

  const filtered = products.filter((p) => {
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (filter === "varejo" && p.type === "atacado") return false;
    if (filter === "atacado" && p.type === "varejo") return false;
    return true;
  });

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 container py-8">
        <h1 className="text-3xl font-bold mb-2">Catálogo de Produtos</h1>
        <p className="text-muted-foreground mb-6">
          Conheça nossos produtos. Valores e disponibilidade sob consulta.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar produto..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <div className="flex gap-2">
            {(["todos", "varejo", "atacado"] as const).map((f) => (
              <Button key={f} variant={filter === f ? "default" : "outline"} size="sm" onClick={() => setFilter(f)}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </Button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <p className="text-center text-muted-foreground py-12">Carregando produtos...</p>
        ) : filtered.length === 0 ? (
          <p className="text-center text-muted-foreground py-12">Nenhum produto encontrado.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((p) => (
              <Card key={p.id} className="flex flex-col">
                <CardHeader className="flex-row items-center gap-3">
                  {iconMap[p.icon ?? "droplets"] || <Droplets className="h-8 w-8 text-primary" />}
                  <div>
                    <CardTitle className="text-lg">{p.name}</CardTitle>
                    <Badge variant="secondary" className="mt-1 text-xs">
                      {p.type === "ambos" ? "Varejo & Atacado" : p.type === "varejo" ? "Varejo" : "Atacado"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="flex-1">
                  <p className="text-sm text-muted-foreground">{p.description}</p>
                  <p className="mt-3 font-semibold text-primary">{p.price_text}</p>
                </CardContent>
                <CardFooter>
                  <Button className="w-full bg-whatsapp hover:bg-whatsapp-dark text-white" asChild onClick={() => trackEvent("whatsapp_click", { source: "catalogo", product: p.id })}>
                    <a href={business.waLink(`Olá! Tenho interesse no produto: ${p.name}`)} target="_blank" rel="noopener noreferrer">
                      <MessageCircle className="h-4 w-4 mr-1" /> Pedir no WhatsApp
                    </a>
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </main>
      <Footer />
      <MobileBottomBar />
    </div>
  );
}
