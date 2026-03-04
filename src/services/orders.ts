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
  delivery_date?: string; // yyyy-MM-dd
  delivery_time?: string;
}

export interface SiteOrderResult {
  order_id: string;
  customer_id: string;
}

/**
 * Creates a full order in the database (customer + address + order + items).
 * Uses a SECURITY DEFINER function to handle customer deduplication
 * and bypass RLS for anonymous site visitors.
 */
export async function createSiteOrder(data: SiteOrderData): Promise<SiteOrderResult> {
  const { data: result, error } = await (supabase.rpc as any)("create_full_site_order", {
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
  });

  if (error) throw new Error(`Erro ao salvar pedido: ${error.message}`);
  return result as SiteOrderResult;
}
