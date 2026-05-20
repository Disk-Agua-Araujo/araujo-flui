import { useEffect, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useIsMobile } from "@/hooks/use-mobile";

import { OrdersTab } from "@/components/admin/OrdersTab";
import { NewOrderTab } from "@/components/admin/NewOrderTab";
import { ProductsTab } from "@/components/admin/ProductsTab";
import { ReportsTab } from "@/components/admin/ReportsTab";
import { CustomersTab } from "@/components/admin/CustomersTab";
import { LogOut, Package, ClipboardList, PlusCircle, BarChart3, Users } from "lucide-react";
import logo from "@/assets/logo.png";
import { Seo } from "@/components/Seo";

const TAB_VALUES = ["orders", "new-order", "customers", "products", "reports"] as const;

type TabValue = (typeof TAB_VALUES)[number];

function isValidTab(value: string | null): value is TabValue {
  return !!value && TAB_VALUES.includes(value as TabValue);
}

const tabConfig = [
  { value: "orders" as const, label: "Pedidos", icon: ClipboardList },
  { value: "new-order" as const, label: "Novo", icon: PlusCircle },
  { value: "customers" as const, label: "Clientes", icon: Users },
  { value: "products" as const, label: "Produtos", icon: Package },
  { value: "reports" as const, label: "Relatórios", icon: BarChart3, ownerOnly: true },
];

export default function Admin() {
  const { username, isAdmin, isOwner, loading, signOut } = useAuth();
  const isMobile = useIsMobile();
  const [scheduledCount, setScheduledCount] = useState(0);
  
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<TabValue>("orders");

  const handleScheduledCount = useCallback((count: number) => {
    setScheduledCount(count);
  }, []);

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
      <Seo title={"Admin | Disk Água Araujo"} description={"Área administrativa."} path={"/admin"} noindex />
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

  const visibleTabs = tabConfig.filter((t) => !t.ownerOnly || isOwner);

  return (
    <div className={`min-h-screen bg-background ${isMobile ? "pb-20" : ""}`}>
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

      <main className="container py-4 sm:py-6">
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          {/* Desktop tabs */}
          {!isMobile && (
            <TabsList className="grid w-full grid-cols-5 mb-6">
              {visibleTabs.map((t) => (
                <TabsTrigger key={t.value} value={t.value} className="gap-1 relative">
                  <t.icon className="h-4 w-4" />
                  <span>{t.label}</span>
                  {t.value === "orders" && scheduledCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full h-4 min-w-[16px] flex items-center justify-center px-1">
                      {scheduledCount}
                    </span>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>
          )}

          <TabsContent value="orders"><OrdersTab onScheduledCount={handleScheduledCount} /></TabsContent>
          <TabsContent value="new-order"><NewOrderTab /></TabsContent>
          <TabsContent value="customers"><CustomersTab /></TabsContent>
          <TabsContent value="products"><ProductsTab /></TabsContent>
          {isOwner && <TabsContent value="reports"><ReportsTab /></TabsContent>}
        </Tabs>
      </main>

      {/* Mobile bottom navigation */}
      {isMobile && (
        <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t shadow-lg">
          <div className="flex justify-around items-center h-16">
            {visibleTabs.map((t) => {
              const isActive = activeTab === t.value;
              return (
                <button
                  key={t.value}
                  type="button"
                  className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors relative ${
                    isActive
                      ? "text-[hsl(var(--brand-blue))]"
                      : "text-muted-foreground"
                  }`}
                  onClick={() => handleTabChange(t.value)}
                >
                  <t.icon className="h-5 w-5" />
                  <span className="text-[10px] leading-tight font-medium">{t.label}</span>
                  {t.value === "orders" && scheduledCount > 0 && (
                    <span className="absolute top-1 right-1/4 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full h-4 min-w-[16px] flex items-center justify-center px-1">
                      {scheduledCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}
