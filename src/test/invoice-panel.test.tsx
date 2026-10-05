import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const checkInvoice = vi.fn();
const emitInvoice = vi.fn();
const previewInvoice = vi.fn();
const fixInvoiceData = vi.fn();

vi.mock("@/services/admin-api", () => ({
  adminApi: {
    checkInvoice: (...a: unknown[]) => checkInvoice(...a),
    emitInvoice: (...a: unknown[]) => emitInvoice(...a),
    previewInvoice: (...a: unknown[]) => previewInvoice(...a),
    fixInvoiceData: (...a: unknown[]) => fixInvoiceData(...a),
  },
}));

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

import { InvoicePanel } from "@/components/admin/InvoicePanel";

const authorized = {
  id: "inv1", order_id: "ord1", status: "autorizada", numero: 123, serie: 1, environment: 2,
  chave: "3526...", protocolo: "1", sefaz_code: 100, message: null, total: 30, correction_seq: 0,
  created_at: "2026-10-05T12:00:00Z", updated_at: "2026-10-05T12:00:00Z", authorized_at: "2026-10-05T12:00:00Z", cancelled_at: null,
};

describe("Painel da nota fiscal", () => {
  beforeEach(() => {
    checkInvoice.mockReset();
    emitInvoice.mockReset();
  });

  it("mostra o que falta e não deixa emitir", async () => {
    checkInvoice.mockResolvedValue({ problems: ["Falta o CPF de Maria."], environment: 2 });
    render(<InvoicePanel orderId="ord1" invoices={[]} onChange={() => {}} />);
    expect(await screen.findByText("Falta o CPF de Maria.")).toBeInTheDocument();
    expect(screen.getByText(/Homologação/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Emitir nota fiscal/ })).toBeDisabled();
  });

  it("emite e devolve a nota autorizada para o pedido", async () => {
    checkInvoice.mockResolvedValue({ problems: [], environment: 2 });
    emitInvoice.mockResolvedValue({ invoice: authorized });
    const onChange = vi.fn();
    render(<InvoicePanel orderId="ord1" invoices={[]} onChange={onChange} />);

    const button = await screen.findByRole("button", { name: /Emitir nota fiscal/ });
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);

    await waitFor(() => expect(onChange).toHaveBeenCalledWith(authorized));
    expect(await screen.findByRole("button", { name: /DANFE/ })).toBeInTheDocument();
    expect(screen.getByText(/Nº 123, série 1/)).toBeInTheDocument();
  });

  it("nota recusada mostra o motivo e permite emitir de novo", async () => {
    checkInvoice.mockResolvedValue({ problems: [], environment: 2 });
    render(
      <InvoicePanel
        orderId="ord1"
        invoices={[{ ...authorized, status: "erro", numero: null, message: "539: Rejeição: duplicidade" } as never]}
        onChange={() => {}}
      />,
    );
    expect(screen.getByText("539: Rejeição: duplicidade")).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: /Emitir de novo/ })).toBeInTheDocument();
  });

  it("nota de teste autorizada não trava a nota real em produção", async () => {
    checkInvoice.mockResolvedValue({ problems: [], environment: 1 });
    render(<InvoicePanel orderId="ord1" invoices={[authorized as never]} onChange={() => {}} />);
    expect(await screen.findByRole("button", { name: /Emitir de novo/ })).toBeInTheDocument();
    expect(screen.queryByText(/Homologação/)).not.toBeInTheDocument();
  });

  it("pré-visualizar baixa o PDF sem emitir a nota", async () => {
    checkInvoice.mockResolvedValue({ problems: [], environment: 2 });
    previewInvoice.mockResolvedValue({ base64: btoa("%PDF-1.4"), filename: "previa.pdf" });
    const createObjectURL = vi.fn(() => "blob:x");
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = vi.fn();
    const onChange = vi.fn();
    render(<InvoicePanel orderId="ord1" invoices={[]} onChange={onChange} />);

    const button = await screen.findByRole("button", { name: /Pré-visualizar/ });
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);

    await waitFor(() => expect(createObjectURL).toHaveBeenCalled());
    expect(previewInvoice).toHaveBeenCalledWith("ord1", "");
    expect(emitInvoice).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("completar agora sugere o padrão das notas, grava e confere de novo", async () => {
    checkInvoice
      .mockResolvedValueOnce({
        problems: ["Fardo: falta o NCM no cadastro do produto.", "CVC: é contribuinte de ICMS e está sem inscrição estadual."],
        environment: 2,
        fixes: {
          products: [{ id: "p1", name: "Fardo", ncm: null, cest: null, cfop: null, cstCsosn: null, pisCofinsCst: null, origem: 0, taxGroup: null }],
          customer: { id: "c1", name: "CVC", type: "PJ", cpf: null, cnpj: "11763247000186", ie: null, ieIndicator: 1, needs: ["ie"] },
          address: null,
        },
      })
      .mockResolvedValueOnce({ problems: [], environment: 2, fixes: { products: [], customer: null, address: null } });
    fixInvoiceData.mockResolvedValue({ ok: true });
    render(<InvoicePanel orderId="ord1" invoices={[]} onChange={() => {}} />);

    await screen.findByText("Completar agora");
    expect(screen.getByDisplayValue("5102")).toBeInTheDocument();
    expect(screen.getByDisplayValue("102")).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText("8 dígitos"), { target: { value: "2201.90.00" } });
    fireEvent.click(screen.getByText("Não tem (isento)"));
    fireEvent.click(screen.getByRole("button", { name: /Salvar e conferir de novo/ }));

    await waitFor(() => expect(fixInvoiceData).toHaveBeenCalled());
    expect(fixInvoiceData.mock.calls[0][0]).toEqual({
      orderId: "ord1",
      prices: [],
      products: [{ id: "p1", ncm: "22019000", cest: "", cfop: "5102", cst_csosn: "102", pis_cofins_cst: "49", origem: 0 }],
      customer: { id: "c1", ie: "", ie_indicator: 2 },
      address: undefined,
    });
    await waitFor(() => expect(checkInvoice).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByText("Completar agora")).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: /Emitir nota fiscal/ })).toBeEnabled();
  });
});
