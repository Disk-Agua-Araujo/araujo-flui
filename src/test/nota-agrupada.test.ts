import { describe, it, expect } from "vitest";
import { buildNfePayload, checkNfe, mergeGroupOrders, type NfeGroupOrder, type NfeInput } from "../../supabase/functions/_shared/nfe";

const item = (over: Partial<NfeInput["items"][number]> = {}): NfeInput["items"][number] => ({
  productId: "a1b2c3d4-0000-0000-0000-000000000000",
  name: "Galão Crystal 20L",
  qty: 2,
  unitPrice: 15,
  ncm: "22011000",
  cest: "0300400",
  cfop: "5405",
  cstCsosn: "500",
  pisCofinsCst: "49",
  origem: 0,
  unidade: "UN",
  taxGroup: null,
  ...over,
});

const pix = { method: "pix", method2: null, amount1: null, amount2: null, isSplit: false, dueDate: null, paidAt: null };

const order = (id: string, over: Partial<NfeGroupOrder> = {}): NfeGroupOrder => ({
  id,
  fulfillmentType: "delivery",
  totalAmount: 30,
  payment: pix,
  items: [item()],
  ...over,
});

const groupInput = (orders: NfeGroupOrder[]): NfeInput => ({
  orderId: "77777777-aaaa-bbbb-cccc-000000000000",
  channel: "agrupado",
  payment: { ...pix, method: null },
  customer: { name: "Loja Bresser", type: "PJ", cpf: null, cnpj: "11222333000181", ie: null, ieIndicator: 9, email: null, phone: null },
  address: { street: "Rua Bresser", number: "33", neighborhood: "Brás", city: "São Paulo", state: "SP", zip: "03017000", complement: null, ibge: "3550308" },
  ...mergeGroupOrders(orders),
});

describe("nota agrupada", () => {
  it("soma o mesmo produto pelo mesmo preço e separa preço diferente", () => {
    const m = mergeGroupOrders([
      order("aaaaaaaa-1"),
      order("bbbbbbbb-2", { items: [item({ qty: 3 })], totalAmount: 45 }),
      order("cccccccc-3", { items: [item({ qty: 1, unitPrice: 14 })], totalAmount: 14 }),
    ]);
    expect(m.items.map((i) => [i.qty, i.unitPrice])).toEqual([[5, 15], [1, 14]]);
    expect(m.totalAmount).toBe(89);
    expect(m.orderCodes).toEqual(["AAAAAAAA", "BBBBBBBB", "CCCCCCCC"]);
  });

  it("não mexe nos itens dos pedidos originais", () => {
    const a = order("aaaaaaaa-1");
    mergeGroupOrders([a, order("bbbbbbbb-2")]);
    expect(a.items[0].qty).toBe(2);
  });

  it("soma o pagamento por forma e o a prazo em aberto vira crediário", () => {
    const m = mergeGroupOrders([
      order("aaaaaaaa-1"),
      order("bbbbbbbb-2"),
      order("cccccccc-3", { payment: { ...pix, method: "cash", dueDate: "2026-11-10" } }),
      order("dddddddd-4", { payment: { ...pix, method: "pix", method2: "cash", amount1: 10, amount2: 20, isSplit: true } }),
    ]);
    expect(m.payments).toEqual([
      { method: "pix", value: 70, aPrazo: false },
      { method: null, value: 30, aPrazo: true },
      { method: "cash", value: 20, aPrazo: false },
    ]);

    const p = buildNfePayload(groupInput([
      order("aaaaaaaa-1"),
      order("cccccccc-3", { payment: { ...pix, method: "cash", dueDate: "2026-11-10" } }),
    ]), 1) as any;
    expect(p.Pagamentos).toEqual([
      { IndicadorPagamento: 0, FormaPagamento: "20", VlPago: 30 },
      { IndicadorPagamento: 1, FormaPagamento: "05", VlPago: 30 },
    ]);
  });

  it("a nota leva os códigos dos pedidos e o desconto de cada um", () => {
    const p = buildNfePayload(groupInput([order("aaaaaaaa-1", { totalAmount: 28 }), order("bbbbbbbb-2")]), 1) as any;
    expect(p.Observacao).toContain("Nota referente a 2 pedidos: AAAAAAAA, BBBBBBBB");
    expect(p.IdentificadorInterno).toBe("77777777-aaaa-bbbb-cccc-000000000000");
    expect(p.Produtos).toHaveLength(1);
    expect(p.Produtos[0].Quantidade).toBe(4);
    expect(p.Produtos[0].ValorDesconto).toBe(2);
    expect(p.Pagamentos.reduce((s: number, x: any) => s + x.VlPago, 0)).toBe(58);
    expect(p.IndicadorPresenca).toBe(9);
  });

  it("item sem preço aponta o pedido para completar", () => {
    const problems = checkNfe(groupInput([order("aaaaaaaa-1"), order("bbbbbbbb-2", { items: [item({ unitPrice: null })], totalAmount: null })]));
    expect(problems).toContain("Galão Crystal 20L (pedido BBBBBBBB): sem preço no pedido.");
  });

  it("só retirada vira nota sem transporte", () => {
    expect(mergeGroupOrders([order("a", { fulfillmentType: "pickup" }), order("b", { fulfillmentType: "pickup" })]).fulfillmentType).toBe("pickup");
    expect(mergeGroupOrders([order("a", { fulfillmentType: "pickup" }), order("b")]).fulfillmentType).toBe("delivery");
  });
});
