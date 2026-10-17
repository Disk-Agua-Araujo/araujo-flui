import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const base = {
  channel: "ligacao", delivery_date: null, delivery_time: null, status: "entregue", notes: null,
  fulfillment_type: "delivery", payment_method: "pix", payment_method_2: null, payment_amount_1: null,
  payment_amount_2: null, change_for_2: null, is_split_payment: false, total_amount: 13, change_for: null,
  rider_id: null, pix_paid: false, pix_paid_at: null, em_rota_at: null, updated_at: null, updated_by: null,
  scheduled_date: null, scheduled_time: null, reminder_enabled: false, reminder_dismissed: false,
  payment_due_date: null, paid_at: null, paid_by: null, created_at: "2026-10-14T15:00:00Z",
  order_items: [{ qty: 1, product_id: "p1", unit_price: 13, products: { name: "Galão 20L" } }],
};

// Pedido com cliente e nota emitida, e pedido de retirada sem cadastro.
const comNota = {
  ...base, id: "bbbb0001-0000-0000-0000-000000000000",
  customers: { id: "c-ana", name: "Ana Souza", phone: null, cnpj: null, type: "PF" },
  addresses: { street: "Rua A", number: "1", neighborhood: "Centro", city: "Santo André", complement: null },
  invoices: [{ id: "i1", status: "autorizada", numero: 10, serie: 2, environment: 1, message: null, created_at: "2026-10-14T16:00:00Z" }],
};
const retirada = {
  ...base, id: "bbbb0002-0000-0000-0000-000000000000", fulfillment_type: "pickup",
  customers: null, addresses: null, invoices: [],
};

const marcos = {
  id: "c-marcos", name: "Marcos Lima", phone: "11999990000", cnpj: null, cpf: null, type: "PF",
  email: null, created_at: "2026-10-16T12:00:00Z", addresses: [],
};

const linkOrderCustomer = vi.fn(async (_orderId: string, customerId: string | null) => ({
  customer: customerId ? { id: marcos.id, name: marcos.name, phone: marcos.phone, cnpj: null, type: "PF" } : null,
}));

vi.mock("@/services/admin-api", () => ({
  adminApi: new Proxy({}, {
    get: (_t, name) => {
      if (name === "listOrders") return async () => ({ rows: [comNota, retirada], total: 2, page: 0, pageSize: 200 });
      if (name === "checkInvoice") return async () => ({ problems: [], environment: 1, fixes: { prices: [], products: [], customer: null, address: null } });
      if (name === "listRiders") return async () => [];
      if (name === "listProducts") return async () => ({ products: [] });
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
Element.prototype.hasPointerCapture ??= () => false;
Element.prototype.releasePointerCapture ??= () => {};
Element.prototype.scrollIntoView ??= () => {};

import { OrdersTab } from "@/components/admin/OrdersTab";

const clienteLine = (text: string) =>
  screen.findByText((_, el) => el?.tagName === "P" && el.textContent === `Cliente: ${text}`);

async function openDetail(index: number) {
  render(<MemoryRouter><OrdersTab /></MemoryRouter>);
  await screen.findByText("2 pedidos encontrados", {}, { timeout: 2000 });
  fireEvent.click(screen.getAllByTitle("Detalhes")[index]);
}

async function pickMarcos(dialogName: string) {
  const modal = screen.getByRole("dialog", { name: dialogName });
  fireEvent.change(within(modal).getByPlaceholderText("Nome, telefone ou rua do cliente"), { target: { value: "Marcos" } });
  fireEvent.click(await within(modal).findByRole("button", { name: "Vincular" }, { timeout: 2000 }));
}

describe("cliente de qualquer pedido", () => {
  beforeEach(() => linkOrderCustomer.mockClear());

  it("retirada sem cadastro ganha cliente pelo botão ao lado de Cliente", async () => {
    await openDetail(1);
    await clienteLine("Retirada / Sem cadastro");
    fireEvent.click(screen.getByRole("button", { name: "Vincular" }));
    await pickMarcos("Vincular cliente ao pedido");

    expect(linkOrderCustomer).toHaveBeenCalledWith(retirada.id, "c-marcos");
    expect(await clienteLine("Marcos Lima")).toBeInTheDocument();
  });

  it("pedido com nota emitida pode trocar de cliente, com aviso", async () => {
    await openDetail(0);
    await clienteLine("Ana Souza");
    fireEvent.click(screen.getByRole("button", { name: "Trocar" }));
    expect(screen.getByText(/A nota não muda/)).toBeInTheDocument();
    await pickMarcos("Trocar cliente do pedido");

    expect(linkOrderCustomer).toHaveBeenCalledWith(comNota.id, "c-marcos");
    expect(await clienteLine("Marcos Lima")).toBeInTheDocument();
  });

  it("remove o cliente do pedido", async () => {
    await openDetail(0);
    await clienteLine("Ana Souza");
    fireEvent.click(screen.getByRole("button", { name: "Trocar" }));
    fireEvent.click(screen.getByRole("button", { name: "Remover cliente" }));

    expect(linkOrderCustomer).toHaveBeenCalledWith(comNota.id, null);
    expect(await clienteLine("Retirada / Sem cadastro")).toBeInTheDocument();
  });

  it("na edição do pedido, troca o cliente sem perder o que já foi digitado", async () => {
    render(<MemoryRouter><OrdersTab /></MemoryRouter>);
    await screen.findByText("2 pedidos encontrados", {}, { timeout: 2000 });
    fireEvent.click(screen.getAllByTitle("Editar")[1]);

    const edit = await screen.findByRole("dialog", { name: /Editar Pedido/ });
    const notes = edit.querySelector("textarea")!;
    fireEvent.change(notes, { target: { value: "Cliente pediu nota depois" } });
    expect(within(edit).getByText("Sem cadastro")).toBeInTheDocument();

    fireEvent.click(within(edit).getByRole("button", { name: "Vincular" }));
    await pickMarcos("Vincular cliente ao pedido");

    expect(linkOrderCustomer).toHaveBeenCalledWith(retirada.id, "c-marcos");
    expect(await within(edit).findByText("Marcos Lima")).toBeInTheDocument();
    expect(notes.value).toBe("Cliente pediu nota depois");
  });
});
