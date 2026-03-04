import { business } from "@/config/business";
import { trackEvent } from "@/hooks/use-analytics";

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
    `WhatsApp do cliente: https://wa.me/55${data.telefone.replace(/\D/g, "")}`,
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

/**
 * Send order to Disk WhatsApp.
 * Mode A: WhatsApp Business Cloud API (if configured) — NOT YET IMPLEMENTED
 * Mode B: Fallback — opens wa.me link with pre-filled message
 * 
 * Returns { sent: boolean, fallback: boolean }
 */
export async function sendOrderToDiskWhatsApp(
  data: OrderMessageData
): Promise<{ sent: boolean; fallback: boolean; message: string }> {
  const message = buildOrderMessage(data);

  // Mode A: WhatsApp Business Cloud API
  // Check if credentials are available (would be in edge function env)
  // For now, this is always false — adapter ready for future integration
  const hasCloudAPI = false;

  if (hasCloudAPI) {
    try {
      // TODO: Call edge function that sends via WhatsApp Cloud API
      // await supabase.functions.invoke('send-whatsapp', { body: { phone: '5511940060056', message } });
      return { sent: true, fallback: false, message };
    } catch {
      // Fall through to fallback
    }
  }

  // Mode B: Fallback — open WhatsApp link
  openWhatsApp(message);
  return { sent: false, fallback: true, message };
}
