import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import { trackEvent } from "@/hooks/use-analytics";

const paymentLabels: Record<string, string> = {
  cash: "Dinheiro",
  pix: "PIX",
  card: "Cartão",
};

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export interface LabelData {
  pedidoId: string;
  cliente: string;
  endereco: string;
  complemento?: string;
  itens: { nome: string; qtd: number }[];
  entregaData?: string;
  entregaHora?: string;
  pagamento?: string;
  obs?: string;
  totalAmount?: number;
  changeFor?: number;
}

export function OrderLabel({ data }: { data: LabelData }) {
  const ref = useRef<HTMLDivElement>(null);

  const changeValue =
    data.changeFor != null && data.totalAmount != null && data.changeFor > data.totalAmount
      ? data.changeFor - data.totalAmount
      : null;

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
        hr { border: none; border-top: 1px solid #ddd; margin: 6px 0; }
        p { margin: 2px 0; }
        .id { font-size: 10px; color: #666; margin-top: 8px; }
        ul { padding-left: 16px; margin: 4px 0; }
        .obs-block { border-left: 3px solid #033D7B; background: #f0f5ff; padding: 6px 8px; margin: 6px 0; border-radius: 2px; }
        .obs-block strong { display: block; font-size: 11px; margin-bottom: 2px; }
        @media print {
          .label-payment, .label-notes, .label-total, .label-change {
            display: block !important;
            color: #000 !important;
            -webkit-print-color-adjust: exact;
          }
          .obs-block { border-left: 3px solid #000; background: none; }
        }
      </style></head><body>
      <div class="label">
        <h2>Disk Água Araujo</h2>
        <hr/>
        <p><strong>${data.cliente}</strong></p>
        <p>${data.endereco}</p>
        ${data.complemento ? `<p>Compl.: ${data.complemento}</p>` : ""}
        <hr/>
        <p><strong>ITENS:</strong></p>
        <ul>${data.itens.map((i) => `<li>${i.nome} x${i.qtd}</li>`).join("")}</ul>
        ${data.entregaData ? `<hr/><p>Entrega: ${data.entregaData}${data.entregaHora ? ` às ${data.entregaHora}` : ""}</p>` : ""}
        <hr/>
        ${data.pagamento ? `<p class="label-payment">Pagamento: ${paymentLabels[data.pagamento] || data.pagamento}</p>` : ""}
        ${data.totalAmount != null ? `<p class="label-total">Total: ${formatCurrency(data.totalAmount)}</p>` : ""}
        ${data.pagamento === "cash" && data.changeFor != null && data.totalAmount != null ? `<p class="label-change">Troco para: ${formatCurrency(data.changeFor)} (Troco: ${formatCurrency(data.changeFor - data.totalAmount)})</p>` : ""}
        ${data.obs && data.obs.trim() !== "" ? `<hr/><div class="obs-block label-notes"><strong>Observações:</strong>${data.obs}</div>` : ""}
        <hr/>
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
        <hr className="my-1 border-border" />
        <p className="font-semibold">{data.cliente}</p>
        <p className="text-muted-foreground">{data.endereco}</p>
        {data.complemento && <p className="text-muted-foreground">Compl.: {data.complemento}</p>}
        <hr className="my-1 border-border" />
        <p className="font-semibold text-xs uppercase tracking-wide">Itens:</p>
        <ul className="list-disc list-inside">
          {data.itens.map((i) => (
            <li key={i.nome}>{i.nome} x{i.qtd}</li>
          ))}
        </ul>
        {data.entregaData && (
          <>
            <hr className="my-1 border-border" />
            <p>Entrega: {data.entregaData}{data.entregaHora ? ` às ${data.entregaHora}` : ""}</p>
          </>
        )}
        <hr className="my-1 border-border" />
        {data.pagamento && (
          <p className="label-payment">Pagamento: {paymentLabels[data.pagamento] || data.pagamento}</p>
        )}
        {data.totalAmount != null && (
          <p className="label-total">Total: {formatCurrency(data.totalAmount)}</p>
        )}
        {data.pagamento === "cash" && data.changeFor != null && data.totalAmount != null && (
          <p className="label-change">
            Troco para: {formatCurrency(data.changeFor)} (Troco: {formatCurrency(data.changeFor - data.totalAmount)})
          </p>
        )}
        {data.obs && data.obs.trim() !== "" && (
          <>
            <hr className="my-1 border-border" />
            <div className="label-notes border-l-4 border-[#033D7B] bg-[#f0f5ff] rounded-sm px-3 py-2 mt-2">
              <p className="font-semibold text-xs text-[#033D7B]">Observações:</p>
              <p className="text-sm">{data.obs}</p>
            </div>
          </>
        )}
        <hr className="my-1 border-border" />
        <p className="text-xs text-muted-foreground">ID: {data.pedidoId}</p>
      </div>
      <Button variant="outline" size="sm" onClick={handlePrint}>
        <Printer className="h-4 w-4 mr-1" /> Imprimir etiqueta
      </Button>
    </div>
  );
}
