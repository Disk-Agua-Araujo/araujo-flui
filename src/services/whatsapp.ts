import { business } from "@/config/business";
import { trackEvent } from "@/hooks/use-analytics";

export interface OrderMessageData {
  tipo: "VAREJO" | "EMPRESA";
  canal: "site" | "admin" | "whatsapp" | "ligacao";
  cliente: string;
  cnpj?: string;
  telefone: string;
  endereco?: {
    rua: string;
    numero: string;
    bairro: string;
    cidade: string;
    uf: string;
    complemento?: string;
  };
  obs?: string;
  itens: { nome: string; qtd: number }[];
  entregaData?: string;
  entregaHora?: string;
  status?: string;
  pedidoId?: string;
  fulfillmentType?: "delivery" | "pickup";
  formaPagamento?: string;
  totalAmount?: number;
  changeFor?: number;
}

export function buildOrderMessage(data: OrderMessageData): string {
  const fulfillmentLabel = data.fulfillmentType === "pickup" ? "Retirada na loja" : "Entrega";

  const itensText = data.itens
    .map((i) => `- ${i.nome}: ${i.qtd}`)
    .join("\n");

  return [
    "Pedido Disk Água Araujo",
    "",
    `Tipo: ${data.tipo}`,
    `Atendimento: ${fulfillmentLabel}`,
    `Canal: ${data.canal}`,
    `Cliente: ${data.cliente}`,
    data.cnpj ? `CNPJ: ${data.cnpj}` : null,
    `Telefone: ${data.telefone}`,
    `WhatsApp do cliente: https://wa.me/55${data.telefone.replace(/\D/g, "")}`,
    data.fulfillmentType !== "pickup" && data.endereco
      ? `Endereço: ${data.endereco.rua}, ${data.endereco.numero} - ${data.endereco.bairro} - ${data.endereco.cidade}/${data.endereco.uf}`
      : null,
    data.fulfillmentType !== "pickup" && data.endereco?.complemento
      ? `Complemento: ${data.endereco.complemento}`
      : null,
    data.obs ? `Obs: ${data.obs}` : null,
    "",
    "Itens:",
    itensText,
    "",
    data.formaPagamento ? `Forma de pagamento: ${data.formaPagamento}` : null,
    data.totalAmount ? `Total: R$ ${data.totalAmount.toFixed(2).replace(".", ",")}` : null,
    data.formaPagamento === "Dinheiro" && data.changeFor && data.totalAmount
      ? `Troco para: R$ ${data.changeFor.toFixed(2).replace(".", ",")} (Troco: R$ ${(data.changeFor - data.totalAmount).toFixed(2).replace(".", ",")})`
      : null,
    data.entregaData ? `Entrega: ${data.entregaData}${data.entregaHora ? ` às ${data.entregaHora}` : ""}` : null,
    data.status ? `Status: ${data.status}` : null,
    data.pedidoId ? `Etiqueta: ${data.pedidoId}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

export function openWhatsApp(message: string) {
  const url = business.waLink(message);
  trackEvent("whatsapp_opened", { message_length: message.length });
  window.open(url, "_blank", "noopener,noreferrer");
}

export async function sendOrderToDiskWhatsApp(
  data: OrderMessageData
): Promise<{ sent: boolean; fallback: boolean; message: string }> {
  const message = buildOrderMessage(data);
  const hasCloudAPI = false;

  if (hasCloudAPI) {
    try {
      return { sent: true, fallback: false, message };
    } catch {
      // Fall through
    }
  }

  openWhatsApp(message);
  return { sent: false, fallback: true, message };
}
