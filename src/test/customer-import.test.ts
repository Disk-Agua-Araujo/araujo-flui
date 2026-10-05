import { describe, it, expect } from "vitest";
import { findHeaderRow, guessMapping, prepareRows, readSheet } from "@/lib/customer-import";

// O File do jsdom não tem arrayBuffer(), que todo navegador tem.
Blob.prototype.arrayBuffer ??= function (this: Blob) {
  return new Promise<ArrayBuffer>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.readAsArrayBuffer(this);
  });
};

describe("importação de clientes", () => {
  it("acha o cabeçalho e sugere as colunas pelo nome", () => {
    const data = [
      ["Clientes da loja nova", "", ""],
      ["Nome", "Celular", "CPF/CNPJ", "Endereço", "Nº", "Bairro", "Município", "UF", "CEP", "E-mail"],
    ];
    const header = findHeaderRow(data);
    expect(header).toBe(1);
    expect(guessMapping(data[header])).toEqual({
      name: 0, phone: 1, cpf: 2, street: 3, number: 4, neighborhood: 5, city: 6, state: 7, zip: 8, email: 9,
    });
  });

  it("separa CPF de CNPJ pelo tamanho e repõe zero que o Excel apagou", () => {
    const data = [
      ["Nome", "Documento", "CEP"],
      ["Maria", "52998224725", "9015000"],
      ["Mercado Bom", "11.222.333/0001-81", "09015-000"],
      ["José", "1234567899", ""],
    ];
    const rows = prepareRows(data, 0, { name: 0, cpf: 1, zip: 2 });
    expect(rows[0].row.cpf).toBe("52998224725");
    expect(rows[1].row.cnpj).toBe("11222333000181");
    expect(rows[1].row.cpf).toBeUndefined();
    expect(rows[2].row.cpf).toBeUndefined();
    expect(rows[2].warnings[0]).toMatch(/Documento inválido/);
  });

  it("tira o número da rua quando não há coluna de número", () => {
    const data = [["Nome", "Endereço"], ["Ana", "Rua das Flores, 123 - apto 4"]];
    const [r] = prepareRows(data, 0, { name: 0, street: 1 });
    expect(r.row.address).toMatchObject({ street: "Rua das Flores", number: "123", complement: "apto 4" });
  });

  it("marca linha repetida na planilha pelo telefone ou documento", () => {
    const data = [
      ["Nome", "Telefone"],
      ["Ana", "(11) 99999-0000"],
      [""],
      ["Ana Souza", "11999990000"],
    ];
    const rows = prepareRows(data, 0, { name: 0, phone: 1 });
    expect(rows).toHaveLength(2);
    expect(rows[1].line).toBe(4);
    expect(rows[1].duplicateOf).toBe(2);
  });

  it("lê CSV em UTF-8 e no Windows-1252 do Excel sem estragar acento", async () => {
    const text = "Nome;Endereço\nJoão;Rua São Bento, 5";
    const latin1 = Uint8Array.from(text, (ch) => ch.charCodeAt(0));
    for (const content of [text, latin1]) {
      const data = await readSheet(new File([content], "clientes.csv"));
      expect(data).toEqual([["Nome", "Endereço"], ["João", "Rua São Bento, 5"]]);
    }
  });
});
