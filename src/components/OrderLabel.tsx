import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import { trackEvent } from "@/hooks/use-analytics"; // analytics

const paymentLabels: Record<string, string> = {
  cash: "Dinheiro",
  pix: "PIX",
  card: "Cartão",
};

export interface LabelData {
  pedidoId: string;
  cliente: string;
  endereco: string;
  complemento?: string;
  itens: { nome: string; qtd: number }[];
  entregaData?: string;
  entregaHora?: string;
  pagamento?: string;
}

export function OrderLabel({ data }: { data: LabelData }) {
  const ref = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    trackEvent("label_printed", { pedidoId: data.pedidoId });
    const content = ref.current;
    if (!content) return;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`
      <html><head><title>Etiqueta ${data.pedidoId}</title>
      <style>
        @page { size: 100mm 150mm; margin: 4mm; }
        body { font-family: sans-serif; font-size: 12px; margin: 0; padding: 8px; }
        .label { border: 1px solid #ccc; padding: 12px; border-radius: 4px; }
        h2 { margin: 0 0 6px; font-size: 14px; }
        p { margin: 2px 0; }
        .id { font-size: 10px; color: #666; margin-top: 8px; }
        ul { padding-left: 16px; margin: 4px 0; }
      </style></head><body>
      <div class="label">
        <h2>Disk Água Araujo</h2>
        <p><strong>${data.cliente}</strong></p>
        <p>${data.endereco}</p>
        ${data.complemento ? `<p>Compl.: ${data.complemento}</p>` : ""}
        <ul>${data.itens.map((i) => `<li>${i.nome}: ${i.qtd}</li>`).join("")}</ul>
        ${data.entregaData ? `<p>Entrega: ${data.entregaData}${data.entregaHora ? ` às ${data.entregaHora}` : ""}</p>` : ""}
        ${data.pagamento ? `<p>Pagamento: ${paymentLabels[data.pagamento] || data.pagamento}</p>` : ""}
        <p class="id">ID: ${data.pedidoId}</p>
      </div>
      </body></html>
    `);
    win.document.close();
    win.print();
  };

  return (
    <div>
      <div ref={ref} className="border rounded-lg p-4 bg-card text-sm space-y-1 mb-3">
        <p className="font-bold text-base">Disk Água Araujo</p>
        <p className="font-semibold">{data.cliente}</p>
        <p className="text-muted-foreground">{data.endereco}</p>
        {data.complemento && <p className="text-muted-foreground">Compl.: {data.complemento}</p>}
        <ul className="list-disc list-inside">
          {data.itens.map((i) => (
            <li key={i.nome}>{i.nome}: {i.qtd}</li>
          ))}
        </ul>
        {data.entregaData && (
          <p>Entrega: {data.entregaData}{data.entregaHora ? ` às ${data.entregaHora}` : ""}</p>
        )}
        {data.pagamento && (
          <p className="text-sm">Pagamento: {paymentLabels[data.pagamento] || data.pagamento}</p>
        )}
        <p className="text-xs text-muted-foreground">ID: {data.pedidoId}</p>
      </div>
      <Button variant="outline" size="sm" onClick={handlePrint}>
        <Printer className="h-4 w-4 mr-1" /> Imprimir etiqueta
      </Button>
    </div>
  );
}
