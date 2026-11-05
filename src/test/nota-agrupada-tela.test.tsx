import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const api = {
  listGroups: vi.fn(),
  searchCustomers: vi.fn(),
  groupCandidates: vi.fn(),
  createGroup: vi.fn(),
  getGroup: vi.fn(),
  undoGroup: vi.fn(),
  checkInvoice: vi.fn(),
  emitInvoice: vi.fn(),
};

vi.mock("@/services/admin-api", () => ({
  adminApi: new Proxy({}, { get: (_t, k: string) => (...a: unknown[]) => (api as Record<string, (...x: unknown[]) => unknown>)[k](...a) }),
}));

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

import { InvoiceGroupsDialog } from "@/components/admin/InvoiceGroups";

const customer = {
  id: "c1", name: "Loja Bresser", type: "PJ", cnpj: "11.222.333/0001-81", phone: null, email: null, created_at: "",
  addresses: [{ id: "a1", street: "Rua Bresser", number: "33", neighborhood: "Brás", city: "São Paulo", state: "SP", complement: null, zip: null, reference: null, is_primary: true }],
};
const orders = [
  { id: "aaaaaaaa-1", created_at: "2026-10-08T13:00:00Z", delivered_on: "2026-10-05", linked: true, status: "entregue", total: 30, address: "bresser, 33", items: "2x Galão", a_prazo: false },
  { id: "bbbbbbbb-2", created_at: "2026-10-09T13:00:00Z", delivered_on: "2026-10-09", linked: true, status: "entregue", total: 45, address: "Bresser, 33", items: "3x Galão", a_prazo: true },
  { id: "cccccccc-3", created_at: "2026-10-16T13:00:00Z", delivered_on: "2026-10-16", linked: true, status: "entregue", total: 15, address: null, items: "1x Galão", a_prazo: false },
  { id: "dddddddd-4", created_at: "2026-10-20T13:00:00Z", delivered_on: "2026-10-20", linked: false, status: "entregue", total: 20, address: "bresser, 33 (fundos)", items: "1x Galão", a_prazo: false },
];

describe("Nota agrupada na tela", () => {
  beforeEach(() => {
    Object.values(api).forEach((f) => f.mockReset());
    api.listGroups.mockResolvedValue([]);
    api.searchCustomers.mockResolvedValue([customer]);
    api.groupCandidates.mockResolvedValue(orders);
    api.createGroup.mockResolvedValue({ id: "g1" });
    api.getGroup.mockResolvedValue({
      id: "g1", created_at: "", created_by: "kauan", address_id: "a1",
      customer: { ...customer, legal_name: "LOJA BRESSER LTDA", cpf: null },
      orders: orders.slice(0, 2), total: 75, invoices: [],
    });
    api.checkInvoice.mockResolvedValue({ problems: [], environment: 2 });
  });

  it("escolhe o cliente, desmarca um pedido, marca um sem cliente e agrupa numa nota", async () => {
    const onChanged = vi.fn();
    render(<InvoiceGroupsDialog open onOpenChange={() => {}} onChanged={onChanged} />);

    fireEvent.click(await screen.findByRole("button", { name: /Novo agrupamento/ }));
    fireEvent.change(screen.getByPlaceholderText("Nome, telefone ou rua"), { target: { value: "bresser" } });
    fireEvent.click(await screen.findByRole("button", { name: /Loja Bresser/ }));

    // Só os pedidos ligados ao cliente vêm marcados; o sem cliente fica à parte.
    expect(await screen.findByText(/R\$\s*90,00/)).toBeInTheDocument();
    expect(screen.getByText("Pedidos do cliente (3)")).toBeInTheDocument();
    expect(screen.getByText("Sem cliente, no mesmo endereço (1)")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Pedido DDDDDDDD" })).not.toBeChecked();
    // A data é a da entrega, não a do lançamento.
    expect(screen.getByText(/Entregue 05\/10\/2026 · AAAAAAAA/)).toBeInTheDocument();
    expect(api.groupCandidates).toHaveBeenCalledWith("c1", expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/), expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/));

    fireEvent.click(screen.getByRole("checkbox", { name: "Pedido CCCCCCCC" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Pedido DDDDDDDD" }));
    fireEvent.click(screen.getByRole("button", { name: "Agrupar 3 pedidos" }));

    await waitFor(() => expect(api.createGroup).toHaveBeenCalledWith({ customerId: "c1", addressId: "a1", orderIds: ["aaaaaaaa-1", "bbbbbbbb-2", "dddddddd-4"] }));
    expect(onChanged).toHaveBeenCalled();
    // Abre o agrupamento com o bloco da nota apontando para ele.
    expect(await screen.findByText("LOJA BRESSER LTDA")).toBeInTheDocument();
    await waitFor(() => expect(api.checkInvoice).toHaveBeenCalledWith({ groupId: "g1" }));
    expect(await screen.findByRole("button", { name: /Emitir nota fiscal/ })).toBeInTheDocument();
  });

  it("desfaz o agrupamento depois de confirmar", async () => {
    api.listGroups.mockResolvedValue([{ id: "g1", created_at: "", created_by: null, address_id: null, customer, orders, total: 90, invoices: [] }]);
    api.undoGroup.mockResolvedValue({ ok: true });
    const onChanged = vi.fn();
    render(<InvoiceGroupsDialog open onOpenChange={() => {}} onChanged={onChanged} />);

    fireEvent.click(await screen.findByRole("button", { name: /Loja Bresser/ }));
    fireEvent.click(await screen.findByRole("button", { name: /Desfazer agrupamento/ }));
    fireEvent.click(screen.getByRole("button", { name: "Desfazer" }));
    await waitFor(() => expect(api.undoGroup).toHaveBeenCalledWith("g1"));
    expect(onChanged).toHaveBeenCalled();
  });
});
