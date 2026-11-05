import { describe, it, expect } from "vitest";
import { buildNfePayload, checkNfe, deliveryDay, mergeGroupOrders, type NfeGroupOrder, type NfeInput } from "../../supabase/functions/_shared/nfe";

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
  date: "2026-10-05",
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

describe("dia da entrega", () => {
  it("usa a data de entrega, depois a escrita na observação, depois o dia do lançamento", () => {
    expect(deliveryDay({ delivery_date: "2026-10-04", notes: "ENTREGUE EM 05/10/26", created_at: "2026-10-08T13:00:00Z" })).toBe("2026-10-04");
    expect(deliveryDay({ notes: "PEDIDO ENTREGUE EM 05/10/26 - 3 galões", created_at: "2026-10-14T13:00:00Z" })).toBe("2026-10-05");
    expect(deliveryDay({ notes: "entregue 20/10/2026", created_at: "2026-10-21T13:00:00Z" })).toBe("2026-10-20");
    expect(deliveryDay({ notes: "Fazer nf", created_at: "2026-11-01T02:00:00Z" })).toBe("2026-10-31");
    expect(deliveryDay({ notes: "entregue 45/10/26", created_at: "2026-10-21T13:00:00Z" })).toBe("2026-10-21");
  });
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
    expect(m.orderLines).toHaveLength(3);
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

  it("a nota lista cada entrega como o fechamento do Disk, em ordem de data", () => {
    const p = buildNfePayload(groupInput([
      order("bbbbbbbb-2", {
        date: "2026-10-13",
        items: [item({ name: "Galão Crystal Premier 20L", qty: 3, unitPrice: 19 }), item({ productId: "copo", name: "Copo descartável 100 uni", qty: 1, unitPrice: 7 })],
        totalAmount: 64,
      }),
      order("aaaaaaaa-1", { items: [item({ name: "Galão Crystal Premier 20L", qty: 2, unitPrice: 19 })], totalAmount: 38 }),
    ]), 1) as any;
    expect(p.Observacao).toContain(
      "Entregas (2): 05/10/26 - 2 Galão Crystal Premier 20L R$ 19,00 cada = R$ 38,00"
      + " / 13/10/26 - 3 Galão Crystal Premier 20L R$ 19,00 cada, 1 Copo descartável 100 uni R$ 7,00 = R$ 64,00"
      + " / Total R$ 102,00",
    );
    expect(p.Observacao).not.toMatch(/[\r\n]/);
  });

  it("muitas entregas viram resumo no fim sem estourar o campo da SEFAZ", () => {
    const many = Array.from({ length: 120 }, (_, i) => order(`${String(i).padStart(8, "0")}-x`, { date: `2026-10-${String((i % 28) + 1).padStart(2, "0")}` }));
    const p = buildNfePayload(groupInput(many), 1) as any;
    expect(p.Observacao.length).toBeLessThan(5000);
    expect(p.Observacao).toMatch(/e mais \d+ entregas \/ Total R\$ 3\.600,00/);
  });

  it("a nota leva o desconto de cada pedido", () => {
    const p = buildNfePayload(groupInput([order("aaaaaaaa-1", { totalAmount: 28 }), order("bbbbbbbb-2")]), 1) as any;
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
