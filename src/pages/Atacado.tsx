import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { MobileBottomBar } from "@/components/MobileBottomBar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MessageCircle, Droplets } from "lucide-react";
import { useWholesaleProducts, useTiers } from "@/hooks/use-products";
import { business } from "@/config/business";
import { trackEvent } from "@/hooks/use-analytics";
import { Link } from "react-router-dom";

export default function Atacado() {
  const { data: wholesaleProducts = [], isLoading } = useWholesaleProducts();
  const { data: allTiers = [] } = useTiers();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 container py-8">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl font-bold mb-2">Atacado para Empresas</h1>
          <p className="text-muted-foreground mb-6">
            Preços especiais por quantidade. Valores sob consulta — entre em contato para negociar.
          </p>

          {isLoading ? (
            <p className="text-center text-muted-foreground py-12">Carregando...</p>
          ) : wholesaleProducts.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                Em breve adicionaremos produtos para atacado. Entre em contato pelo WhatsApp!
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {wholesaleProducts.map((p) => {
                const tiers = allTiers.filter((t) => t.product_id === p.id);
                return (
                  <Card key={p.id}>
                    <CardHeader>
                      <div className="flex items-center gap-3">
                        <Droplets className="h-6 w-6 text-primary" />
                        <div>
                          <CardTitle className="text-xl">{p.name}</CardTitle>
                          <Badge variant="outline" className="mt-1 border-primary/30 text-primary">Atacado</Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground mb-4">{p.description}</p>

                      {tiers.length > 0 ? (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Quantidade mínima</TableHead>
                              <TableHead className="text-right">Valor</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {tiers.map((t) => (
                              <TableRow key={t.id}>
                                <TableCell>{t.min_qty} galões</TableCell>
                                <TableCell className="text-right font-medium">{t.price_text}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      ) : (
                        <p className="text-sm text-muted-foreground italic">Valores a definir. Consulte pelo WhatsApp.</p>
                      )}

                      <div className="flex flex-col sm:flex-row gap-2 mt-4">
                        <Button asChild className="flex-1">
                          <Link to="/pedido-empresa">Pedir Atacado</Link>
                        </Button>
                        <Button variant="outline" className="flex-1 border-whatsapp text-whatsapp hover:bg-whatsapp/10" asChild onClick={() => trackEvent("whatsapp_click", { source: "atacado", product: p.id })}>
                          <a href={business.waLink(`Olá! Tenho interesse em atacado: ${p.name}. Gostaria de saber valores.`)} target="_blank" rel="noopener noreferrer">
                            <MessageCircle className="h-4 w-4 mr-1" /> Consultar valores
                          </a>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </main>
      <Footer />
      <MobileBottomBar />
    </div>
  );
}
