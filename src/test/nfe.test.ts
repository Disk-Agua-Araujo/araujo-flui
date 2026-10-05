import { describe, it, expect } from "vitest";
import { buildNfePayload, checkNfe, describeNfeError, HOMOLOGACAO_NOME, type NfeInput } from "../../supabase/functions/_shared/nfe";

const item = (over: Partial<NfeInput["items"][number]> = {}): NfeInput["items"][number] => ({
  productId: "a1b2c3d4-0000-0000-0000-000000000000",
  name: "Galão Crystal 20L",
  qty: 2,
  unitPrice: 15,
  ncm: "22011000",
  cest: "0300400",
  cfop: "5405",
  cstCsosn: "500",
  origem: 0,
  unidade: "UN",
  taxGroup: null,
  ...over,
});

const base = (over: Partial<NfeInput> = {}): NfeInput => ({
  orderId: "9f86d081-884c-7d65-9a2f-eaa0c55ad015",
  channel: "whatsapp",
  fulfillmentType: "delivery",
  totalAmount: 30,
  payment: { method: "pix", method2: null, amount1: null, amount2: null, isSplit: false, dueDate: null, paidAt: null },
  customer: { name: "Maria Silva", type: "PF", cpf: "52998224725", cnpj: null, ie: null, ieIndicator: null, email: null, phone: "11988887777" },
  address: { street: "Rua A", number: "10", neighborhood: "Centro", city: "Santo André", state: "SP", zip: "09015000", complement: null, ibge: "3547809" },
  items: [item()],
  ...over,
});

describe("checkNfe", () => {
  it("pedido completo não tem pendência", () => {
    expect(checkNfe(base())).toEqual([]);
  });

  it("aponta o que falta em linguagem de balcão", () => {
    const problems = checkNfe(base({
      customer: { ...base().customer!, cpf: null },
      address: { ...base().address!, zip: null },
      items: [item({ unitPrice: null, ncm: null, cfop: null })],
    }));
    expect(problems).toEqual([
      "Falta o CPF de Maria Silva. Preencha no cadastro do cliente.",
      "Falta o CEP do endereço.",
      "Galão Crystal 20L: sem preço no pedido.",
      "Galão Crystal 20L: falta o NCM no cadastro do produto.",
      "Galão Crystal 20L: falta a tributação (grupo tributário, ou CFOP e CST) no cadastro do produto.",
    ]);
    expect(checkNfe(base({ totalAmount: 0 }))).toEqual(["O pedido está sem valor."]);
  });

  it("grupo tributário dispensa CFOP e CST", () => {
    expect(checkNfe(base({ items: [item({ cfop: null, cstCsosn: null, taxGroup: "AGUA" })] }))).toEqual([]);
  });
});

describe("buildNfePayload", () => {
  it("monta cliente PF, item e pagamento Pix", () => {
    const p = buildNfePayload(base(), 2) as any;
    expect(p).toMatchObject({
      TipoAmbiente: 2,
      ModeloDocumento: 55,
      IndicadorPresenca: 3,
      ConsumidorFinal: true,
      IdentificadorInterno: "9f86d081-884c-7d65-9a2f-eaa0c55ad015",
      Cliente: { CpfCnpj: "52998224725", IndicadorIe: 9, Endereco: { CodMunicipio: "3547809", Cep: "09015000" } },
      Pagamentos: [{ IndicadorPagamento: 0, FormaPagamento: "20", VlPago: 30 }],
      Transporte: { ModalidadeFrete: 3 },
    });
    expect(p.Produtos[0]).toMatchObject({
      NCM: "22011000", CEST: "0300400", CFOP: 5405, Quantidade: 2, ValorUnitario: 15, ValorTotal: 30,
      Imposto: { ICMS: { CodSituacaoTributaria: "500" } },
    });
  });

  it("rateia o desconto pelos itens e a soma fecha no centavo", () => {
    const p = buildNfePayload(base({
      totalAmount: 40,
      items: [item({ qty: 1, unitPrice: 13 }), item({ qty: 1, unitPrice: 15.5 }), item({ qty: 1, unitPrice: 13 })],
    }), 2) as any;
    const discounts = p.Produtos.map((x: any) => x.ValorDesconto ?? 0);
    const totalDiscount = Math.round(discounts.reduce((s: number, d: number) => s + d, 0) * 100);
    expect(totalDiscount).toBe(150);
  });

  it("total acima da soma vira outras despesas no último item", () => {
    const p = buildNfePayload(base({ totalAmount: 32 }), 2) as any;
    expect(p.Produtos[0].ValorOutrasDespesas).toBe(2);
  });

  it("empresa contribuinte manda IE e não é consumidor final", () => {
    const p = buildNfePayload(base({
      customer: { name: "Mercado Bom", type: "PJ", cpf: null, cnpj: "11.222.333/0001-81", ie: "123.456.789.110", ieIndicator: 1, email: "a@b.com", phone: null },
    }), 1) as any;
    expect(p.Cliente).toMatchObject({ CpfCnpj: "11222333000181", IndicadorIe: 1, Ie: "123456789110" });
    expect(p.ConsumidorFinal).toBe(false);
    expect(p.EnviarEmail).toBe(true);
  });

  it("pagamento dividido gera duas formas; a prazo vira crediário", () => {
    const split = buildNfePayload(base({
      payment: { method: "cash", method2: "card", amount1: 10, amount2: 20, isSplit: true, dueDate: null, paidAt: null },
    }), 2) as any;
    expect(split.Pagamentos).toEqual([
      { IndicadorPagamento: 0, FormaPagamento: "01", VlPago: 10 },
      { IndicadorPagamento: 0, FormaPagamento: "99", VlPago: 20, Descricao: "Cartão" },
    ]);
    const prazo = buildNfePayload(base({
      payment: { method: null, method2: null, amount1: null, amount2: null, isSplit: false, dueDate: "2026-11-01", paidAt: null },
    }), 2) as any;
    expect(prazo.Pagamentos).toEqual([{ IndicadorPagamento: 1, FormaPagamento: "05", VlPago: 30 }]);
  });

  it("em homologação o destinatário leva o nome exigido pela SEFAZ; em produção, o nome real", () => {
    expect((buildNfePayload(base(), 2) as any).Cliente.NmCliente).toBe(HOMOLOGACAO_NOME);
    expect((buildNfePayload(base(), 1) as any).Cliente.NmCliente).toBe("Maria Silva");
  });

  it("retirada na loja é presencial e sem transporte", () => {
    const p = buildNfePayload(base({ fulfillmentType: "pickup" }), 2) as any;
    expect(p.IndicadorPresenca).toBe(1);
    expect(p.Transporte.ModalidadeFrete).toBe(9);
  });
});

describe("describeNfeError", () => {
  it("junta motivo da SEFAZ e erros da API", () => {
    expect(describeNfeError({
      ReturnNF: { CodStatusRespostaSefaz: 237, DsStatusRespostaSefaz: "Rejeição: CPF do destinatário inválido" },
      erros: [{ descricao: "CPF inválido.", correcao: "Confira o cadastro." }],
    })).toBe("237: Rejeição: CPF do destinatário inválido · CPF inválido. Confira o cadastro.");
  });
});
