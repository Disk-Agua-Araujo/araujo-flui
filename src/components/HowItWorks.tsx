import { ShoppingCart, MapPin, Package } from "lucide-react";
import { ScrollReveal } from "@/components/ScrollReveal";

const steps = [
  { icon: ShoppingCart, title: "Escolha os itens", desc: "Selecione os produtos e quantidades desejadas." },
  { icon: MapPin, title: "Informe o endereço", desc: "Preencha seus dados e local de entrega." },
  { icon: Package, title: "Receba em casa com rapidez", desc: "Entregamos na sua porta de forma ágil e prática." },
];

export function HowItWorks() {
  return (
    <section id="como-funciona" className="py-16 md:py-20 bg-[hsl(214,60%,96%)]">
      <div className="container">
        <ScrollReveal animation="fadeUp">
          <div className="text-center mb-10">
            <h2 className="text-2xl md:text-3xl lg:text-4xl font-extrabold text-foreground tracking-tight">
              Como funciona
            </h2>
            <div className="mx-auto mt-3 h-1 w-16 rounded-full bg-accent" />
          </div>
        </ScrollReveal>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-3xl mx-auto">
          {steps.map((s, i) => (
            <ScrollReveal key={i} animation="fadeUp" delay={i * 150}>
              <div className="flex flex-col items-center text-center gap-3">
                <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center shadow-md">
                  <s.icon className="h-8 w-8 text-primary" />
                </div>
                <span className="text-xs font-bold text-accent uppercase tracking-wider">Passo {i + 1}</span>
                <h3 className="font-bold text-foreground">{s.title}</h3>
                <p className="text-sm text-muted-foreground">{s.desc}</p>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
