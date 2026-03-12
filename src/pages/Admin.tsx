import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";

import { OrdersTab } from "@/components/admin/OrdersTab";
import { NewOrderTab } from "@/components/admin/NewOrderTab";
import { ProductsTab } from "@/components/admin/ProductsTab";
import { ReportsTab } from "@/components/admin/ReportsTab";
import { CustomersTab } from "@/components/admin/CustomersTab";
import { LogOut, Package, ClipboardList, PlusCircle, BarChart3, Users } from "lucide-react";
import logo from "@/assets/logo.png";

const TAB_VALUES = ["orders", "new-order", "customers", "products", "reports"] as const;

type TabValue = (typeof TAB_VALUES)[number];

function isValidTab(value: string | null): value is TabValue {
  return !!value && TAB_VALUES.includes(value as TabValue);
}

export default function Admin() {
  const { username, isAdmin, isOwner, loading, signOut } = useAuth();
  useSessionTimeout();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<TabValue>("orders");

  useEffect(() => {
    if (!loading && !isAdmin) {
      navigate("/admin/login", { replace: true });
    }
  }, [isAdmin, loading, navigate]);

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (isValidTab(tab)) {
      if (tab === "reports" && !isOwner) {
        setActiveTab("orders");
        return;
      }
      setActiveTab(tab);
      return;
    }
    setActiveTab("orders");
  }, [searchParams, isOwner]);

  if (loading || !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  const handleSignOut = () => {
    signOut();
    navigate("/admin/login", { replace: true });
  };

  const handleTabChange = (tab: string) => {
    if (!isValidTab(tab)) return;
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-card/95 backdrop-blur">
        <div className="container flex h-14 items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Disk Água Araujo" className="h-8" />
            <span className="text-sm font-semibold hidden sm:inline">Painel Admin</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground hidden sm:inline">{username}</span>
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              <LogOut className="h-4 w-4 mr-1" /> Sair
            </Button>
          </div>
        </div>
      </header>

      <main className="container py-6">
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList className="grid w-full grid-cols-3 sm:grid-cols-5 mb-6">
            <TabsTrigger value="orders" className="gap-1">
              <ClipboardList className="h-4 w-4" />
              <span className="hidden sm:inline">Pedidos</span>
            </TabsTrigger>
            <TabsTrigger value="new-order" className="gap-1">
              <PlusCircle className="h-4 w-4" />
              <span className="hidden sm:inline">Novo Pedido</span>
            </TabsTrigger>
            <TabsTrigger value="customers" className="gap-1">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Clientes</span>
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
          <TabsContent value="customers"><CustomersTab /></TabsContent>
          <TabsContent value="products"><ProductsTab /></TabsContent>
          {isOwner && <TabsContent value="reports"><ReportsTab /></TabsContent>}
        </Tabs>
      </main>
    </div>
  );
}
