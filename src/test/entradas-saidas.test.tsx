import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";

const getFinance = vi.fn();
const saveFinanceEntry = vi.fn();
const deleteFinanceEntry = vi.fn();

vi.mock("@/services/admin-api", () => ({
  adminApi: {
    getFinance: (...a: unknown[]) => getFinance(...a),
    saveFinanceEntry: (...a: unknown[]) => saveFinanceEntry(...a),
    deleteFinanceEntry: (...a: unknown[]) => deleteFinanceEntry(...a),
  },
}));

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;
Element.prototype.scrollIntoView ??= () => {};
Element.prototype.hasPointerCapture ??= () => false;

import { FinanceReport } from "@/components/admin/FinanceReport";

describe("Entradas e saídas", () => {
  beforeEach(() => {
    getFinance.mockReset();
    saveFinanceEntry.mockReset();
    getFinance.mockResolvedValue({
      sales: 12000,
      entries: [
        { id: "e1", kind: "saida", category: "combustivel", description: "Posto", amount: 450, entry_date: "2026-11-03", created_by: "kauan", created_at: "" },
        { id: "e2", kind: "saida", category: "aluguel", description: null, amount: 2500, entry_date: "2026-11-01", created_by: "kauan", created_at: "" },
      ],
    });
    saveFinanceEntry.mockResolvedValue({ ok: true });
  });

  it("mostra o balanço do período", async () => {
    render(<FinanceReport />);
    expect(await screen.findAllByText(/R\$\s*12\.000,00/)).toHaveLength(2);
    expect(screen.getByText(/R\$\s*2\.950,00/)).toBeInTheDocument();
    expect(screen.getByText(/R\$\s*9\.050,00/)).toBeInTheDocument();
    expect(screen.getAllByText("Combustível").length).toBeGreaterThan(0);
  });

  it("lança um gasto com valor em reais", async () => {
    render(<FinanceReport />);
    await screen.findByText(/R\$\s*9\.050,00/);

    const trigger = screen.getAllByRole("combobox").find((el) => el.textContent?.includes("Escolha"))!;
    fireEvent.keyDown(trigger, { key: "Enter" });
    fireEvent.click(within(await screen.findByRole("listbox")).getByText("Fornecedor (mercadoria)"));
    fireEvent.change(screen.getByPlaceholderText("0,00"), { target: { value: "1.234,50" } });
    fireEvent.change(screen.getByPlaceholderText("Ex.: 200 galões Crystal"), { target: { value: "200 galões" } });
    fireEvent.click(screen.getByRole("button", { name: "Lançar" }));

    await waitFor(() => expect(saveFinanceEntry).toHaveBeenCalledWith(expect.objectContaining({
      kind: "saida", category: "fornecedor", amount: 1234.5, description: "200 galões",
    })));
    expect(getFinance).toHaveBeenCalledTimes(2);
  });
});
