import { Droplets, CheckCircle, MessageCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trackEvent } from "@/hooks/use-analytics";
import { ScrollReveal } from "@/components/ScrollReveal";

interface WaterProduct {
  name: string;
  description: string;
  ph: string;
  extra: string;
  minerals: { name: string; value?: string }[];
  differentials: string[];
}

const waters: WaterProduct[] = [
  {
    name: "Água Mineral Fontana de Trevi",
    description: "Proveniente de fonte natural protegida, com características alcalinas para hidratação leve e agradável.",
    ph: "8,1",
    extra: "Fonte: ~27°C · Origem mineral natural",
    minerals: [
      { name: "Bicarbonato", value: "96,64" },
      { name: "Sódio", value: "35,70" },
      { name: "Cálcio", value: "8,25" },
      { name: "Magnésio", value: "0,93" },
      { name: "Potássio", value: "1,43" },
    ],
    differentials: ["Água naturalmente alcalina", "Fonte mineral protegida", "Equilíbrio de minerais essenciais"],
  },
  {
    name: "Água Mineral Cristal de Trevi",
    description: "Água mineral natural leve e equilibrada, proveniente de fonte protegida com rigorosos padrões de qualidade.",
    ph: "8,0",
    extra: "Tipo: água mineral natural",
    minerals: [{ name: "Bicarbonato" }, { name: "Cálcio" }, { name: "Magnésio" }, { name: "Potássio" }],
    differentials: ["Naturalmente alcalina", "Leve e agradável ao paladar", "Excelente para consumo diário"],
  },
  {
    name: "Água Mineral Bioleve",
    description: "Uma das mais reconhecidas do Brasil, conhecida pela leveza e baixo teor de sódio, ideal para hidratação ao longo do dia.",
    ph: "6,7",
    extra: "Fonte: ~22,8°C",
    minerals: [
      { name: "Bicarbonato", value: "87,42" },
      { name: "Cálcio", value: "13,30" },
      { name: "Magnésio", value: "8,06" },
      { name: "Sódio", value: "3,57" },
      { name: "Potássio", value: "1,40" },
    ],
    differentials: ["Baixo teor de sódio", "Água leve e equilibrada", "Excelente para consumo diário"],
  },
  {
    name: "Água Mineral Estância – Fonte São Luiz I",
    description: "Proveniente da Fonte São Luiz I, reconhecida pela pureza e composição equilibrada de minerais.",
    ph: "~neutro",
    extra: "Origem: Fonte São Luiz I",
    minerals: [{ name: "Bicarbonato" }, { name: "Cálcio" }, { name: "Magnésio" }, { name: "Potássio" }],
    differentials: ["Fonte mineral natural protegida", "Equilíbrio mineral ideal", "Rigoroso controle de produção"],
  },
];

function WaterCard({ water }: { water: WaterProduct }) {
  const waMsg = `Olá! Tenho interesse na ${water.name}. Poderia me informar o preço e disponibilidade?`;
  const waLink = `https://wa.me/5511940060056?text=${encodeURIComponent(waMsg)}`;

  return (
    <Card className="h-full border-border/60 shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300">
      <CardContent className="p-5 flex flex-col h-full gap-3">
        <div className="flex items-start gap-3 min-h-[4.5rem]">
          <div className="shrink-0 h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Droplets className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-primary leading-snug text-sm">{water.name}</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">{water.extra}</p>
          </div>
        </div>
        <div className="flex items-center">
          <span className="inline-flex items-center bg-primary text-primary-foreground text-[11px] font-bold px-2.5 py-0.5 rounded-full">
            pH {water.ph}
          </span>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed min-h-[3rem]">{water.description}</p>
        <div className="min-h-[3.5rem]">
          <p className="text-[10px] font-semibold text-foreground mb-1 uppercase tracking-wider">Principais minerais</p>
          <div className="flex flex-wrap gap-1">
            {water.minerals.map((m) => (
              <span key={m.name} className="inline-flex items-center text-[10px] font-medium bg-secondary text-secondary-foreground px-1.5 py-0.5 rounded-full">
                {m.name}
                {m.value && <span className="ml-1 text-muted-foreground">{m.value}</span>}
              </span>
            ))}
          </div>
        </div>
        <div className="flex-grow">
          <p className="text-[10px] font-semibold text-foreground mb-1 uppercase tracking-wider">Diferenciais</p>
          <ul className="space-y-0.5">
            {water.differentials.map((d) => (
              <li key={d} className="flex items-start gap-1 text-xs text-muted-foreground">
                <CheckCircle className="h-3.5 w-3.5 shrink-0 text-accent mt-0.5" />
                <span>{d}</span>
              </li>
            ))}
          </ul>
        </div>
        <Button
          className="w-full mt-auto bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-semibold shadow-sm hover:shadow-md transition-all hover:scale-[1.02]"
          size="sm"
          asChild
          onClick={() => trackEvent("whatsapp_click", { source: "our_waters", product: water.name })}
        >
          <a href={waLink} target="_blank" rel="noopener noreferrer">
            <MessageCircle className="h-4 w-4 mr-2" />
            Pedir no WhatsApp
          </a>
        </Button>
      </CardContent>
    </Card>
  );
}

export function OurWaters() {
  return (
    <section id="nossas-aguas" className="py-16 md:py-20">
      <div className="container">
        <ScrollReveal animation="fadeUp">
          <div className="text-center mb-10">
            <h2 className="text-2xl md:text-3xl lg:text-4xl font-extrabold text-foreground tracking-tight leading-tight">
              Conheça Nossas Águas
            </h2>
            <div className="mx-auto mt-3 h-1 w-16 rounded-full bg-accent" />
            <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
              Trabalhamos com as melhores marcas de água mineral do mercado. Compare e escolha a ideal para você.
            </p>
          </div>
        </ScrollReveal>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 md:gap-6 items-stretch">
          {waters.map((w, i) => (
            <ScrollReveal key={w.name} animation="fadeUp" delay={Math.min(i, 5) * 120}>
              <WaterCard water={w} />
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
