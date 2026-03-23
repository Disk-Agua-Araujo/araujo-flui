const TOKEN_KEY = "admin_token";
const FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-panel`;
const PUBLIC_BEARER = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

type ApiResponse<T> = { data?: T; error?: string; ok?: boolean };

function mapErrorMessage(message: string) {
  const lower = message.toLowerCase();
  if (lower.includes("row-level security") || lower.includes("permission denied") || lower.includes("sem permissão")) {
    return "Sem permissão para executar esta ação. Verifique se você está logado como admin.";
  }
  return message;
}

async function callAdminApi<T>(action: string, payload?: unknown): Promise<T> {
  const token = localStorage.getItem(TOKEN_KEY);

  if (!token) {
    throw new Error("Sem permissão para executar esta ação. Faça login no Admin novamente.");
  }

  const res = await fetch(FUNCTIONS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${PUBLIC_BEARER}`,
      "x-admin-token": token,
    },
    body: JSON.stringify({ action, payload }),
  });

  const body = (await res.json()) as ApiResponse<T>;

  if (!res.ok || body.error) {
    const message = mapErrorMessage(body.error || "Erro interno");
    console.error("admin-api", { action, status: res.status, body });
    throw new Error(message);
  }

  return body.data as T;
}

export type AdminOrderRow = {
  id: string;
  channel: string;
  delivery_date: string | null;
  delivery_time: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  fulfillment_type: string;
  payment_method: string | null;
  total_amount: number | null;
  change_for: number | null;
  customers: { id: string; name: string; phone: string | null; cnpj: string | null } | null;
  addresses: { street: string; number: string; neighborhood: string; city: string; complement: string | null } | null;
  order_items: { qty: number; products: { name: string } | null }[];
};

export type AdminCustomerRow = {
  id: string;
  name: string;
  phone: string | null;
  cnpj: string | null;
  email: string | null;
  type: "PF" | "PJ";
  created_at: string;
  addresses?: {
    id: string;
    street: string;
    number: string;
    neighborhood: string;
    city: string;
    state: string;
    complement: string | null;
    zip: string | null;
    reference: string | null;
    is_primary: boolean | null;
  }[];
};

export type AdminProductRow = {
  id: string;
  name: string;
  description: string | null;
  type: "varejo" | "atacado" | "ambos";
  icon: string | null;
  active: boolean;
  price_text: string | null;
  created_at: string;
  stock_qty: number;
  min_stock_qty: number;
  track_stock: boolean;
  category_id: string | null;
  show_in_quick_order: boolean;
  image_url: string | null;
};

export type AdminTierRow = {
  id: string;
  product_id: string;
  min_qty: number;
  price_text: string;
};

export type AdminCategoryRow = {
  id: string;
  name: string;
  slug: string;
  sort_order: number;
  created_at: string;
};

export type CustomerOrderRow = {
  id: string;
  status: string;
  created_at: string;
  channel: string;
  order_items: { qty: number; products: { name: string } | null }[];
};

export const adminApi = {
  listOrders: () => callAdminApi<AdminOrderRow[]>("orders.list"),
  updateOrderStatus: (orderId: string, status: string) =>
    callAdminApi<{ ok: boolean }>("orders.updateStatus", { orderId, status }),

  createAdminOrder: (payload: {
    channel: "admin" | "ligacao" | "whatsapp";
    customer?: { name: string; phone: string; type: "PF" | "PJ"; cnpj?: string | null; email?: string | null };
    address?: { street: string; number: string; neighborhood: string; city?: string; state?: string; complement?: string; zip?: string };
    items: { product_id: string; qty: number }[];
    notes?: string;
    delivery_date?: string;
    delivery_time?: string;
    fulfillment_type?: "delivery" | "pickup";
    payment_method?: string | null;
    total_amount?: number | null;
    change_for?: number | null;
  }) => callAdminApi<{ order_id: string; customer_id: string }>("orders.createAdmin", payload),

  listCustomers: () => callAdminApi<AdminCustomerRow[]>("customers.list"),
  getCustomerOrders: (customerId: string) =>
    callAdminApi<CustomerOrderRow[]>("customers.orders", { customerId }),
  saveCustomer: (payload: {
    id?: string;
    name: string;
    phone: string;
    type: "PF" | "PJ";
    cnpj?: string | null;
    email?: string | null;
    address?: {
      street: string;
      number: string;
      neighborhood: string;
      city?: string;
      state?: string;
      complement?: string | null;
      zip?: string | null;
      reference?: string | null;
    };
  }) => callAdminApi<AdminCustomerRow>("customers.save", payload),

  listProducts: () => callAdminApi<{ products: AdminProductRow[]; tiers: AdminTierRow[]; categories: AdminCategoryRow[] }>("products.list"),
  saveProduct: (payload: {
    product: Partial<AdminProductRow>;
    tiers: { min_qty: number; price_text: string }[];
  }) => callAdminApi<{ ok: boolean }>("products.save", payload),
  deleteProduct: (id: string) => callAdminApi<{ ok: boolean }>("products.delete", { id }),
  adjustStock: (payload: {
    product_id: string;
    qty: number;
    type: "in" | "out" | "adjust";
    reason?: string;
  }) => callAdminApi<{ ok: boolean }>("stock.adjust", payload),

  searchCustomers: (query: string) =>
    callAdminApi<AdminCustomerRow[]>("customers.search", { query }),

  deleteCustomer: (customerId: string) =>
    callAdminApi<{ ok: boolean }>("customers.delete", { customerId }),

  checkDuplicateAddress: (street: string, number: string, excludeCustomerId?: string) =>
    callAdminApi<{ id: string; customer_id: string; customers: { name: string } } | null>(
      "customers.checkDuplicate",
      { street, number, excludeCustomerId }
    ),

  listCategories: () => callAdminApi<AdminCategoryRow[]>("categories.list"),

  listReportsOrders: () => callAdminApi<AdminOrderRow[]>("reports.orders"),
};
