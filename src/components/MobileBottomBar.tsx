import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { business } from "@/config/business";
import { trackEvent } from "@/hooks/use-analytics";
import { Link } from "react-router-dom";

export function MobileBottomBar() {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden border-t bg-card/95 backdrop-blur p-2 flex gap-2">
      <Button
        className="flex-1 bg-whatsapp hover:bg-whatsapp-dark text-white font-semibold"
        asChild
        onClick={() => trackEvent("whatsapp_click", { source: "mobile_bar" })}
      >
        <a href={business.waLink(business.waDefaultMessage)} target="_blank" rel="noopener noreferrer">
          <MessageCircle className="h-4 w-4 mr-1" />
          WhatsApp
        </a>
      </Button>
      <Button className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground" asChild>
        <Link to="/pedido">Pedir agora</Link>
      </Button>
    </div>
  );
}
