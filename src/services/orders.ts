import { supabase } from "@/integrations/supabase/client";

export interface SiteOrderData {
  customer: {
    name: string;
    phone: string;
    type: "PF" | "PJ";
    cnpj?: string;
  };
  address: {
    street: string;
    number: string;
    neighborhood: string;
    city?: string;
    state?: string;
    complement?: string;
    zip?: string;
  };
  items: { product_id: string; qty: number }[];
  notes?: string;
  delivery_date?: string;
  delivery_time?: string;
  fulfillment_type?: "delivery" | "pickup";
}

export interface SiteOrderResult {
  order_id: string;
  customer_id: string;
}

export async function createSiteOrder(data: SiteOrderData): Promise<SiteOrderResult> {
  const payload = {
    p_customer_name: data.customer.name,
    p_customer_phone: data.customer.phone,
    p_customer_type: data.customer.type,
    p_customer_cnpj: data.customer.cnpj || null,
    p_street: data.address.street,
    p_number: data.address.number,
    p_neighborhood: data.address.neighborhood,
    p_city: data.address.city || "Santo André",
    p_state: data.address.state || "SP",
    p_complement: data.address.complement || null,
    p_zip: data.address.zip || null,
    p_notes: data.notes || null,
    p_delivery_date: data.delivery_date || null,
    p_delivery_time: data.delivery_time || null,
    p_items: data.items,
    p_fulfillment_type: data.fulfillment_type || "delivery",
  };

  // Routed through edge function for IP-based rate limiting (security hardening).
  const { data: result, error } = await supabase.functions.invoke("create-site-order", {
    body: payload,
  });

  // FunctionsHttpError: try to read body for the real reason
  if (error) {
    let detail = error.message;
    try {
      const ctx: any = (error as any).context;
      if (ctx && typeof ctx.json === "function") {
        const body = await ctx.json();
        if (body?.message) detail = body.message;
      }
    } catch {}
    throw new Error(detail || "Erro ao salvar pedido");
  }
  if (result && (result as any).error) {
    throw new Error((result as any).message || "Erro ao salvar pedido");
  }
  return result as SiteOrderResult;
}
