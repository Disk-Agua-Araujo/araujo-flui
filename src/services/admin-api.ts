import type { ImportRow } from "@/lib/customer-import";

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
  payment_method_2: string | null;
  payment_amount_1: number | null;
  payment_amount_2: number | null;
  change_for_2: number | null;
  is_split_payment: boolean | null;
  total_amount: number | null;
  change_for: number | null;
  rider_id: string | null;
  pix_paid: boolean | null;
  pix_paid_at: string | null;
  em_rota_at: string | null;
  updated_at: string | null;
  updated_by: string | null;
  scheduled_date: string | null;
  scheduled_time: string | null;
  reminder_enabled: boolean;
  reminder_dismissed: boolean;
  payment_due_date: string | null;
  paid_at: string | null;
  paid_by: string | null;
  customers: { id: string; name: string; phone: string | null; cnpj: string | null; type?: string } | null;
  addresses: { street: string; number: string; neighborhood: string; city: string; complement: string | null; reference?: string | null } | null;
  order_items: { qty: number; product_id?: string; unit_price?: number | null; products: { name: string } | null }[];
  invoices?: InvoiceSummary[];
  rider_name?: string;
};

export type InvoiceStatus = "processando" | "autorizada" | "erro" | "cancelada";

/** Resumo da nota que vem junto da lista de pedidos. */
export type InvoiceSummary = {
  id: string;
  status: InvoiceStatus;
  numero: number | null;
  /** 1 produção, 2 homologação (teste, sem valor fiscal). */
  environment: 1 | 2;
  created_at: string;
};

export type InvoiceRow = InvoiceSummary & {
  order_id: string;
  serie: number | null;
  chave: string | null;
  protocolo: string | null;
  sefaz_code: number | null;
  message: string | null;
  total: number | null;
  correction_seq: number;
  updated_at: string;
  authorized_at: string | null;
  cancelled_at: string | null;
};

