export type PriceModel = "porta" | "entrega" | "shopping" | "empresa";

export const PRICE_MODELS: { key: PriceModel; label: string; column: "price_porta" | "price_entrega" | "price_shopping" | "price_empresa" }[] = [
  { key: "porta", label: "Porta", column: "price_porta" },
  { key: "entrega", label: "Entrega", column: "price_entrega" },
  { key: "shopping", label: "Shopping", column: "price_shopping" },
  { key: "empresa", label: "Empresa", column: "price_empresa" },
];

export const priceModelLabel = (model: string | null | undefined) =>
  PRICE_MODELS.find((m) => m.key === model)?.label ?? null;

type Priced = {
  price?: number | null;
  price_porta?: number | null;
  price_entrega?: number | null;
  price_shopping?: number | null;
  price_empresa?: number | null;
};

/** Preço do produto no modelo. Entrega cai no preço antigo; os outros não
 *  caem em preço nenhum: modelo sem preço fica para o atendente digitar. */
export function modelPrice(product: Priced | undefined, model: PriceModel): number | null {
  if (!product) return null;
  if (model === "entrega") return product.price_entrega ?? product.price ?? null;
  const column = PRICE_MODELS.find((m) => m.key === model)!.column;
  return product[column] ?? null;
}

/** Modelo do pedido: o padrão do cliente; sem ele, retirada é Porta e o resto é Entrega. */
export function defaultPriceModel(customerModel: string | null | undefined, fulfillment: string): PriceModel {
  if (PRICE_MODELS.some((m) => m.key === customerModel)) return customerModel as PriceModel;
  return fulfillment === "pickup" ? "porta" : "entrega";
}
