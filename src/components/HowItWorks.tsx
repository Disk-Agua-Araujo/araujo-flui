import { ShoppingCart, MapPin, Package } from "lucide-react";

const steps = [
  { icon: ShoppingCart, title: "Escolha os itens", desc: "Selecione os produtos e quantidades desejadas." },
  { icon: MapPin, title: "Informe o endereço", desc: "Preencha seus dados e local de entrega." },
  { icon: Package, title: "Receba em casa com rapidez", desc: "Entregamos na sua porta de forma ágil e prática." },
];

export function HowItWorks() {
  return (
    <section id="como-funciona" className="py-12 md:py-16 bg-muted/50">
      <div className="container">
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-10">Como funciona</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-3xl mx-auto">
          {steps.map((s, i) => (
            <div key={i} className="flex flex-col items-center text-center gap-3">
              <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                <s.icon className="h-8 w-8 text-primary" />
              </div>
              <span className="text-xs font-bold text-primary uppercase tracking-wider">Passo {i + 1}</span>
              <h3 className="font-semibold">{s.title}</h3>
              <p className="text-sm text-muted-foreground">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
