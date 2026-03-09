import { useState } from "react";
import { Menu, X, Phone, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { business } from "@/config/business";
import { trackEvent } from "@/hooks/use-analytics";
import { Link, useLocation } from "react-router-dom";
import { useNavigateToSection } from "@/lib/navigation";
import logo from "@/assets/logo.png";

type NavItem = { label: string; href?: string; sectionId?: string; isRoute?: boolean };

const navLinks: NavItem[] = [
  { label: "Início", sectionId: "inicio" },
  { label: "Loja", href: "/loja", isRoute: true },
  { label: "Catálogo", href: "/catalogo", isRoute: true },
  { label: "Empresas", href: "/pedido-empresa", isRoute: true },
  { label: "Contato", sectionId: "contato" },
];

export function Header() {
  const [open, setOpen] = useState(false);
  const navigateToSection = useNavigateToSection();
  const location = useLocation();

  const handleLogoClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (location.pathname === "/") {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const renderNavItem = (l: NavItem, mobile = false) => {
    const className = mobile
      ? "block px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
      : "text-sm font-semibold text-muted-foreground hover:text-primary transition-colors";

    if (l.isRoute && l.href) {
      return (
        <Link
          key={l.label}
          to={l.href}
          className={className}
          onClick={() => mobile && setOpen(false)}
        >
          {l.label}
        </Link>
      );
    }

    return (
      <button
        key={l.label}
        className={`${className} ${mobile ? "" : "cursor-pointer"}`}
        onClick={() => {
          if (l.sectionId) navigateToSection(l.sectionId);
          if (mobile) setOpen(false);
        }}
      >
        {l.label}
      </button>
    );
  };

  return (
    <header className="sticky top-0 z-50 bg-white shadow-md border-b border-primary/20 backdrop-blur supports-[backdrop-filter]:bg-white/95">
      <div className="container flex h-16 md:h-[72px] items-center justify-between">
        <Link to="/" className="flex items-center gap-2" onClick={handleLogoClick}>
          <img
            src={logo}
            alt="Disk Água Araujo"
            className="h-10 md:h-14 w-auto object-contain"
          />
        </Link>

        <nav className="hidden md:flex items-center gap-6">
          {navLinks.map((l) => renderNavItem(l))}
        </nav>

        <div className="hidden md:flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="border-primary text-primary hover:bg-primary hover:text-primary-foreground font-semibold"
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
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-sm hover:shadow-md hover:scale-[1.02] transition-all"
            asChild
            onClick={() => trackEvent("whatsapp_click", { source: "header" })}
          >
            <a href={business.waLink(business.waDefaultMessage)} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="h-4 w-4 mr-1" />
              WhatsApp
            </a>
          </Button>
        </div>

        <button
          className="md:hidden p-2 rounded-md hover:bg-muted"
          onClick={() => setOpen(!open)}
          aria-label="Menu"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <nav className="md:hidden border-t bg-white pb-4">
          {navLinks.map((l) => renderNavItem(l, true))}
          <div className="flex gap-2 px-4 pt-2">
            <Button variant="outline" size="sm" className="flex-1 border-primary text-primary font-semibold" asChild onClick={() => trackEvent("call_click")}>
              <a href={business.telLink}>
                <Phone className="h-4 w-4 mr-1" /> Ligar
              </a>
            </Button>
            <Button
              size="sm"
              className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
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
