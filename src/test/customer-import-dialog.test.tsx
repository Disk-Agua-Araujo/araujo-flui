import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const importCustomers = vi.fn();

vi.mock("@/services/admin-api", () => ({
  adminApi: { importCustomers: (...args: unknown[]) => importCustomers(...args) },
}));

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

// O File do jsdom não tem arrayBuffer(), que todo navegador tem.
Blob.prototype.arrayBuffer ??= function (this: Blob) {
  return new Promise<ArrayBuffer>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.readAsArrayBuffer(this);
  });
};

import { CustomerImportDialog } from "@/components/admin/CustomerImportDialog";

const csv = [
  "Nome;Celular;CPF/CNPJ;Endereço;Bairro;Cidade",
  "Maria Silva;(11) 98888-7777;529.982.247-25;Rua A, 10;Centro;Santo André",
  "Mercado Bom;11 4444-5555;11.222.333/0001-81;Av. B, 200 - loja 2;Vila;Santo André",
  "Maria S.;11988887777;;;;",
].join("\n");

describe("Importar clientes de planilha", () => {
  it("lê o CSV, confere sem gravar e só grava ao confirmar", async () => {
    importCustomers.mockImplementation(async (rows: unknown[], dryRun: boolean) => ({
      results: rows.map((_, index) => ({ index, action: index === 0 ? "update" : "insert", address: "nova" })),
      dryRun,
    }));
    const onImported = vi.fn();
    render(<CustomerImportDialog open onOpenChange={() => {}} onImported={onImported} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File([csv], "clientes.csv", { type: "text/csv" })] } });

    await screen.findByText(/clientes\.csv/);
    expect(screen.getByText("Ex.: Maria Silva")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Conferir/ }));
    await screen.findByText(/nada foi gravado ainda/);

    // A terceira linha repete o telefone da primeira e não é enviada.
    const [rows, dryRun] = importCustomers.mock.calls[0];
    expect(dryRun).toBe(true);
    expect(rows).toHaveLength(2);
    expect(rows[1]).toMatchObject({
      name: "Mercado Bom",
      cnpj: "11222333000181",
      address: { street: "Av. B", number: "200", complement: "loja 2" },
    });
    expect(screen.getByText("1 novos")).toBeInTheDocument();
    expect(screen.getByText("1 completados")).toBeInTheDocument();
    expect(screen.getByText(/Repetida da linha 2/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Importar 2 clientes/ }));
    await screen.findByText(/Importação concluída/);
    expect(importCustomers.mock.calls[1][1]).toBe(false);
    await waitFor(() => expect(onImported).toHaveBeenCalled());
  });
});
