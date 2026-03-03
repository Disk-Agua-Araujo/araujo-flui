import { business } from "@/config/business";
import { trackEvent } from "@/hooks/use-analytics"; // analytics

export interface OrderMessageData {
  tipo: "VAREJO" | "EMPRESA";
  canal: "site" | "admin" | "whatsapp" | "ligacao";
  cliente: string;
  cnpj?: string;
  telefone: string;
  endereco: {
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
}

export function buildOrderMessage(data: OrderMessageData): string {
  const itensText = data.itens
    .map((i) => `- ${i.nome}: ${i.qtd}`)
    .join("\n");

  return [
    "Pedido Disk Água Araujo",
    "",
    `Tipo: ${data.tipo}`,
    `Canal: ${data.canal}`,
    `Cliente: ${data.cliente}`,
    data.cnpj ? `CNPJ: ${data.cnpj}` : null,
    `Telefone: ${data.telefone}`,
    `Endereço: ${data.endereco.rua}, ${data.endereco.numero} - ${data.endereco.bairro} - ${data.endereco.cidade}/${data.endereco.uf}`,
    data.endereco.complemento ? `Complemento: ${data.endereco.complemento}` : null,
    data.obs ? `Obs: ${data.obs}` : null,
    "",
    "Itens:",
    itensText,
    "",
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

// Adapter for future WhatsApp Business Cloud API integration
export async function sendWhatsAppAPI(_phone: string, _message: string): Promise<boolean> {
  // TODO: Implement with WhatsApp Business Cloud API
  // Requires: WHATSAPP_TOKEN, PHONE_NUMBER_ID secrets
  console.warn("[WhatsApp API] Not configured. Using wa.me link fallback.");
  return false;
}
