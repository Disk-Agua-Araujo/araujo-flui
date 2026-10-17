import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const base = {
  channel: "ligacao", delivery_date: null, delivery_time: null, status: "entregue", notes: null,
  fulfillment_type: "delivery", payment_method: "pix", payment_method_2: null, payment_amount_1: null,
  payment_amount_2: null, change_for_2: null, is_split_payment: false, total_amount: 13, change_for: null,
  rider_id: null, pix_paid: false, pix_paid_at: null, em_rota_at: null, updated_at: null, updated_by: null,
  scheduled_date: null, scheduled_time: null, reminder_enabled: false, reminder_dismissed: false,
  payment_due_date: null, paid_at: null, paid_by: null, customers: null,
  addresses: { street: "Rua das Flores", number: "10", neighborhood: "Centro", city: "Santo André", complement: null },
  order_items: [{ qty: 1, product_id: "p1", unit_price: 13, products: { name: "Galão 20L" } }],
  invoices: [],
};

// Hoje no teste é sexta, 16/10/2026: semana de 12/10 a 18/10.
const orders = [
  { ...base, id: "aaaa0001-0000-0000-0000-000000000000", created_at: "2026-10-14T15:00:00Z" },
  { ...base, id: "aaaa0002-0000-0000-0000-000000000000", created_at: "2026-10-05T15:00:00Z" },
  { ...base, id: "aaaa0003-0000-0000-0000-000000000000", created_at: "2026-08-10T15:00:00Z" },
  { ...base, id: "aaaa0004-0000-0000-0000-000000000000", created_at: "2025-12-20T15:00:00Z" },
];

const marcos = {
  id: "c-marcos", name: "Marcos Lima", phone: "11999990000", cnpj: null, cpf: "12345678909", type: "PF",
  email: null, created_at: "2026-10-16T12:00:00Z",
  addresses: [{ id: "a1", street: "Rua das Flores", number: "10", neighborhood: "Centro", city: "Santo André", state: "SP", complement: null, zip: "09000000", reference: null, is_primary: true }],
};

const linkOrderCustomer = vi.fn(async () => ({ customer: { id: marcos.id, name: marcos.name, phone: marcos.phone, cnpj: null, type: "PF" } }));

vi.mock("@/services/admin-api", () => ({
  adminApi: new Proxy({}, {
    get: (_t, name) => {
      if (name === "listOrders") return async () => ({ rows: orders, total: orders.length, page: 0, pageSize: 200 });
      if (name === "checkInvoice") return async () => ({ problems: [], environment: 1, fixes: { prices: [], products: [], customer: null, address: null } });
      if (name === "listRiders") return async () => [];
      if (name === "searchCustomers") return async () => [marcos];
      if (name === "linkOrderCustomer") return linkOrderCustomer;
      return async () => ({});
    },
  }),
}));

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

// O Select do Radix usa APIs de ponteiro que o jsdom não tem.
Element.prototype.hasPointerCapture ??= () => false;
Element.prototype.releasePointerCapture ??= () => {};
Element.prototype.scrollIntoView ??= () => {};

import { OrdersTab } from "@/components/admin/OrdersTab";

function choosePeriod(label: string) {
  const trigger = screen.getByText("Período: Todos").closest("button")!;
  fireEvent.keyDown(trigger, { key: "Enter" });
  fireEvent.click(screen.getByRole("option", { name: label }));
}

const count = (text: string) => screen.findByText(text, {}, { timeout: 2000 });

describe("Filtro de período e vínculo de cliente", () => {
  beforeAll(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-10-16T15:00:00")); });
  afterAll(() => { vi.useRealTimers(); });

  it("escolhe qualquer mês, qualquer semana ou um intervalo", async () => {
    render(<MemoryRouter><OrdersTab /></MemoryRouter>);
    await count("4 pedidos encontrados");

    choosePeriod("Escolher mês");
    await count("2 pedidos encontrados");
    fireEvent.click(screen.getByTitle("Mês anterior"));
    fireEvent.click(screen.getByTitle("Mês anterior"));
    await count("1 pedido encontrado");
    expect(screen.getByText("Agosto")).toBeInTheDocument();
  });

  it("navega pela semana de segunda a domingo", async () => {
    render(<MemoryRouter><OrdersTab /></MemoryRouter>);
    await count("4 pedidos encontrados");

    choosePeriod("Escolher semana");
    expect(screen.getByText("12/10 a 18/10/2026")).toBeInTheDocument();
    await count("1 pedido encontrado");
    fireEvent.click(screen.getByTitle("Semana anterior"));
    expect(screen.getByText("05/10 a 11/10/2026")).toBeInTheDocument();
    await count("1 pedido encontrado");
    fireEvent.click(screen.getByTitle("Semana anterior"));
    await count("0 pedidos encontrados");
  });

  it("filtra entre duas datas, incluindo o último dia", async () => {
    const { container } = render(<MemoryRouter><OrdersTab /></MemoryRouter>);
    await count("4 pedidos encontrados");

    choosePeriod("Entre datas");
    const [from, to] = Array.from(container.querySelectorAll<HTMLInputElement>('input[type="date"]'));
    fireEvent.change(from, { target: { value: "2025-12-20" } });
    fireEvent.change(to, { target: { value: "2026-08-10" } });
    await count("2 pedidos encontrados");
  });

  it("vincula um cliente já cadastrado a um pedido feito sem cliente", async () => {
    render(<MemoryRouter><OrdersTab /></MemoryRouter>);
    await count("4 pedidos encontrados");

    fireEvent.click(screen.getAllByTitle("Detalhes")[0]);
    fireEvent.click(await screen.findByText("Vincular cliente"));
    fireEvent.change(screen.getByPlaceholderText("Nome, telefone ou rua do cliente"), { target: { value: "Marcos" } });
    fireEvent.click(await screen.findByRole("button", { name: "Vincular" }, { timeout: 2000 }));

    expect(linkOrderCustomer).toHaveBeenCalledWith("aaaa0001-0000-0000-0000-000000000000", "c-marcos");
    expect(await screen.findByText((_, el) => el?.tagName === "P" && el.textContent === "Cliente: Marcos Lima")).toBeInTheDocument();
    expect(screen.queryByText("Salvar como cliente")).not.toBeInTheDocument();
  });
});
