import { describe, it, expect } from "vitest";
import { defaultPriceModel, modelPrice } from "@/lib/price-models";

describe("modelos de preço", () => {
  const p = { price: 15, price_porta: 12, price_entrega: null, price_shopping: 14, price_empresa: null };

  it("usa o preço do modelo; entrega cai no preço antigo; os outros não inventam preço", () => {
    expect(modelPrice(p, "porta")).toBe(12);
    expect(modelPrice(p, "shopping")).toBe(14);
    expect(modelPrice(p, "entrega")).toBe(15);
    expect(modelPrice(p, "empresa")).toBeNull();
  });

  it("modelo do pedido vem do cliente; sem ele, retirada é Porta e entrega é Entrega", () => {
    expect(defaultPriceModel("shopping", "delivery")).toBe("shopping");
    expect(defaultPriceModel(null, "pickup")).toBe("porta");
    expect(defaultPriceModel(undefined, "delivery")).toBe("entrega");
    expect(defaultPriceModel("qualquer", "delivery")).toBe("entrega");
  });
});
