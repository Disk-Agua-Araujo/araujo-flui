import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const order = {
  id: "abcd1234-0000-0000-0000-000000000000", channel: "ligacao", delivery_date: null, delivery_time: null,
  status: "novo", notes: "Entregar na portaria\nLevar 2 vasilhames de volta", created_at: "2026-10-05T12:00:00Z",
  fulfillment_type: "delivery", payment_method: "pix", payment_method_2: null, payment_amount_1: null,
  payment_amount_2: null, change_for_2: null, is_split_payment: false, total_amount: 13, change_for: null,
  rider_id: null, pix_paid: false, pix_paid_at: null, em_rota_at: null, updated_at: null, updated_by: null,
  scheduled_date: null, scheduled_time: null, reminder_enabled: false, reminder_dismissed: false,
  payment_due_date: null, paid_at: null, paid_by: null,
  customers: { id: "c1", name: "Vanessa", phone: null, cnpj: null, type: "PF" },
  addresses: { street: "Rua Osório de Almeida", number: "346", neighborhood: "Centro", city: "Santo André", complement: null },
  order_items: [{ qty: 1, product_id: "p1", unit_price: 13, products: { name: "Fardo Crystal" } }],
  invoices: [],
};

// Qualquer chamada da API responde vazio; a lista de pedidos traz um pedido com observação.
vi.mock("@/services/admin-api", () => ({
  adminApi: new Proxy({}, {
    get: (_t, name) => {
      if (name === "listOrders") return async () => ({ rows: [order], total: 1, page: 0, pageSize: 200 });
      if (name === "checkInvoice") return async () => ({ problems: [], environment: 1, fixes: { prices: [], products: [], customer: null, address: null } });
      if (name === "listRiders") return async () => [];
      return async () => ({});
    },
  }),
}));

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

import { OrdersTab } from "@/components/admin/OrdersTab";

describe("Observações do pedido", () => {
  it("aparecem com selo na lista e em destaque ao clicar no olho", async () => {
    render(<MemoryRouter><OrdersTab /></MemoryRouter>);

    const badges = await screen.findAllByTitle(/Entregar na portaria/);
    expect(badges.length).toBeGreaterThan(0);

    fireEvent.click(screen.getAllByTitle("Detalhes")[0] ?? screen.getAllByText("Ver")[0]);
    const box = (await screen.findByText("Observações do pedido")).closest("div")!.parentElement!;
    expect(within(box).getByText(/Entregar na portaria/)).toBeInTheDocument();
    expect(within(box).getByText(/Levar 2 vasilhames de volta/)).toBeInTheDocument();
  });
});
