import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const checkInvoice = vi.fn();
const emitInvoice = vi.fn();

vi.mock("@/services/admin-api", () => ({
  adminApi: {
    checkInvoice: (...a: unknown[]) => checkInvoice(...a),
    emitInvoice: (...a: unknown[]) => emitInvoice(...a),
  },
}));

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
});
