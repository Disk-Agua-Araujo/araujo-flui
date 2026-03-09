import { Droplets, CheckCircle, MessageCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trackEvent } from "@/hooks/use-analytics";

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
    description:
      "Proveniente de fonte natural protegida, com características alcalinas para hidratação leve e agradável.",
    ph: "8,1",
    extra: "Fonte: ~27°C · Origem mineral natural",
    minerals: [
      { name: "Bicarbonato", value: "96,64" },
      { name: "Sódio", value: "35,70" },
      { name: "Cálcio", value: "8,25" },
      { name: "Magnésio", value: "0,93" },
      { name: "Potássio", value: "1,43" },
    ],
    differentials: [
      "Água naturalmente alcalina",
      "Fonte mineral protegida",
      "Equilíbrio de minerais essenciais",
    ],
  },
  {
    name: "Água Mineral Cristal de Trevi",
    description:
      "Água mineral natural leve e equilibrada, proveniente de fonte protegida com rigorosos padrões de qualidade.",
    ph: "8,0",
    extra: "Tipo: água mineral natural",
    minerals: [
      { name: "Bicarbonato" },
      { name: "Cálcio" },
      { name: "Magnésio" },
      { name: "Potássio" },
    ],
    differentials: [
      "Naturalmente alcalina",
      "Leve e agradável ao paladar",
      "Excelente para consumo diário",
    ],
  },
  {
    name: "Água Mineral Bioleve",
    description:
      "Uma das mais reconhecidas do Brasil, conhecida pela leveza e baixo teor de sódio, ideal para hidratação ao longo do dia.",
    ph: "6,7",
    extra: "Fonte: ~22,8°C",
    minerals: [
      { name: "Bicarbonato", value: "87,42" },
      { name: "Cálcio", value: "13,30" },
      { name: "Magnésio", value: "8,06" },
      { name: "Sódio", value: "3,57" },
      { name: "Potássio", value: "1,40" },
    ],
    differentials: [
      "Baixo teor de sódio",
      "Água leve e equilibrada",
      "Excelente para consumo diário",
    ],
  },
  {
    name: "Água Mineral Estância – Fonte São Luiz I",
    description:
      "Proveniente da Fonte São Luiz I, reconhecida pela pureza e composição equilibrada de minerais.",
    ph: "~neutro",
    extra: "Origem: Fonte São Luiz I",
    minerals: [
      { name: "Bicarbonato" },
      { name: "Cálcio" },
      { name: "Magnésio" },
      { name: "Potássio" },
    ],
    differentials: [
      "Fonte mineral natural protegida",
      "Equilíbrio mineral ideal",
      "Rigoroso controle de produção",
    ],
  },
];

function WaterCard({ water }: { water: WaterProduct }) {
  const waMsg = `Olá! Tenho interesse na ${water.name}. Poderia me informar o preço e disponibilidade?`;
  const waLink = `https://wa.me/5511940060056?text=${encodeURIComponent(waMsg)}`;

  return (
    <Card className="group relative overflow-hidden border-border/60 shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 h-full">
      <CardContent className="p-6 flex flex-col gap-4 h-full">
        {/* Icon + Name */}
        <div className="flex items-start gap-3">
          <div className="shrink-0 h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
            <Droplets className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-primary leading-snug text-base">
              {water.name}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">{water.extra}</p>
          </div>
        </div>

        {/* pH Badge */}
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-full">
            pH {water.ph}
          </span>
        </div>

        {/* Description */}
        <p className="text-sm text-muted-foreground leading-relaxed">
          {water.description}
        </p>

        {/* Minerals */}
        <div>
          <p className="text-xs font-semibold text-foreground mb-1.5 uppercase tracking-wider">
            Principais minerais
          </p>
          <div className="flex flex-wrap gap-1.5">
            {water.minerals.map((m) => (
              <span
                key={m.name}
                className="inline-flex items-center text-[11px] font-medium bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full"
              >
                {m.name}
                {m.value && (
                  <span className="ml-1 text-muted-foreground">{m.value}</span>
                )}
              </span>
            ))}
          </div>
        </div>

        {/* Differentials */}
        <div>
          <p className="text-xs font-semibold text-foreground mb-1.5 uppercase tracking-wider">
            Diferenciais
          </p>
          <ul className="space-y-1">
            {water.differentials.map((d) => (
              <li key={d} className="flex items-start gap-1.5 text-sm text-muted-foreground">
                <CheckCircle className="h-4 w-4 shrink-0 text-accent mt-0.5" />
                <span>{d}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* CTA */}
        <Button
          className="w-full mt-auto bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-sm hover:shadow-md transition-all hover:scale-[1.02]"
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
        <div className="text-center mb-10">
          <h2 className="text-2xl md:text-3xl lg:text-4xl font-extrabold text-foreground tracking-tight leading-tight">
            Conheça Nossas Águas
          </h2>
          <div className="mx-auto mt-3 h-1 w-16 rounded-full bg-accent" />
          <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
            Trabalhamos com as melhores marcas de água mineral do mercado. Compare e escolha a ideal para você.
          </p>
        </div>

        {/* Responsive grid: 1 col mobile, 2 tablet, 4 desktop */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 md:gap-6">
          {waters.map((w) => (
            <WaterCard key={w.name} water={w} />
          ))}
        </div>
      </div>
    </section>
  );
}
