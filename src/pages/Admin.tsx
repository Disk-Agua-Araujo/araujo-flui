import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { OrdersTab } from "@/components/admin/OrdersTab";
import { NewOrderTab } from "@/components/admin/NewOrderTab";
import { ProductsTab } from "@/components/admin/ProductsTab";
import { ReportsTab } from "@/components/admin/ReportsTab";
import { LogOut, Package, ClipboardList, PlusCircle, BarChart3 } from "lucide-react";
import logo from "@/assets/logo.png";

export default function Admin() {
  const { user, isAdmin, isOwner, loading, signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) {
      navigate("/admin/login", { replace: true });
    }
  }, [user, isAdmin, loading, navigate]);

  if (loading || !user || !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <header className="sticky top-0 z-50 border-b bg-card/95 backdrop-blur">
        <div className="container flex h-14 items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Disk Água Araujo" className="h-8" />
            <span className="text-sm font-semibold hidden sm:inline">Painel Admin</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground hidden sm:inline">{user.email}</span>
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="h-4 w-4 mr-1" /> Sair
            </Button>
          </div>
        </div>
      </header>

      <main className="container py-6">
        <Tabs defaultValue="orders">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 mb-6">
            <TabsTrigger value="orders" className="gap-1">
              <ClipboardList className="h-4 w-4" />
              <span className="hidden sm:inline">Pedidos</span>
            </TabsTrigger>
            <TabsTrigger value="new-order" className="gap-1">
              <PlusCircle className="h-4 w-4" />
              <span className="hidden sm:inline">Novo Pedido</span>
            </TabsTrigger>
            <TabsTrigger value="products" className="gap-1">
              <Package className="h-4 w-4" />
              <span className="hidden sm:inline">Produtos</span>
            </TabsTrigger>
            {isOwner && (
              <TabsTrigger value="reports" className="gap-1">
                <BarChart3 className="h-4 w-4" />
                <span className="hidden sm:inline">Relatórios</span>
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="orders"><OrdersTab /></TabsContent>
          <TabsContent value="new-order"><NewOrderTab /></TabsContent>
          <TabsContent value="products"><ProductsTab /></TabsContent>
          {isOwner && <TabsContent value="reports"><ReportsTab /></TabsContent>}
        </Tabs>
      </main>
    </div>
  );
}
