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

  it("repetida é o mesmo documento, ou o mesmo nome com o mesmo telefone", () => {
    const data = [
      ["Nome", "Telefone", "CPF"],
      ["Ana", "(11) 99999-0000", ""],
      ["ana", "11999990000", ""],
      ["Lupo ABC", "11973860774", ""],
      ["Santa Lolla ABC", "11973860774", ""],
      ["Maria", "", "529.982.247-25"],
      ["Maria S.", "", "52998224725"],
    ];
    const rows = prepareRows(data, 0, { name: 0, phone: 1, cpf: 2 });
    expect(rows.map((r) => r.duplicateOf)).toEqual([undefined, 2, undefined, undefined, undefined, 6]);
  });

  it("export do Bling: fantasia como nome, razão social, pula o que não é cliente e descarta IE estragada", async () => {
    const tsv = [
      ["Código", "Nome", "Fantasia", "Endereço", "Número", "Bairro", "CEP", "Cidade", "UF", "Fone", "Celular",
        "E-mail", "Tipo pessoa", "CNPJ / CPF", "IE / RG", "IE isento", "Situação", "Observações", "Tipo contato", "E-mail para envio NFe"],
      ["", "LOJA EXEMPLO LTDA", "EXEMPLO GP", "AVENIDA INDUSTRIAL", "600", "JARDIM", "9080500", "SANTO ANDRE", "SP", "", "(11) 90000-0001",
        "loja@ex.com", "Pessoa Jurídica", "11.222.333/0001-81", "6,26714E+11", "N", "Ativo", "02 GALÕES EM CONSIGNAÇÃO", "Cliente", "nfe@ex.com"],
      ["", "AGENCIA ISENTA LTDA", "AGENCIA GOLDEN", "", "", "", "", "", "", "", "", "", "Pessoa Jurídica", "", "ISENTO", "S", "Ativo", "", "Cliente", ""],
      ["", "VAZIO", "", "", "", "", "", "", "", "", "", "", "Pessoa Física", "", "", "N", "Ativo", "", "Cliente", ""],
      ["", "FORNECEDOR SA", "", "", "", "", "", "", "", "", "", "", "Pessoa Jurídica", "", "", "N", "Ativo", "", "Fornecedor", ""],
      ["", "LOJA ANTIGA", "LOJA ANTIGA", "", "", "", "", "", "", "", "", "", "Pessoa Jurídica", "", "", "N", "Excluído", "", "Cliente", ""],
    ].map((r) => r.join("\t")).join("\r\n");

    const data = await readSheet(new File([tsv], "contatos.csv"));
    const mapping = guessMapping(data[0]);
    expect(mapping).toMatchObject({ name: 2, legal_name: 1, phone: 10, phone2: 9, cpf: 13, ie: 14, ie_exempt: 15, email: 19, notes: 17, status: 16, contact_type: 18 });

    const rows = prepareRows(data, 0, mapping);
    expect(rows[0].row).toMatchObject({
      name: "EXEMPLO GP",
      legal_name: "LOJA EXEMPLO LTDA",
      type: "PJ",
      cnpj: "11222333000181",
      ie_exempt: false,
      email: "nfe@ex.com",
      notes: "02 GALÕES EM CONSIGNAÇÃO",
      address: { street: "AVENIDA INDUSTRIAL", number: "600", zip: "09080500" },
    });
    expect(rows[0].row.ie).toBeUndefined();
    expect(rows[0].warnings[0]).toMatch(/estragada pelo Excel/);
    expect(rows[1].row).toMatchObject({ name: "AGENCIA GOLDEN", ie: "ISENTO", ie_exempt: true });
    expect(rows.slice(2).map((r) => r.skipped)).toEqual([
      "Linha de atalho do sistema antigo, não é cliente.",
      "Cadastrado como fornecedor, não como cliente.",
      "Contato excluído na planilha.",
    ]);
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
