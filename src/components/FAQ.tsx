import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { business } from "@/config/business";

export function FAQ() {
  const items: Array<{ q: string; a: string }> = business.faq;

  return (
    <section className="py-12 md:py-16">
      <div className="container max-w-2xl">
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-2">Perguntas frequentes</h2>
        <p className="text-center text-muted-foreground mb-8">Tire suas dúvidas sobre nossos serviços</p>

        <Accordion type="single" collapsible className="w-full space-y-3">
          {items.length === 0 ? (
            <p className="text-center text-muted-foreground py-6">Nenhuma pergunta encontrada.</p>
          ) : (
            items.map((item, i) => (
              <AccordionItem
                key={i}
                value={`faq-${i}`}
                className="border rounded-lg bg-card shadow-sm hover:shadow-md transition-shadow overflow-hidden data-[state=open]:border-accent/40"
              >
                <AccordionTrigger className="text-left text-base font-semibold px-5 py-4 hover:no-underline gap-3 [&[data-state=open]]:text-primary">
                  <span className="flex items-center gap-3">
                    <span className="h-1.5 w-1.5 rounded-full bg-accent shrink-0" />
                    {item.q}
                  </span>
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground px-5 pb-4 pl-[2.75rem] leading-relaxed">
                  {item.a}
                </AccordionContent>
              </AccordionItem>
            ))
          )}
        </Accordion>
      </div>
    </section>
  );
}
