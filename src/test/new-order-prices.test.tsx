import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const listProducts = vi.fn();
const createAdminOrder = vi.fn();
const searchCustomers = vi.fn();

vi.mock("@/services/admin-api", () => ({
  adminApi: {
    listProducts: (...args: unknown[]) => listProducts(...args),
    createAdminOrder: (...args: unknown[]) => createAdminOrder(...args),
    searchCustomers: (...args: unknown[]) => searchCustomers(...args),
  },
}));
vi.mock("@/hooks/use-analytics", () => ({ trackEvent: vi.fn() }));

// Radix (Switch, Select) mede elementos com ResizeObserver, que o jsdom não tem.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

import { NewOrderTab } from "@/components/admin/NewOrderTab";

const product = (id: string, name: string, price: number | null, models: Record<string, number | null> = {}) => ({
  id, name, price, price_text: price != null ? String(price) : "Consulte no WhatsApp",
  price_porta: null, price_entrega: price, price_shopping: null, price_empresa: null, ...models,
  description: null, type: "varejo", icon: null, active: true, created_at: "", stock_qty: 0,
  min_stock_qty: 0, track_stock: false, category_id: null, show_in_quick_order: false, image_url: null,
  ncm: null, cest: null, cfop: null, cst_csosn: null, pis_cofins_cst: null, origem: 0, unidade: "UN", tax_group: null,
});

function renderTab() {
  return render(<MemoryRouter><NewOrderTab /></MemoryRouter>);
}

async function addOne(name: string) {
  const qty = await screen.findByLabelText(`Quantidade de ${name}`);
  fireEvent.click(within(qty.parentElement as HTMLElement).getByLabelText("Aumentar"));
}

describe("Novo pedido: preço por item", () => {
  beforeEach(() => {
    listProducts.mockResolvedValue({
      products: [
        product("fardo", "Fardo Crystal", 13, { price_shopping: 11, price_porta: 12 }),
        product("galao", "Galão crystal 20L", null),
      ],
      categories: [],
      tiers: [],
    });
    createAdminOrder.mockReset().mockResolvedValue({ order_id: "abcdef1234", customer_id: null });
    searchCustomers.mockReset().mockResolvedValue([]);
  });

  it("usa o preço do cadastro, avisa item sem preço e soma tudo", async () => {
    renderTab();
    await addOne("Fardo Crystal");
    await addOne("Fardo Crystal");

    expect(screen.getByLabelText("Preço unitário de Fardo Crystal")).toHaveValue("13");
    expect(screen.getByText(/26,00/)).toBeInTheDocument();

    await addOne("Galão crystal 20L");
    expect(screen.getByText(/1 item está sem preço/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Preço unitário de Galão crystal 20L"), { target: { value: "15,50" } });
    expect(screen.getByText(/41,50/)).toBeInTheDocument();
    expect(screen.queryByText(/sem preço/)).not.toBeInTheDocument();
  });

  it("manda o preço de cada item e o total calculado", async () => {
    renderTab();
    await addOne("Fardo Crystal");
    await addOne("Galão crystal 20L");
    fireEvent.change(screen.getByLabelText("Preço unitário de Galão crystal 20L"), { target: { value: "15" } });

    fireEvent.click(screen.getByRole("button", { name: /Salvar pedido/ }));

    await waitFor(() => expect(createAdminOrder).toHaveBeenCalled());
    const payload = createAdminOrder.mock.calls[0][0];
    expect(payload.items).toEqual([
      { product_id: "fardo", qty: 1, unit_price: 13 },
      { product_id: "galao", qty: 1, unit_price: 15 },
    ]);
    expect(payload.total_amount).toBe(28);
  });

  it("total digitado à mão vira desconto sobre a soma", async () => {
    renderTab();
    await addOne("Fardo Crystal");
    await addOne("Fardo Crystal");

    fireEvent.click(screen.getByRole("button", { name: /PIX/ }));
    // O Label do total não tem htmlFor; o input é o irmão dele.
    const total = screen.getByText(/Valor total do pedido/).parentElement!.querySelector("input") as HTMLInputElement;
    expect(total.value).toBe("26.00");

    fireEvent.change(total, { target: { value: "24" } });
    expect(screen.getByText(/Desconto de R\$\s2,00/)).toBeInTheDocument();
  });

  it("cliente sem telefone escolhido na busca fica no pedido, com o endereço e o CEP do cadastro", async () => {
    searchCustomers.mockResolvedValue([{
      id: "cvc", name: "CVC ATRIUM", phone: null, type: "PJ", cnpj: "11.763.247/0001-86", email: null, created_at: "",
      addresses: [{
        id: "end1", street: "Rua Giovanni Battista Pirelli", number: "155", neighborhood: "Vila Homero Thon",
        city: "Santo André", state: "SP", complement: "Luc 235", zip: "09111340", ibge_code: "3547809", reference: null, is_primary: true,
      }],
    }]);
    renderTab();
    fireEvent.change(screen.getByPlaceholderText("Nome ou telefone..."), { target: { value: "CVC" } });
    fireEvent.click(await screen.findByText("CVC ATRIUM", {}, { timeout: 2000 }));
    expect(screen.getByDisplayValue("09111-340")).toBeInTheDocument();

    await addOne("Fardo Crystal");
    fireEvent.click(screen.getByRole("button", { name: /Salvar pedido/ }));

    await waitFor(() => expect(createAdminOrder).toHaveBeenCalled());
    const payload = createAdminOrder.mock.calls[0][0];
    expect(payload.customer_id).toBe("cvc");
    expect(payload.address_id).toBe("end1");
    expect(payload.address).toMatchObject({ zip: "09111340", ibge_code: "3547809" });
  });

  it("trocar o modelo de preço refaz o preço dos itens", async () => {
    renderTab();
    await addOne("Fardo Crystal");
    expect(screen.getByLabelText("Preço unitário de Fardo Crystal")).toHaveValue("13");

    fireEvent.click(screen.getByRole("button", { name: "Shopping" }));
    expect(screen.getByLabelText("Preço unitário de Fardo Crystal")).toHaveValue("11");

    fireEvent.click(screen.getByRole("button", { name: "Empresa" }));
    expect(screen.getByLabelText("Preço unitário de Fardo Crystal")).toHaveValue("");
    expect(screen.getByText(/1 item está sem preço/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Shopping" }));
    fireEvent.click(screen.getByRole("button", { name: /Salvar pedido/ }));
    await waitFor(() => expect(createAdminOrder).toHaveBeenCalled());
    expect(createAdminOrder.mock.calls[0][0]).toMatchObject({
      price_model: "shopping",
      items: [{ product_id: "fardo", qty: 1, unit_price: 11 }],
    });
  });

  it("cliente com modelo padrão já traz o preço desse modelo", async () => {
    searchCustomers.mockResolvedValue([{
      id: "loja", name: "CENTAURO GOLDEN", phone: "11999990000", type: "PJ", cnpj: null, email: null, created_at: "",
      price_model: "shopping", addresses: [],
    }]);
    renderTab();
    await addOne("Fardo Crystal");
    fireEvent.change(screen.getByPlaceholderText("Nome ou telefone..."), { target: { value: "CENT" } });
    fireEvent.click(await screen.findByText("CENTAURO GOLDEN", {}, { timeout: 2000 }));

    expect(await screen.findByText("Padrão do cliente: Shopping.")).toBeInTheDocument();
    expect(screen.getByLabelText("Preço unitário de Fardo Crystal")).toHaveValue("11");
  });
});
