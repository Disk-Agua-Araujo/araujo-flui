import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { CartProvider } from "@/contexts/CartContext";
import Index from "./pages/Index";
import OrderPage from "./pages/OrderPage";
import Catalogo from "./pages/Catalogo";
import PedidoEmpresa from "./pages/PedidoEmpresa";
import Atacado from "./pages/Atacado";
import Loja from "./pages/Loja";
import Privacidade from "./pages/Privacidade";
import Termos from "./pages/Termos";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <CartProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/pedido" element={<OrderPage />} />
            <Route path="/catalogo" element={<Catalogo />} />
            <Route path="/pedido-empresa" element={<PedidoEmpresa />} />
            <Route path="/atacado" element={<Atacado />} />
            <Route path="/loja" element={<Loja />} />
            <Route path="/privacidade" element={<Privacidade />} />
            <Route path="/termos" element={<Termos />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </CartProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
