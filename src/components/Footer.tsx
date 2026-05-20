import { MessageCircle, Instagram } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { business } from "@/config/business";
import { trackEvent } from "@/hooks/use-analytics";
import logo from "@/assets/logo.png";

const quickLinks = [
  { label: "Início", href: "/#inicio" },
  { label: "Loja", to: "/loja" },
  { label: "Catálogo", to: "/catalogo" },
  { label: "Empresas", to: "/pedido-empresa" },
  { label: "Fazer pedido", to: "/pedido" },
];

export function Footer() {
  const year = new Date().getFullYear();
  const location = useLocation();

  const handleLogoClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (location.pathname === "/") {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  return (
    <footer className="bg-foreground text-background py-10 pb-24 md:pb-10">
      <div className="container">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <Link to="/" onClick={handleLogoClick} className="inline-flex items-center gap-3 mb-3">
              <img
                src={logo}
                alt="Disk Água Araujo"
                className="h-10 w-auto object-contain brightness-0 invert"
              />
            </Link>
            <p className="text-sm text-background/70">
              Entrega de água mineral de qualidade em Santo André e região.
            </p>
            <div className="flex gap-3 mt-4">
              <a
                href="https://www.instagram.com/diskagua.araujo"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram"
                className="text-background/70 hover:text-accent transition-colors"
              >
                <Instagram className="h-5 w-5" />
              </a>
            </div>
          </div>

          <div>
            <h4 className="font-semibold mb-3 text-sm uppercase tracking-wider">Links rápidos</h4>
            <ul className="space-y-2">
              {quickLinks.map((l) => (
                <li key={l.label}>
                  {l.to ? (
                    <Link to={l.to} className="text-sm text-background/70 hover:text-background transition-colors">{l.label}</Link>
                  ) : (
                    <a href={l.href} className="text-sm text-background/70 hover:text-background transition-colors">{l.label}</a>
                  )}
                </li>
              ))}
              <li><Link to="/privacidade" className="text-sm text-background/70 hover:text-background transition-colors">Privacidade</Link></li>
              <li><Link to="/termos" className="text-sm text-background/70 hover:text-background transition-colors">Termos de uso</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-3 text-sm uppercase tracking-wider">Contato</h4>
            <p className="text-sm text-background/70 mb-1">{business.address.full}</p>
            <a
              href={business.telLink}
              className="text-sm text-background/70 hover:text-background transition-colors block"
              onClick={() => trackEvent("call_click")}
            >
              📞 {business.phone}
            </a>
            <a
              href={business.waLink(business.waDefaultMessage)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-background/70 hover:text-background transition-colors block mt-1"
              onClick={() => trackEvent("whatsapp_click", { source: "footer" })}
            >
              💬 {business.waPhone}
            </a>
            <div className="mt-3">
              <a
                href={business.waLink(business.waDefaultMessage)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm font-medium bg-whatsapp text-white px-3 py-1.5 rounded-full hover:bg-whatsapp-dark transition-colors"
                onClick={() => trackEvent("whatsapp_click", { source: "footer" })}
              >
                <MessageCircle className="h-4 w-4" /> WhatsApp
              </a>
            </div>
          </div>
        </div>

        <div className="border-t border-background/20 mt-8 pt-6 text-center text-xs text-background/80 space-y-1">
          <p>© {year} {business.name} — Todos os direitos reservados.</p>
          <p>Criado por{" "}
            <a
              href="https://www.nextassessoria.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-background/80 transition-colors underline cursor-pointer"
            >
              Next Assessoria
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