export type AdminCustomerRow = {
  id: string;
  name: string;
  phone: string | null;
  cnpj: string | null;
  /** Razão social, usada na NF-e. O name é o nome do dia a dia (fantasia). */
  legal_name?: string | null;
  notes?: string | null;
  cpf?: string | null;
  ie?: string | null;
  /** NF-e: 1 contribuinte, 2 isento, 9 não contribuinte. */
  ie_indicator?: 1 | 2 | 9 | null;
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
    ibge_code?: string | null;
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
  /** Preço usado no pedido e na nota. price_text segue sendo o que o site exibe. */
  price: number | null;
  ncm: string | null;
  cest: string | null;
  cfop: string | null;
  cst_csosn: string | null;
  origem: number;
  unidade: string;
  /** Grupo tributário do painel da Brasil NFe; dispensa CFOP e CST no item. */
  tax_group: string | null;
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

export type CustomerImportResult = {
  index: number;
  action: "insert" | "update" | "skip";
  name?: string;
  address?: "nova" | "adicional" | "existente" | "sem";
  reason?: string;
};

export type CustomerOrderRow = {
  id: string;
  status: string;
  created_at: string;
  channel: string;
  order_items: { qty: number; products: { name: string } | null }[];
};

export type DeliveryRider = {
  id: string;
  label: string;
  name: string;
  active: boolean;
  sort_order: number;
  created_at: string;
};

export type OrdersListPayload = {
  page?: number;
  pageSize?: number;
};

export type OrdersListResult = {
  rows: AdminOrderRow[];
  total: number;
  page: number;
  pageSize: number;
};

export type ReportsSummary = {
  summary: { total_orders: number; delivered: number; cancelled: number; total_items: number };
  revenue: { payment_method: string; total: number; order_count: number }[];
  products: { product_name: string; qty: number }[];
};

export type ReceivableRow = {
  id: string;
  status: string;
  channel: string;
  created_at: string;
  delivery_date: string | null;
  delivery_time: string | null;
  fulfillment_type: string | null;
  scheduled_date: string | null;
  scheduled_time: string | null;
  total_amount: number | null;
  payment_method: string | null;
  payment_method_2: string | null;
  payment_amount_1: number | null;
  payment_amount_2: number | null;
  is_split_payment: boolean | null;
  change_for: number | null;
  change_for_2: number | null;
  payment_due_date: string;
  paid_at: string | null;
  paid_by: string | null;
  notes: string | null;
  updated_at: string | null;
  updated_by: string | null;
  customers: { id: string; name: string; phone: string | null; cnpj: string | null; type?: string } | null;
  addresses: { street: string; number: string; neighborhood: string; city: string; complement: string | null; reference?: string | null } | null;
  order_items: { qty: number; product_id?: string; products: { name: string } | null }[];
};

export type ReceivablesSummary = {
  open_total: number;
  open_count: number;
  due_today_total: number;
  due_today_count: number;
  late_total: number;
  late_count: number;
  received_total: number;
  received_count: number;
};

export type ReceivablesListResult = {
  rows: ReceivableRow[];
  total: number;
  page: number;
  pageSize: number;
  /** Data de hoje em São Paulo, calculada no servidor. */
  today: string;
  summary: ReceivablesSummary;
};

export type CashByMethodRow = {
  payment_method: string;
  a_prazo: boolean;
  total: number;
  order_count: number;
};

export type CashEntryRow = {
  order_id: string;
  /** Dia em que o dinheiro entrou no caixa. */
  cash_date: string;
  customer_name: string | null;
  customer_phone: string | null;
  payment_method: string | null;
  payment_method_2: string | null;
  is_split: boolean;
  total_amount: number;
  a_prazo: boolean;
  due_date: string | null;
};

export type CashReportResult = {
  byMethod: CashByMethodRow[];
  entries: CashEntryRow[];
  total: number;
  page: number;
  pageSize: number;
};

export type OrderPaymentPayload = {
  payment_method: string | null;
  payment_method_2: string | null;
  payment_amount_1: number | null;
  payment_amount_2: number | null;
  total_amount: number | null;
  change_for: number | null;
  change_for_2: number | null;
  is_split_payment: boolean;
};

export const adminApi = {
  listOrders: (payload?: OrdersListPayload) =>
    callAdminApi<OrdersListResult>("orders.list", payload ?? {}),
  updateOrderStatus: (orderId: string, status: string) =>
    callAdminApi<{ ok: boolean }>("orders.updateStatus", { orderId, status }),

  createAdminOrder: (payload: {
    channel: "admin" | "ligacao" | "whatsapp";
    customer?: { name: string; phone: string; type: "PF" | "PJ"; cnpj?: string | null; email?: string | null };
    address?: { street: string; number: string; neighborhood: string; city?: string; state?: string; complement?: string; zip?: string };
    items: { product_id: string; qty: number; unit_price?: number | null }[];
    notes?: string;
    delivery_date?: string;
    delivery_time?: string;
    fulfillment_type?: "delivery" | "pickup";
    payment_method?: string | null;
    payment_method_2?: string | null;
    payment_amount_1?: number | null;
    payment_amount_2?: number | null;
    is_split_payment?: boolean;
    total_amount?: number | null;
    change_for?: number | null;
    change_for_2?: number | null;
    scheduled_date?: string | null;
    scheduled_time?: string | null;
    payment_due_date?: string | null;
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
    cpf?: string | null;
    ie?: string | null;
    ie_indicator?: 1 | 2 | 9 | null;
    legal_name?: string | null;
    notes?: string | null;
    email?: string | null;
    address?: {
      street: string;
      number: string;
      neighborhood: string;
      city?: string;
      state?: string;
      complement?: string | null;
      zip?: string | null;
      ibge_code?: string | null;
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

  /** Importa um lote de até 200 linhas. Com dryRun só diz o que aconteceria. */
  importCustomers: (rows: ImportRow[], dryRun: boolean) =>
    callAdminApi<{ results: CustomerImportResult[] }>("customers.import", { rows, dryRun }),

  searchCustomers: (query: string) =>
    callAdminApi<AdminCustomerRow[]>("customers.search", { query }),

  deleteCustomer: (customerId: string) =>
    callAdminApi<{ ok: boolean }>("customers.delete", { customerId }),

  checkDuplicateAddress: (street: string, number: string, complement?: string, excludeCustomerId?: string) =>
    callAdminApi<{ id: string; customer_id: string; complement: string | null; customers: { name: string } } | null>(
      "customers.checkDuplicate",
      { street, number, complement: complement || "", excludeCustomerId }
    ),

  listCategories: () => callAdminApi<AdminCategoryRow[]>("categories.list"),

  listReportsOrders: (payload?: { dateStart?: string; dateEnd?: string }) =>
    callAdminApi<AdminOrderRow[]>("reports.orders", payload ?? {}),

  getReportsSummary: (dateStart: string, dateEnd: string) =>
    callAdminApi<ReportsSummary>("reports.summary", { dateStart, dateEnd }),

  updateOrder: (payload: {
    orderId: string;
    order: {
      status?: string;
      notes?: string | null;
      delivery_date?: string | null;
      delivery_time?: string | null;
      fulfillment_type?: string;
      payment_method?: string | null;
      payment_method_2?: string | null;
      payment_amount_1?: number | null;
      payment_amount_2?: number | null;
      is_split_payment?: boolean;
      total_amount?: number | null;
      change_for?: number | null;
      change_for_2?: number | null;
      rider_id?: string | null;
      scheduled_date?: string | null;
      scheduled_time?: string | null;
      reminder_enabled?: boolean;
      reminder_dismissed?: boolean;
      payment_due_date?: string | null;
    };
    items?: { product_id: string; qty: number; unit_price?: number | null }[];
    address?: {
      street: string;
      number: string;
      neighborhood: string;
      city?: string;
      complement?: string | null;
      reference?: string | null;
    } | null;
  }) => callAdminApi<{ ok: boolean }>("orders.update", payload),

  /** Troca só o bloco de pagamento — funciona em pedido de qualquer status. */
  updateOrderPayment: (orderId: string, payment: OrderPaymentPayload) =>
    callAdminApi<{ ok: boolean } & OrderPaymentPayload>("orders.updatePayment", { orderId, payment }),

  listRiders: () => callAdminApi<DeliveryRider[]>("riders.list"),
  saveRider: (rider: { id?: string; label: string; name: string; active?: boolean; sort_order?: number }) =>
    callAdminApi<{ ok: boolean }>("riders.save", rider),
  deleteRider: (riderId: string) =>
    callAdminApi<{ ok: boolean }>("riders.delete", { riderId }),
  setOrderRider: (orderId: string, riderId: string | null) =>
    callAdminApi<{ ok: boolean }>("orders.setRider", { orderId, riderId }),
  togglePixPaid: (orderId: string) =>
    callAdminApi<{ pix_paid: boolean; pix_paid_at: string | null }>("orders.togglePixPaid", { orderId }),
  getRiderStats: (riderIds: string[]) =>
    callAdminApi<Record<string, { pedidos: number; galoes: number }>>("riders.stats", { riderIds }),
  getRiderDailyStats: (riderIds: string[], dateFrom: string) =>
    callAdminApi<Record<string, { dia: string; total_galoes: number; total_pedidos: number }[]>>("riders.dailyStats", { riderIds, dateFrom }),
  saveCustomerFromOrder: (payload: {
    orderId: string;
    customer: { name: string; phone?: string; type?: "PF" | "PJ" };
    address?: { street: string; number: string; neighborhood: string; city?: string; complement?: string };
  }) => callAdminApi<{ customer_id: string }>("orders.saveCustomerFromOrder", payload),

  dismissReminders: (orderIds: string[]) =>
    callAdminApi<{ ok: boolean }>("orders.dismissReminders", { orderIds }),

  bulkUpdateOrders: (orderIds: string[], updates: { status?: string; rider_id?: string | null; payment_method?: string | null }) =>
    callAdminApi<{ ok: boolean; count: number; failed?: { id: string; error: string }[] }>("orders.bulkUpdate", { orderIds, updates }),

  listReceivables: (payload?: {
    view?: "open" | "paid";
    dateStart?: string;
    dateEnd?: string;
    search?: string;
    page?: number;
    pageSize?: number;
  }) => callAdminApi<ReceivablesListResult>("receivables.list", payload ?? {}),

  getCashReport: (payload: {
    dateStart: string;
    dateEnd: string;
    search?: string;
    page?: number;
    pageSize?: number;
  }) => callAdminApi<CashReportResult>("reports.cash", payload),

  markReceivablePaid: (payload: { orderId: string; paidAt: string; paymentMethod?: string | null }) =>
    callAdminApi<{ ok: boolean; paid_at: string }>("receivables.markPaid", payload),

  undoReceivablePaid: (orderId: string) =>
    callAdminApi<{ ok: boolean }>("receivables.undoPaid", { orderId }),

  checkInvoice: (orderId: string) =>
    callAdminApi<{ problems: string[]; environment: 1 | 2 }>("invoices.check", { orderId }),
  /** Confere token, certificado e SEFAZ. ok quando a SEFAZ responde 107 (em operação). */
  sefazStatus: () =>
    callAdminApi<{ ok: boolean; message: string; environment: 1 | 2; detail: string }>("invoices.sefazStatus"),
  /** DANFE de conferência, sem valor fiscal e sem passar pela SEFAZ. */
  previewInvoice: (orderId: string) =>
    callAdminApi<{ base64?: string; filename?: string; problems?: string[] }>("invoices.preview", { orderId }),
  /** Devolve a nota, ou a lista do que falta acertar antes de emitir. */
  emitInvoice: (orderId: string) =>
    callAdminApi<{ invoice?: InvoiceRow; problems?: string[] }>("invoices.emit", { orderId }),
  refreshInvoice: (invoiceId: string) =>
    callAdminApi<{ invoice: InvoiceRow }>("invoices.refresh", { invoiceId }),
  cancelInvoice: (invoiceId: string, reason: string) =>
    callAdminApi<{ invoice: InvoiceRow }>("invoices.cancel", { invoiceId, reason }),
  correctInvoice: (invoiceId: string, text: string) =>
    callAdminApi<{ invoice: InvoiceRow }>("invoices.correct", { invoiceId, text }),
  getInvoiceFile: (invoiceId: string, type: "xml" | "danfe") =>
    callAdminApi<{ content?: string; base64?: string; filename: string }>("invoices.file", { invoiceId, type }),

  bulkDeleteOrders: (orderIds: string[]) =>
    callAdminApi<{ ok: boolean; deleted: number; skipped: number }>("orders.bulkDelete", { orderIds }),
};
