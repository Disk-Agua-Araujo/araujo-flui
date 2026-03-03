import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { business } from "@/config/business";

export function FAQ() {
  return (
    <section className="py-12 md:py-16">
      <div className="container max-w-2xl">
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-8">Perguntas frequentes</h2>
        <Accordion type="single" collapsible className="w-full">
          {business.faq.map((item, i) => (
            <AccordionItem key={i} value={`faq-${i}`}>
              <AccordionTrigger className="text-left text-base">{item.q}</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">{item.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
