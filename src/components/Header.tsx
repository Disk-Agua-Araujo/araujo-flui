import { useState } from "react";
import { Menu, X, Phone, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { business } from "@/config/business";
import { trackEvent } from "@/hooks/use-analytics";
import { Link } from "react-router-dom";
import logo from "@/assets/logo.png";

const navLinks = [
  { label: "Início", href: "#inicio" },
  { label: "Produtos", href: "#produtos" },
  { label: "Como funciona", href: "#como-funciona" },
  { label: "Avaliações", href: "#avaliacoes" },
  { label: "Contato", href: "#contato" },
];

export function Header() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <div className="container flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <img
            src={logo}
            alt="Disk Água Araujo"
            className="h-9 md:h-11 w-auto object-contain"
          />
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-6">
          {navLinks.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            asChild
            onClick={() => trackEvent("call_click")}
          >
            <a href={business.telLink}>
              <Phone className="h-4 w-4 mr-1" />
              Ligar
            </a>
          </Button>
          <Button
            size="sm"
            className="bg-whatsapp hover:bg-whatsapp-dark text-white"
            asChild
            onClick={() => trackEvent("whatsapp_click", { source: "header" })}
          >
            <a href={business.waLink(business.waDefaultMessage)} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="h-4 w-4 mr-1" />
              WhatsApp
            </a>
          </Button>
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden p-2 rounded-md hover:bg-muted"
          onClick={() => setOpen(!open)}
          aria-label="Menu"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <nav className="md:hidden border-t bg-card pb-4">
          {navLinks.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="block px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              onClick={() => setOpen(false)}
            >
              {l.label}
            </a>
          ))}
          <div className="flex gap-2 px-4 pt-2">
            <Button variant="outline" size="sm" className="flex-1" asChild onClick={() => trackEvent("call_click")}>
              <a href={business.telLink}>
                <Phone className="h-4 w-4 mr-1" /> Ligar
              </a>
            </Button>
            <Button
              size="sm"
              className="flex-1 bg-whatsapp hover:bg-whatsapp-dark text-white"
              asChild
              onClick={() => trackEvent("whatsapp_click", { source: "header_mobile" })}
            >
              <a href={business.waLink(business.waDefaultMessage)} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="h-4 w-4 mr-1" /> WhatsApp
              </a>
            </Button>
          </div>
        </nav>
      )}
    </header>
  );
}
